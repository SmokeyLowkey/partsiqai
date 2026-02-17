import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const PickListItemSchema = z.object({
  partNumber: z.string(),
  description: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().optional(),
  supplier: z.string().optional(),
  isWebResult: z.boolean().optional(),
});

const PickListSchema = z.object({
  conversationId: z.string(),
  items: z.array(PickListItemSchema).min(1),
  vehicleId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate request body
    const validationResult = PickListSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { conversationId, items, vehicleId } = validationResult.data;

    // Verify conversation belongs to user
    const conversation = await prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Create pick list
    const pickList = await prisma.chatPickList.create({
      data: {
        conversationId,
        vehicleId,
        name: `Pick List - ${new Date().toLocaleDateString()}`,
        status: 'ACTIVE',
        items: {
          create: items.map((item) => ({
            partNumber: item.partNumber,
            description: item.description,
            quantity: item.quantity,
            estimatedPrice: item.price,
            notes: item.supplier ? `Supplier: ${item.supplier}` : undefined,
            source: item.isWebResult ? 'WEB_SEARCH' : 'CATALOG',
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      pickList,
    });
  } catch (error: any) {
    console.error('Create pick list API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create pick list',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Verify conversation belongs to user and get pick lists
    const conversation = await prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
      include: {
        pickLists: {
          include: {
            items: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      pickLists: conversation.pickLists,
    });
  } catch (error: any) {
    console.error('Get pick lists API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch pick lists',
      },
      { status: 500 }
    );
  }
}
