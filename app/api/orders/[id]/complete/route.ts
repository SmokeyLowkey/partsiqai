import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { analyticsQueue } from '@/lib/queue/queues';
import { withHardening } from '@/lib/api/with-hardening';

// POST /api/orders/[id]/complete - Complete order and trigger analytics
export const POST = withHardening(
  {
    // Only fleet managers + admins can complete orders. The state-machine check
    // below (`status === 'DELIVERED'`) doubles as idempotency — a second click
    // returns 400 instead of double-completing.
    roles: ['MANAGER', 'ADMIN', 'MASTER_ADMIN'],
    rateLimit: { limit: 30, windowSeconds: 60, prefix: 'order-complete', keyBy: 'userOrg' },
  },
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId } = await params;

    // Close the TOCTOU window: do the "not yet completed + items received"
    // check AND the status flip atomically. `updateMany` with the status
    // guard in the WHERE clause only touches one row when the order is in
    // a completable state — two concurrent requests can both pass the
    // earlier in-memory check, but only one will match this update.
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, organizationId: session.user.organizationId },
        include: { orderItems: true },
      });

      if (!order) return { kind: 'not_found' as const };
      if (order.status === 'DELIVERED') return { kind: 'already' as const };

      const allItemsReceived = order.orderItems.every(
        (item) => item.isReceived && item.quantityReceived >= item.quantity
      );
      if (!allItemsReceived) {
        return { kind: 'items_missing' as const, order };
      }

      // Guarded update — `status: { not: 'DELIVERED' }` means a racing
      // request that already flipped the row will cause `count` to be 0.
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: { not: 'DELIVERED' } },
        data: {
          status: 'DELIVERED',
          actualDelivery: new Date(),
          completedAt: new Date(),
          completedBy: session.user.id,
        },
      });

      if (updated.count === 0) {
        return { kind: 'already' as const };
      }

      const fresh = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { orderItems: true, supplier: true, vehicle: true },
      });

      await tx.activityLog.create({
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

      return { kind: 'ok' as const, order: fresh };
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (result.kind === 'already') {
      return NextResponse.json({ error: 'Order already completed' }, { status: 400 });
    }
    if (result.kind === 'items_missing') {
      return NextResponse.json(
        {
          error: 'Cannot complete order - not all items have been received',
          itemsStatus: result.order.orderItems.map((item) => ({
            id: item.id,
            partNumber: item.partNumber,
            quantityReceived: item.quantityReceived,
            quantityOrdered: item.quantity,
            isReceived: item.isReceived,
          })),
        },
        { status: 400 }
      );
    }

    const updatedOrder = result.order;

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
);
