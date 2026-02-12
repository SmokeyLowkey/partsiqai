import { NextRequest, NextResponse } from 'next/server';
import { getCallState, saveCallState } from '@/lib/voip/state-manager';
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
function buildChatCompletionResponse(content: string, finishReason: string = 'stop') {
  return {
    id: completionId(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'langgraph-state-machine',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
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
function buildStreamingResponse(content: string): Response {
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

  // Chunk 2: finish
  const chunk2 = {
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

  const body = [
    `data: ${JSON.stringify(chunk1)}\n\n`,
    `data: ${JSON.stringify(chunk2)}\n\n`,
    `data: [DONE]\n\n`,
  ].join('');

  return new Response(body, {
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
  let isStreaming = false;

  try {
    // Verify authorization
    const authHeader = req.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.VOIP_WEBHOOK_SECRET || 'dev-secret'}`;

    if (process.env.NODE_ENV === 'production' && authHeader !== expectedAuth) {
      logger.warn({ authHeader }, 'Unauthorized LangGraph handler request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
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

    // Return response in OpenAI Chat Completions format
    if (isStreaming) {
      return buildStreamingResponse(aiResponse);
    }
    return NextResponse.json(buildChatCompletionResponse(aiResponse));

  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'LangGraph handler error');

    // Return a graceful error in OpenAI format so Vapi can still speak it
    const fallbackContent = "I apologize, I'm having technical difficulties. Let me transfer you to a team member who can help.";
    if (isStreaming) {
      return buildStreamingResponse(fallbackContent);
    }
    return NextResponse.json(buildChatCompletionResponse(fallbackContent, 'stop'));
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
