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

// GET /api/quote-requests/export - Export quote requests as CSV
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

    if (session.user.role === 'TECHNICIAN') {
      where.createdById = session.user.id;
    }

    if (status && status !== 'all' && status !== 'ALL') {
      where.status = status;
    }

    const quoteRequests = await prisma.quoteRequest.findMany({
      where,
      include: {
        supplier: {
          select: { name: true, email: true },
        },
        vehicle: {
          select: { make: true, model: true, year: true },
        },
        items: {
          select: {
            partNumber: true,
            description: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            availability: true,
            leadTime: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const headers = [
      'Quote Number',
      'Title',
      'Status',
      'Supplier',
      'Supplier Email',
      'Request Date',
      'Expiry Date',
      'Response Date',
      'Total Amount',
      'Items Count',
      'Vehicle',
      'Notes',
      'Part Number',
      'Part Description',
      'Quantity',
      'Unit Price',
      'Line Total',
      'Availability',
      'Lead Time (days)',
    ];

    const rows: string[] = [headers.join(',')];

    for (const qr of quoteRequests) {
      const vehicle = qr.vehicle
        ? `${qr.vehicle.year ?? ''} ${qr.vehicle.make} ${qr.vehicle.model}`.trim()
        : '';

      if (qr.items.length === 0) {
        rows.push(
          [
            escapeCSV(qr.quoteNumber),
            escapeCSV(qr.title),
            escapeCSV(qr.status),
            escapeCSV(qr.supplier?.name),
            escapeCSV(qr.supplier?.email),
            escapeCSV(qr.requestDate.toISOString().split('T')[0]),
            escapeCSV(qr.expiryDate?.toISOString().split('T')[0]),
            escapeCSV(qr.responseDate?.toISOString().split('T')[0]),
            escapeCSV(qr.totalAmount?.toString()),
            '0',
            escapeCSV(vehicle),
            escapeCSV(qr.notes),
            '', '', '', '', '', '', '',
          ].join(',')
        );
      } else {
        for (const item of qr.items) {
          rows.push(
            [
              escapeCSV(qr.quoteNumber),
              escapeCSV(qr.title),
              escapeCSV(qr.status),
              escapeCSV(qr.supplier?.name),
              escapeCSV(qr.supplier?.email),
              escapeCSV(qr.requestDate.toISOString().split('T')[0]),
              escapeCSV(qr.expiryDate?.toISOString().split('T')[0]),
              escapeCSV(qr.responseDate?.toISOString().split('T')[0]),
              escapeCSV(qr.totalAmount?.toString()),
              String(qr.items.length),
              escapeCSV(vehicle),
              escapeCSV(qr.notes),
              escapeCSV(item.partNumber),
              escapeCSV(item.description),
              String(item.quantity),
              escapeCSV(item.unitPrice?.toString()),
              escapeCSV(item.totalPrice?.toString()),
              escapeCSV(item.availability),
              escapeCSV(item.leadTime?.toString()),
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
        'Content-Disposition': `attachment; filename="partsiq-quote-requests-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error('Quote request export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
