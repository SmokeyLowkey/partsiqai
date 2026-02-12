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

    // Transform call data to extract LangGraph state and format for UI
    const transformedCalls = calls.map(call => {
      let conversationLog = null;
      let langGraphState = null;
      
      // Extract conversation history from stored format
      if (call.conversationLog) {
        const logData = call.conversationLog as any;
        
        // LangGraph format (conversationHistory array)
        if (logData.conversationHistory && Array.isArray(logData.conversationHistory)) {
          conversationLog = logData.conversationHistory.map((msg: any) => ({
            role: msg.speaker === 'ai' ? 'assistant' : 'user',
            content: msg.text,
            timestamp: msg.timestamp,
          }));

          // Extract LangGraph state information
          langGraphState = {
            currentNode: logData.currentNode,
            status: logData.status,
            needsTransfer: logData.needsTransfer,
            needsHumanEscalation: logData.needsHumanEscalation,
            negotiationAttempts: logData.negotiationAttempts,
            clarificationAttempts: logData.clarificationAttempts,
            outcome: logData.outcome,
            nextAction: logData.nextAction,
            contactName: logData.contactName,
            contactRole: logData.contactRole,
          };
        }
        // Already in correct format (array)
        else if (Array.isArray(logData)) {
          conversationLog = logData;
        }
      }

      // Extract quotes from stored format
      let extractedQuotes = null;
      if (call.extractedQuotes) {
        const quotesData = call.extractedQuotes as any;
        extractedQuotes = Array.isArray(quotesData) ? quotesData : quotesData.quotes || null;
      }

      return {
        ...call,
        conversationLog,
        extractedQuotes,
        langGraphState,
      };
    });

    return NextResponse.json({ 
      calls: transformedCalls,
      count: transformedCalls.length,
    });
  } catch (error) {
    console.error('Error fetching calls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    );
  }
}
