import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Get all supplier calls for a quote request
 */
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

    // Get quote request to verify access
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    if (quoteRequest.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all calls for this quote request
    const calls = await prisma.supplierCall.findMany({
      where: { quoteRequestId: id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        caller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ calls });
  } catch (error) {
    console.error('Error fetching calls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    );
  }
}
