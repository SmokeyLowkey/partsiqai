import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function escapeCSV(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/orders/export - Export orders as CSV
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const where: any = {
      organizationId: session.user.organizationId,
    };

    if (status && status !== 'all' && status !== 'ALL') {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        supplier: {
          select: { name: true },
        },
        vehicle: {
          select: { make: true, model: true, year: true },
        },
        orderItems: {
          select: {
            partNumber: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            supplierPartNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const headers = [
      'Order Number',
      'Status',
      'Supplier',
      'Order Date',
      'Expected Delivery',
      'Actual Delivery',
      'Subtotal',
      'Tax',
      'Shipping',
      'Total',
      'Tracking Number',
      'Shipping Method',
      'Fulfillment Method',
      'Vehicle',
      'Notes',
      'Part Number',
      'Supplier Part Number',
      'Quantity',
      'Unit Price',
      'Line Total',
    ];

    const rows: string[] = [headers.join(',')];

    for (const order of orders) {
      const vehicle = order.vehicle
        ? `${order.vehicle.year ?? ''} ${order.vehicle.make} ${order.vehicle.model}`.trim()
        : '';

      if (order.orderItems.length === 0) {
        rows.push(
          [
            escapeCSV(order.orderNumber),
            escapeCSV(order.status),
            escapeCSV(order.supplier?.name),
            escapeCSV(order.orderDate.toISOString().split('T')[0]),
            escapeCSV(order.expectedDelivery?.toISOString().split('T')[0]),
            escapeCSV(order.actualDelivery?.toISOString().split('T')[0]),
            escapeCSV(order.subtotal.toString()),
            escapeCSV(order.tax?.toString()),
            escapeCSV(order.shipping?.toString()),
            escapeCSV(order.total.toString()),
            escapeCSV(order.trackingNumber),
            escapeCSV(order.shippingMethod),
            escapeCSV(order.fulfillmentMethod),
            escapeCSV(vehicle),
            escapeCSV(order.notes),
            '', '', '', '', '',
          ].join(',')
        );
      } else {
        for (const item of order.orderItems) {
          rows.push(
            [
              escapeCSV(order.orderNumber),
              escapeCSV(order.status),
              escapeCSV(order.supplier?.name),
              escapeCSV(order.orderDate.toISOString().split('T')[0]),
              escapeCSV(order.expectedDelivery?.toISOString().split('T')[0]),
              escapeCSV(order.actualDelivery?.toISOString().split('T')[0]),
              escapeCSV(order.subtotal.toString()),
              escapeCSV(order.tax?.toString()),
              escapeCSV(order.shipping?.toString()),
              escapeCSV(order.total.toString()),
              escapeCSV(order.trackingNumber),
              escapeCSV(order.shippingMethod),
              escapeCSV(order.fulfillmentMethod),
              escapeCSV(vehicle),
              escapeCSV(order.notes),
              escapeCSV(item.partNumber),
              escapeCSV(item.supplierPartNumber),
              String(item.quantity),
              escapeCSV(item.unitPrice.toString()),
              escapeCSV(item.totalPrice.toString()),
            ].join(',')
          );
        }
      }
    }

    const csv = rows.join('\n');
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="partsiq-orders-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error('Order export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
