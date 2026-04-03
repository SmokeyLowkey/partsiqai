import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user || session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { emailId } = await params;

    const replies = await prisma.adminEmailReply.findMany({
      where: { adminEmailId: emailId },
      orderBy: { receivedAt: 'asc' },
    });

    return NextResponse.json({ replies });
  } catch (error) {
    console.error('Error fetching email replies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch replies' },
      { status: 500 }
    );
  }
}
