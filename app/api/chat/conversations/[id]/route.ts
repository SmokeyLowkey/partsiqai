import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withHardening } from '@/lib/api/with-hardening';

export const DELETE = withHardening(
  {
    rateLimit: { limit: 60, windowSeconds: 60, prefix: 'chat-delete-conversation', keyBy: 'user' },
  },
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify conversation belongs to user
    const conversation = await prisma.chatConversation.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Delete conversation and all related data (messages, pick list items)
    // Due to cascade delete in schema, this will also delete:
    // - ChatMessage records
    // - ChatPickListItem records
    await prisma.chatConversation.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete conversation API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete conversation',
      },
      { status: 500 }
    );
  }
  }
);
