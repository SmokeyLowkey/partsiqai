import { NextRequest, NextResponse } from 'next/server';
import { getCallState, saveCallState, acquireCallLock, releaseCallLock } from '@/lib/voip/state-manager';
import { processCallTurn } from '@/lib/voip/call-graph';
import { getLastAIMessage, addMessage } from '@/lib/voip/helpers';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { workerLogger } from '@/lib/logger';
import crypto from 'crypto';

const logger = workerLogger.child({ module: 'langgraph-handler' });

/**
 * LangGraph Handler for Vapi Custom LLM Integration
 *
 * Vapi sends requests in OpenAI Chat Completions format:
 * {
 *   "model": "langgraph-state-machine",
 *   "messages": [
 *     { "role": "system", "content": "..." },
 *     { "role": "assistant", "content": "first message" },
 *     { "role": "user", "content": "supplier's spoken text" }
 *   ],
 *   "stream": true,
 *   "call": { "id": "vapi-call-id", "metadata": { "callLogId": "..." } }
 * }
 *
 * Must return OpenAI-compatible response (JSON or SSE stream).
 */

/** Build an OpenAI-style completion ID */
function completionId(): string {
  return `chatcmpl-${crypto.randomUUID()}`;
}

/** Build a non-streaming OpenAI Chat Completions response */
function buildChatCompletionResponse(content: string, options?: { endCall?: boolean }) {
  const message: any = {
    role: 'assistant',
    content,
  };

  let finishReason = 'stop';

  if (options?.endCall) {
    message.tool_calls = [
      {
        id: `call_end_${crypto.randomUUID()}`,
        type: 'function',
        function: {
          name: 'endCall',
          arguments: '{}',
        },
      },
    ];
    finishReason = 'tool_calls';
  }

  return {
    id: completionId(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'langgraph-state-machine',
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

/** Build an SSE streaming response for Vapi */
function buildStreamingResponse(content: string, options?: { endCall?: boolean }): Response {
  const id = completionId();
  const created = Math.floor(Date.now() / 1000);

  // Chunk 1: role + content
  const chunk1 = {
    id,
    object: 'chat.completion.chunk',
    created,
    model: 'langgraph-state-machine',
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          content,
        },
        finish_reason: null,
      },
    ],
  };

  const chunks = [`data: ${JSON.stringify(chunk1)}\n\n`];

  if (options?.endCall) {
    // Chunk 2: endCall tool_call
    const toolCallChunk = {
      id,
      object: 'chat.completion.chunk',
      created,
      model: 'langgraph-state-machine',
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: `call_end_${crypto.randomUUID()}`,
                type: 'function',
                function: {
                  name: 'endCall',
                  arguments: '{}',
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    };
    chunks.push(`data: ${JSON.stringify(toolCallChunk)}\n\n`);

    // Chunk 3: finish with tool_calls reason
    const finishChunk = {
      id,
      object: 'chat.completion.chunk',
      created,
      model: 'langgraph-state-machine',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'tool_calls',
        },
      ],
    };
    chunks.push(`data: ${JSON.stringify(finishChunk)}\n\n`);
  } else {
    // Chunk 2: normal finish
    const finishChunk = {
      id,
      object: 'chat.completion.chunk',
      created,
      model: 'langgraph-state-machine',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
    chunks.push(`data: ${JSON.stringify(finishChunk)}\n\n`);
  }

  chunks.push(`data: [DONE]\n\n`);

  return new Response(chunks.join(''), {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/** Extract the last user message from the OpenAI messages array */
function extractLastUserMessage(messages: any[]): string | null {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && messages[i].content) {
      return messages[i].content;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  // FIRST LOG - Before anything else, confirm request received
  console.log('[LangGraph Handler] ⚡ REQUEST RECEIVED at', new Date().toISOString());
  logger.info({
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
  }, '⚡ LangGraph handler endpoint hit - request received from VAPI');
  
  let isStreaming = false;

  try {
    // Verify authorization - check VOIP_WEBHOOK_SECRET from environment
    const authHeader = req.headers.get('authorization');
    const webhookSecret = process.env.VOIP_WEBHOOK_SECRET;
    
    logger.info({
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? authHeader.substring(0, 20) + '...' : 'missing',
      hasWebhookSecret: !!webhookSecret,
      nodeEnv: process.env.NODE_ENV,
      webhookSecretConfigured: !!webhookSecret,
    }, 'Authorization check - VOIP_WEBHOOK_SECRET from environment');

    // Only enforce auth if VOIP_WEBHOOK_SECRET is configured
    if (webhookSecret) {
      const expectedAuth = `Bearer ${webhookSecret}`;
      
      // TEMPORARY: Allow VAPI's default placeholder for testing
      const isVapiPlaceholder = authHeader === 'Bearer no-custom-llm-key-provided';
      
      if (authHeader !== expectedAuth && !isVapiPlaceholder) {
        logger.warn({ 
          authHeaderPreview: authHeader?.substring(0, 30),
          expectedAuthPreview: expectedAuth?.substring(0, 30),
          match: authHeader === expectedAuth,
          isVapiPlaceholder,
        }, 'Unauthorized LangGraph handler request - auth mismatch');
        return NextResponse.json({ 
          error: 'Unauthorized',
          message: 'Invalid authorization header'
        }, { status: 401 });
      }
      
      if (isVapiPlaceholder) {
        logger.warn(
          '⚠️  TEMPORARY: Accepting VAPI placeholder auth token for testing. Configure custom headers in VAPI assistant model settings for production.'
        );
      } else {
        logger.info('Authorization check passed');
      }
    } else {
      logger.warn(
        'VOIP_WEBHOOK_SECRET not configured - skipping auth check (set in Vercel environment variables for production)'
      );
    }

    const body = await req.json();
    console.log('[LangGraph Handler] 📦 Body parsed:', JSON.stringify(body, null, 2));
    
    // Check if this is a status update webhook (not a chat completion request)
    if (body.message?.type === 'status-update') {
      logger.info({
        type: 'status-update',
        status: body.message.status,
        endedReason: body.message.endedReason,
        msg: 'Received status update webhook at chat completions endpoint - returning 200. NOTE: Configure assistant server.url to /api/voip/webhooks instead',
      });
      return NextResponse.json({ 
        acknowledged: true,
        note: 'Status updates should be sent to /api/voip/webhooks. Please update VAPI assistant configuration.' 
      }, { status: 200 });
    }
    
    isStreaming = body.stream === true;

    logger.info(
      {
        hasMessages: !!body.messages,
        messageCount: body.messages?.length,
        stream: isStreaming,
        model: body.model,
        callId: body.call?.id,
        callLogId: body.call?.metadata?.callLogId,
        callObject: body.call ? {
          id: body.call.id,
          metadata: body.call.metadata
        } : 'missing',
        lastMessage: body.messages?.length > 0 
          ? {
              role: body.messages[body.messages.length - 1]?.role,
              contentPreview: body.messages[body.messages.length - 1]?.content?.substring(0, 100)
            }
          : 'no messages'
      },
      'LangGraph handler request received'
    );

    // Parse request — Vapi sends OpenAI format with `messages` array
    const userMessage = extractLastUserMessage(body.messages);
    const callId = body.call?.metadata?.callLogId;

    if (!userMessage) {
      logger.error(
        { messages: body.messages?.map((m: any) => ({ role: m.role, len: m.content?.length })) },
        'No user message found in messages array'
      );
      const errorContent = "I'm sorry, I didn't catch that. Could you repeat?";
      if (isStreaming) return buildStreamingResponse(errorContent);
      return NextResponse.json(buildChatCompletionResponse(errorContent));
    }

    if (!callId) {
      logger.error(
        { callObject: body.call },
        'Missing callLogId in call.metadata'
      );
      // Return a graceful response instead of error — Vapi may not understand error JSON
      const errorContent = "I apologize, I'm experiencing a technical issue. Could you hold for just a moment?";
      if (isStreaming) return buildStreamingResponse(errorContent);
      return NextResponse.json(buildChatCompletionResponse(errorContent));
    }

    // Acquire per-call lock to prevent concurrent processing
    // (e.g., if Vapi sends two messages before the first finishes)
    let lockAcquired = await acquireCallLock(callId);
    if (!lockAcquired) {
      // Another request is processing — wait briefly and retry once
      logger.warn({ callId }, 'Call lock busy, waiting 300ms to retry');
      await new Promise(resolve => setTimeout(resolve, 300));
      lockAcquired = await acquireCallLock(callId);
      if (!lockAcquired) {
        logger.warn({ callId }, 'Could not acquire lock after retry — returning hold message');
        const busyContent = "One moment please.";
        if (isStreaming) return buildStreamingResponse(busyContent);
        return NextResponse.json(buildChatCompletionResponse(busyContent));
      }
    }

    try {
      // Get current call state from Redis
      let state;
      try {
        state = await getCallState(callId);
        logger.info(
          {
            callId,
            stateFound: !!state,
            stateNode: state?.currentNode,
          },
          'Call state retrieval result'
        );
      } catch (redisError: any) {
        logger.error(
          {
            callId,
            error: redisError.message,
            stack: redisError.stack
          },
          'Redis error when retrieving call state'
        );
        const errorContent = "I apologize, I'm having a technical issue. Let me have someone call you right back.";
        if (isStreaming) return buildStreamingResponse(errorContent);
        return NextResponse.json(buildChatCompletionResponse(errorContent));
      }

      if (!state) {
        logger.error({ callId }, 'Call state not found in Redis after retrieval attempt');
        const errorContent = "I apologize, I'm having a technical issue. Let me have someone call you right back.";
        if (isStreaming) return buildStreamingResponse(errorContent);
        return NextResponse.json(buildChatCompletionResponse(errorContent));
      }

      // Early exit: if call is already completed or escalated, send goodbye + endCall
      if (state.status === 'completed' || state.status === 'escalated') {
        logger.info(
          { callId, status: state.status },
          'Call already completed/escalated - returning endCall without processing new turn'
        );
        const goodbyeContent = "Thank you, goodbye!";
        if (isStreaming) return buildStreamingResponse(goodbyeContent, { endCall: true });
        return NextResponse.json(buildChatCompletionResponse(goodbyeContent, { endCall: true }));
      }

      logger.info(
        {
          callId,
          currentNode: state.currentNode,
          userMessageLength: userMessage.length,
          userMessagePreview: userMessage.substring(0, 100),
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
          responseLength: aiResponse.length,
          responsePreview: aiResponse.substring(0, 100),
        },
        'LangGraph processing complete'
      );

      // Check if call should end - when status is 'completed' or 'escalated', tell VAPI to hang up
      const shouldEndCall = newState.status === 'completed' || newState.status === 'escalated';

      if (shouldEndCall) {
        logger.info(
          { callId, status: newState.status, outcome: newState.outcome },
          'Call completed - sending endCall tool_call to VAPI'
        );
      }

      // Return response in OpenAI Chat Completions format
      if (isStreaming) {
        return buildStreamingResponse(aiResponse, { endCall: shouldEndCall });
      }

      return NextResponse.json(buildChatCompletionResponse(aiResponse, { endCall: shouldEndCall }));
    } finally {
      await releaseCallLock(callId);
    }

  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'LangGraph handler error');

    // Return a graceful error in OpenAI format so Vapi can still speak it
    const fallbackContent = "I apologize, I'm having technical difficulties. Let me transfer you to a team member who can help.";
    if (isStreaming) {
      return buildStreamingResponse(fallbackContent);
    }
    return NextResponse.json(buildChatCompletionResponse(fallbackContent));
  }
}

/**
 * GET endpoint for health check / testing
 * Visit: https://partsiqai.com/api/voip/langgraph-handler/chat/completions
 */
export async function GET(req: NextRequest) {
  logger.info({ url: req.url }, 'LangGraph handler health check');
  
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/voip/langgraph-handler/chat/completions',
    message: 'LangGraph Custom LLM Handler is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    expectedAuth: process.env.VOIP_WEBHOOK_SECRET ? 'configured' : 'missing',
  });
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  logger.info({ url: req.url }, 'LangGraph handler CORS preflight');
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
