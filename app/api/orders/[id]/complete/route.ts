import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { analyticsQueue } from '@/lib/queue/queues';

// POST /api/orders/[id]/complete - Complete order and trigger analytics
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId } = await params;

    // Verify order belongs to organization
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId: session.user.organizationId,
      },
      include: {
        orderItems: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if order is already completed
    if (order.status === 'DELIVERED') {
      return NextResponse.json(
        { error: 'Order already completed' },
        { status: 400 }
      );
    }

    // Validate all items are received
    const allItemsReceived = order.orderItems.every(
      (item) => item.isReceived && item.quantityReceived >= item.quantity
    );

    if (!allItemsReceived) {
      return NextResponse.json(
        { 
          error: 'Cannot complete order - not all items have been received',
          itemsStatus: order.orderItems.map(item => ({
            id: item.id,
            partNumber: item.partNumber,
            quantityReceived: item.quantityReceived,
            quantityOrdered: item.quantity,
            isReceived: item.isReceived,
          }))
        },
        { status: 400 }
      );
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        actualDelivery: new Date(),
        completedAt: new Date(),
        completedBy: session.user.id,
      },
      include: {
        orderItems: true,
        supplier: true,
        vehicle: true,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId: session.user.organizationId,
        type: 'ORDER_DELIVERED',
        title: 'Order Completed',
        description: `Order ${order.orderNumber} was marked as completed and delivered`,
        entityType: 'Order',
        entityId: orderId,
        userId: session.user.id,
      },
    });

    // Queue analytics collection job (async, non-blocking)
    try {
      await analyticsQueue.add('order-completed', { 
        orderId 
      });
    } catch (queueError) {
      // Log error but don't fail the request
      console.error('Failed to queue analytics job:', queueError);
    }

    return NextResponse.json({ 
      order: updatedOrder,
      message: 'Order completed successfully. Analytics are being processed.'
    });
  } catch (error) {
    console.error('Error completing order:', error);
    return NextResponse.json(
      { error: 'Failed to complete order' },
      { status: 500 }
    );
  }
}
