import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const where = {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      isActive: true,
    };

    // Get conversations with pagination
    const [conversations, total] = await Promise.all([
      prisma.chatConversation.findMany({
        where,
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chatConversation.count({ where }),
    ]);

    console.log('[Conversations API] Fetched conversations:', conversations.length);

    return NextResponse.json({
      conversations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
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
