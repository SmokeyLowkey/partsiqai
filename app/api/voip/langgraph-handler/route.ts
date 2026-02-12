import { NextRequest, NextResponse } from 'next/server';
import { getCallState, saveCallState } from '@/lib/voip/state-manager';
import { processCallTurn } from '@/lib/voip/call-graph';
import { getLastAIMessage, addMessage } from '@/lib/voip/helpers';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { workerLogger } from '@/lib/logger';

const logger = workerLogger.child({ module: 'langgraph-handler' });

/**
 * LangGraph Handler for Vapi Custom LLM Integration
 * 
 * This endpoint receives conversation turns from Vapi and processes them
 * through the LangGraph state machine to generate contextual responses.
 * 
 * Vapi Custom LLM Request Format:
 * {
 *   "message": {
 *     "role": "user",
 *     "content": "supplier's spoken text"
 *   },
 *   "call": {
 *     "id": "vapi-call-id",
 *     "metadata": { ... }
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authorization
    const authHeader = req.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.VOIP_WEBHOOK_SECRET || 'dev-secret'}`;
    
    if (process.env.NODE_ENV === 'production' && authHeader !== expectedAuth) {
      logger.warn({ authHeader }, 'Unauthorized LangGraph handler request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    logger.debug({ body }, 'LangGraph handler request received');

    const userMessage = body.message?.content || body.text;
    const callId = body.call?.metadata?.callLogId || body.callId;

    if (!userMessage) {
      logger.error({ body }, 'Missing user message in request');
      return NextResponse.json(
        { error: 'Missing message content' },
        { status: 400 }
      );
    }

    if (!callId) {
      logger.error({ body }, 'Missing callId in request');
      return NextResponse.json(
        { error: 'Missing call ID' },
        { status: 400 }
      );
    }

    // Get current call state from Redis
    const state = await getCallState(callId);
    
    if (!state) {
      logger.error({ callId }, 'Call state not found in Redis');
      return NextResponse.json(
        { error: 'Call state not found' },
        { status: 404 }
      );
    }

    logger.info(
      { 
        callId, 
        currentNode: state.currentNode, 
        messageLength: userMessage.length 
      },
      'Processing supplier response through LangGraph'
    );

    // Create LLM client for the organization
    const llmClient = await OpenRouterClient.fromOrganization(state.organizationId);

    // Add supplier's message to conversation history
    const stateWithMessage = addMessage(state, 'supplier', userMessage);

    // Process through LangGraph state machine
    const newState = await processCallTurn(llmClient, stateWithMessage);

    // Save updated state back to Redis
    await saveCallState(callId, newState);

    // Get the AI's response from the new state
    const aiResponse = getLastAIMessage(newState);

    logger.info(
      { 
        callId, 
        previousNode: state.currentNode,
        newNode: newState.currentNode,
        status: newState.status,
        responseLength: aiResponse.length
      },
      'LangGraph processing complete'
    );

    // Check if call should end
    const shouldEndCall = 
      newState.status === 'completed' || 
      newState.status === 'escalated' ||
      newState.status === 'failed' ||
      newState.currentNode === 'end';

    // Return response in Vapi expected format
    return NextResponse.json({
      message: {
        role: 'assistant',
        content: aiResponse,
      },
      endCall: shouldEndCall,
      metadata: {
        currentNode: newState.currentNode,
        status: newState.status,
        quotesExtracted: newState.quotes.length,
        needsEscalation: newState.needsHumanEscalation,
      },
    });

  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'LangGraph handler error');
    
    // Return a graceful error response to keep call going
    return NextResponse.json({
      message: {
        role: 'assistant',
        content: "I apologize, I'm having technical difficulties. Let me transfer you to a team member who can help.",
      },
      endCall: true,
      metadata: {
        error: true,
        errorMessage: error.message,
      },
    }, { status: 200 }); // Return 200 to avoid Vapi retries
  }
}

// GET endpoint for health check
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'langgraph-handler',
    timestamp: new Date().toISOString(),
  });
}
