import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const supplierId = searchParams.get('supplierId');

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

    const quoteRequests = await prisma.quoteRequest.findMany({
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform to include item count
    const quoteRequestsWithCount = quoteRequests.map((qr) => ({
      ...qr,
      itemCount: qr.items.length,
      totalAmount: qr.totalAmount ? Number(qr.totalAmount) : null,
    }));

    return NextResponse.json({ quoteRequests: quoteRequestsWithCount });
  } catch (error: any) {
    console.error('Get quote requests API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch quote requests',
      },
      { status: 500 }
    );
  }
}

// POST /api/quote-requests - Create a new quote request from a pick list
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate request body
    const validationResult = CreateQuoteRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Pick list not found' },
        { status: 404 }
      );
    }

    if (pickList.items.length === 0) {
      return NextResponse.json(
        { error: 'Pick list has no items' },
        { status: 400 }
      );
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
        return NextResponse.json(
          { error: 'Vehicle not found' },
          { status: 404 }
        );
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

    return NextResponse.json(
      {
        error: 'Failed to create quote request',
      },
      { status: 500 }
    );
  }
}
