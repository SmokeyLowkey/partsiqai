import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { items, removedItemIds } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      );
    }

    // Verify quote request belongs to user
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id },
      select: {
        createdById: true,
        status: true,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    if (quoteRequest.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Perform update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Remove deleted items
      if (removedItemIds && removedItemIds.length > 0) {
        await tx.quoteRequestItem.deleteMany({
          where: {
            id: { in: removedItemIds },
            quoteRequestId: id,
          },
        });
      }

      // Update or create items
      for (const item of items) {
        if (item.id) {
          // Update existing item
          await tx.quoteRequestItem.update({
            where: { id: item.id },
            data: {
              partNumber: item.partNumber,
              description: item.description,
              quantity: item.quantity,
            },
          });
        } else {
          // Create new item
          await tx.quoteRequestItem.create({
            data: {
              quoteRequestId: id,
              partNumber: item.partNumber,
              description: item.description,
              quantity: item.quantity,
            },
          });
        }
      }

      // Get updated quote request with items
      const updated = await tx.quoteRequest.findUnique({
        where: { id },
        include: {
          items: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          vehicle: true,
        },
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating quote request items:', error);
    return NextResponse.json(
      { error: 'Failed to update items' },
      { status: 500 }
    );
  }
}
