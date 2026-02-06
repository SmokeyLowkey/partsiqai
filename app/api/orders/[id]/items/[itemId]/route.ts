import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateOrderItemSchema = z.object({
  quantityReceived: z.number().int().min(0),
  receivedDate: z.string().nullable().optional(),
  isReceived: z.boolean().optional(),
});

// PATCH /api/orders/[id]/items/[itemId] - Update order item received status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId, itemId } = await params;
    const body = await req.json();

    // Validate request body
    const validationResult = UpdateOrderItemSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { quantityReceived, receivedDate, isReceived } = validationResult.data;

    // Verify order belongs to organization
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId: session.user.organizationId,
      },
      include: {
        orderItems: {
          where: { id: itemId },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.orderItems.length === 0) {
      return NextResponse.json(
        { error: 'Order item not found' },
        { status: 404 }
      );
    }

    const orderItem = order.orderItems[0];

    // Update order item
    const updatedItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        quantityReceived,
        isReceived: isReceived ?? (quantityReceived >= orderItem.quantity),
        receivedDate: receivedDate ? new Date(receivedDate) : null,
      },
    });

    // Check if all items are now received and update order status
    const allItems = await prisma.orderItem.findMany({
      where: { orderId },
    });

    const allReceived = allItems.every(
      (item) => item.quantityReceived >= item.quantity
    );

    if (allReceived && order.status !== 'DELIVERED') {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'DELIVERED',
          actualDelivery: new Date(),
        },
      });
    } else if (!allReceived && order.status === 'DELIVERED') {
      // If we're unchecking items, revert from DELIVERED
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'IN_TRANSIT',
        },
      });
    }

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    console.error('Error updating order item:', error);
    return NextResponse.json(
      { error: 'Failed to update order item' },
      { status: 500 }
    );
  }
}
