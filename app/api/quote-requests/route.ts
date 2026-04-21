import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-utils';
import { withHardening } from '@/lib/api/with-hardening';
import { z } from 'zod';
import { generateQuoteNumber } from '@/lib/utils/quote-number';

const CreateQuoteRequestSchema = z.object({
  pickListId: z.string(),
  vehicleId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/quote-requests - List all quote requests for the organization
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const supplierId = searchParams.get('supplierId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const where: any = {
      organizationId: session.user.organizationId,
    };

    // Technicians can only see their own quotes
    if (session.user.role === 'TECHNICIAN') {
      where.createdById = session.user.id;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (supplierId && supplierId !== 'all') {
      where.supplierId = supplierId;
    }

    if (search) {
      where.OR = [
        { quoteNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [quoteRequests, total] = await Promise.all([
      prisma.quoteRequest.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              email: true,
              contactPerson: true,
              phone: true,
              rating: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              make: true,
              model: true,
              year: true,
              serialNumber: true,
              vehicleId: true,
            },
          },
          items: {
            select: {
              id: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          managerTakeover: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.quoteRequest.count({ where }),
    ]);

    // Transform to include item count
    const quoteRequestsWithCount = quoteRequests.map((qr) => ({
      ...qr,
      itemCount: qr.items.length,
      totalAmount: qr.totalAmount ? Number(qr.totalAmount) : null,
    }));

    return NextResponse.json({
      quoteRequests: quoteRequestsWithCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error('Get quote requests API error:', error);

    return apiError('Failed to fetch quote requests', 500, { code: 'INTERNAL_ERROR' });
  }
}

// POST /api/quote-requests - Create a new quote request from a pick list
export const POST = withHardening(
  {
    rateLimit: { limit: 30, windowSeconds: 60, prefix: 'quote-create', keyBy: 'userOrg' },
  },
  async (req: Request) => {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const body = await req.json();

    // Validate request body
    const validationResult = CreateQuoteRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError('Invalid request', 400, {
        code: 'VALIDATION_ERROR',
        details: validationResult.error.errors,
      });
    }

    const { pickListId, vehicleId, title, description, notes } = validationResult.data;

    // Verify pick list exists and belongs to user's conversation
    const pickList = await prisma.chatPickList.findFirst({
      where: {
        id: pickListId,
        conversation: {
          userId: session.user.id,
        },
      },
      include: {
        items: true,
        vehicle: true,
      },
    });

    if (!pickList) {
      return apiError('Pick list not found', 404, { code: 'NOT_FOUND' });
    }

    if (pickList.items.length === 0) {
      return apiError('Pick list has no items', 400, { code: 'EMPTY_PICK_LIST' });
    }

    // Determine vehicle ID (from request, pick list, or null)
    const finalVehicleId = vehicleId || pickList.vehicleId;

    // Verify vehicle exists if provided
    if (finalVehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: finalVehicleId,
          organizationId: session.user.organizationId,
        },
      });

      if (!vehicle) {
        return apiError('Vehicle not found', 404, { code: 'NOT_FOUND' });
      }
    }

    // Generate quote number
    const quoteNumber = await generateQuoteNumber(session.user.organizationId);

    // Create quote request with items
    const quoteRequest = await prisma.quoteRequest.create({
      data: {
        quoteNumber,
        title: title || `Quote Request - ${new Date().toLocaleDateString()}`,
        status: 'DRAFT',
        description,
        notes,
        organizationId: session.user.organizationId,
        createdById: session.user.id,
        vehicleId: finalVehicleId || null,
        supplierId: null, // Will be set when user selects supplier on the quote page
        pickListId: pickList.id,
        items: {
          create: [
            // Add all pick list items
            ...pickList.items.map((item) => ({
              partNumber: item.partNumber,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.estimatedPrice,
              totalPrice: item.estimatedPrice
                ? Number(item.estimatedPrice) * item.quantity
                : null,
              notes: item.notes,
              source: item.source,
            })),
            // Always add MISC item for additional costs
            {
              partNumber: 'MISC-COSTS',
              description: 'Additional Costs & Fees',
              quantity: 1,
              unitPrice: 0,
              totalPrice: 0,
              notes: 'Miscellaneous costs such as shipping, freight, handling fees, etc.',
            },
          ],
        },
      },
      include: {
        items: true,
        vehicle: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ quoteRequest }, { status: 201 });
  } catch (error: any) {
    console.error('Create quote request API error:', error);

    return apiError('Failed to create quote request', 500, { code: 'INTERNAL_ERROR' });
  }
  }
);
