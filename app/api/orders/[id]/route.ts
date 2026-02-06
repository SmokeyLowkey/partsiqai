import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateOrderSchema = z.object({
  status: z.enum(['PENDING', 'PENDING_QUOTE', 'PROCESSING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'RETURNED']).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  trackingNumber: z.string().optional(),
  estimatedDelivery: z.string().datetime().optional(),
  fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY', 'SPLIT']).optional(),
});

// GET /api/orders/[id] - Get a single order with all details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
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
        orderItems: {
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
          orderBy: {
            createdAt: 'asc',
          },
        },
        emailThread: {
          include: {
            messages: {
              orderBy: {
                sentAt: 'desc',
              },
              include: {
                attachments: {
                  select: {
                    id: true,
                    filename: true,
                    contentType: true,
                    size: true,
                  },
                },
              },
            },
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

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Get quote reference if exists
    let quoteReference = null;
    if (order.quoteReference) {
      quoteReference = await prisma.quoteRequest.findUnique({
        where: { id: order.quoteReference },
        select: {
          id: true,
          quoteNumber: true,
          status: true,
        },
      });
    }

    return NextResponse.json({
      order: {
        ...order,
        quoteReference,
      },
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// PATCH /api/orders/[id] - Update an order
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Validate request body against schema
    const validationResult = UpdateOrderSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    // Verify order belongs to organization
    const existingOrder = await prisma.order.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const data = validationResult.data;

    // Update order with validated fields only
    const order = await prisma.order.update({
      where: { id },
      data: {
        ...data,
        ...(data.estimatedDelivery && { estimatedDelivery: new Date(data.estimatedDelivery) }),
        updatedAt: new Date(),
      },
      include: {
        supplier: true,
        vehicle: true,
        orderItems: {
          include: {
            part: true,
          },
        },
      },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}
