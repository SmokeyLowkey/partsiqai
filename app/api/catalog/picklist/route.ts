import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { generateQuoteNumber } from '@/lib/utils/quote-number';

const AddToPicklistSchema = z.object({
  partId: z.string(),
  quantity: z.number().int().positive().default(1),
});

const CreateQuoteFromPicklistSchema = z.object({
  items: z.array(z.object({
    partId: z.string(),
    quantity: z.number().int().positive(),
  })).min(1),
  vehicleId: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/catalog/picklist - Get current user's catalog picklist (stored in session/localStorage)
// Since we don't have a dedicated catalog picklist table, we'll use the quote-request flow directly
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's draft quote requests that can serve as picklists
    const draftQuotes = await prisma.quoteRequest.findMany({
      where: {
        organizationId: session.user.organizationId,
        createdById: session.user.id,
        status: 'DRAFT',
        pickListId: null, // Only catalog-based quotes (not from chat)
      },
      include: {
        items: {
          include: {
            part: {
              select: {
                id: true,
                partNumber: true,
                description: true,
                price: true,
                stockQuantity: true,
                category: true,
              },
            },
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            vehicleId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    return NextResponse.json({ draftQuotes });
  } catch (error: any) {
    console.error('Get catalog picklist API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch picklist',
      },
      { status: 500 }
    );
  }
}

// POST /api/catalog/picklist - Create a quote request from catalog parts
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate request body
    const validationResult = CreateQuoteFromPicklistSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { items, vehicleId, title, notes } = validationResult.data;

    // Verify all parts exist (catalog is shared across all organizations)
    const partIds = items.map((item) => item.partId);
    const parts = await prisma.part.findMany({
      where: {
        id: { in: partIds },
        isActive: true,
      },
      include: {
        suppliers: {
          where: {
            supplier: {
              status: 'ACTIVE',
            },
          },
          orderBy: {
            price: 'asc',
          },
          take: 1,
        },
      },
    });

    if (parts.length !== partIds.length) {
      return NextResponse.json(
        { error: 'One or more parts not found' },
        { status: 404 }
      );
    }

    // Verify vehicle if provided
    if (vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
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

    // Build a map of parts for quick lookup
    const partsMap = new Map(parts.map((p) => [p.id, p]));

    // Generate quote number
    const quoteNumber = await generateQuoteNumber(session.user.organizationId);

    // Create quote request with items
    const quoteRequest = await prisma.quoteRequest.create({
      data: {
        quoteNumber,
        title: title || `Parts Quote - ${new Date().toLocaleDateString()}`,
        status: 'DRAFT',
        notes,
        organizationId: session.user.organizationId,
        createdById: session.user.id,
        vehicleId: vehicleId || null,
        supplierId: null,
        items: {
          create: [
            // Add all selected parts
            ...items.map((item) => {
              const part = partsMap.get(item.partId)!;
              const bestPrice = part.suppliers[0]?.price || part.price;
              const unitPrice = Number(bestPrice);

              return {
                partId: part.id,
                partNumber: part.partNumber,
                description: part.description,
                quantity: item.quantity,
                unitPrice,
                totalPrice: unitPrice * item.quantity,
              };
            }),
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
        items: {
          include: {
            part: {
              select: {
                id: true,
                partNumber: true,
                description: true,
                category: true,
              },
            },
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            vehicleId: true,
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
    });

    // Calculate total amount
    const totalAmount = quoteRequest.items.reduce(
      (sum, item) => sum + (Number(item.totalPrice) || 0),
      0
    );

    return NextResponse.json(
      {
        success: true,
        quoteRequest: {
          ...quoteRequest,
          totalAmount,
          itemCount: quoteRequest.items.length - 1, // Exclude MISC-COSTS
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create quote from catalog API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create quote request',
      },
      { status: 500 }
    );
  }
}
