import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getActiveCallsForQuote } from '@/lib/voip/state-manager';

/**
 * Get active (in-progress) calls for a quote request
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

    // Get active calls from database
    const activeCalls = await prisma.supplierCall.findMany({
      where: {
        quoteRequestId: id,
        status: {
          in: ['INITIATED', 'RINGING', 'ANSWERED', 'IN_PROGRESS'],
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Fetch all active call states once, then enrich
    const activeStates = await getActiveCallsForQuote(id);
    const statesByCallId = new Map(activeStates.map((s) => [s.callId, s]));

    const callsWithState = activeCalls.map((call) => {
      const state = statesByCallId.get(call.id);
      return {
        ...call,
        currentNode: state?.currentNode,
        conversationTurns: state?.conversationHistory.length || 0,
      };
    });

    return NextResponse.json({ calls: callsWithState });
  } catch (error) {
    console.error('Error fetching active calls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active calls' },
      { status: 500 }
    );
  }
}
