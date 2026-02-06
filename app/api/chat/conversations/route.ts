import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all conversations for the current user
    const conversations = await prisma.chatConversation.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        lastMessageAt: true,
        messageCount: true,
        isActive: true,
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
          },
        },
      },
    });

    console.log('[Conversations API] Fetched conversations:', conversations.length);
    conversations.forEach((conv, idx) => {
      console.log(`[Conversations API] Conversation ${idx}:`, {
        id: conv.id,
        title: conv.title,
        hasVehicle: !!conv.vehicle,
        vehicleId: conv.vehicle?.id,
        vehicle: conv.vehicle
      });
    });

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('Get conversations API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch conversations',
      },
      { status: 500 }
    );
  }
}
