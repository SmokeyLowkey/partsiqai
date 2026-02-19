import { NextRequest, NextResponse } from 'next/server';
import { getCallState, saveCallState, acquireCallLock, releaseCallLock } from '@/lib/voip/state-manager';
import { processCallTurn, streamConversationalResponse, routeFromConversationalResponse } from '@/lib/voip/call-graph';
import { getLastAIMessage, addMessage } from '@/lib/voip/helpers';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { CallState } from '@/lib/voip/types';
import { runOverseerAsync, consumeNudge, OverseerNudge } from '@/lib/voip/overseer';
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

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

/**
 * Wait up to `timeoutMs` for an Overseer nudge to appear in Redis.
 * Checks immediately, then polls once after the timeout. Imperceptible to the user
 * (~150ms) but gives the Overseer time to finish analyzing the previous turn.
 */
async function waitForNudge(callId: string, timeoutMs: number = 150): Promise<OverseerNudge | null> {
  // Check immediately — nudge may already be staged
  let nudge = await consumeNudge(callId);
  if (nudge) return nudge;

  // Wait and check once more
  await new Promise(resolve => setTimeout(resolve, timeoutMs));
  nudge = await consumeNudge(callId);
  return nudge;
}

/**
 * Build a true streaming response for conversational_response nodes.
 * Streams LLM tokens sentence-by-sentence via SSE, then runs routing and saves state.
 * Lock is released inside the stream (not by the caller's finally block).
 */
function buildTrueStreamingResponse(
  callId: string,
  llmClient: OpenRouterClient,
  stateWithMessage: CallState,
  previousNode: string,
  nudge?: OverseerNudge | null,
): Response {
  const id = completionId();
  const created = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  let isFirstChunk = true;
  let sentenceCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const sendContentChunk = (content: string) => {
          const chunk: any = {
            id,
            object: 'chat.completion.chunk',
            created,
            model: 'langgraph-state-machine',
            choices: [{
              index: 0,
              delta: isFirstChunk
                ? { role: 'assistant', content }
                : { content },
              finish_reason: null,
            }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          isFirstChunk = false;
          sentenceCount++;
        };

        // Stream the conversational response sentence by sentence
        const stateAfterResponse = await streamConversationalResponse(
          llmClient,
          stateWithMessage,
          sendContentChunk,
          nudge,
        );

        // Run routing to determine next node (happens while VAPI is speaking)
        let { nextNode, state: routedState } = await routeFromConversationalResponse(
          llmClient,
          stateAfterResponse,
        );

        // Phase transition override: if the Overseer nudge includes a phase transition,
        // override routing to enforce the new phase (mirrors processCallTurn logic).
        if (nudge?.phaseTransition) {
          const phaseNodeMap: Record<string, string> = {
            NEGOTIATE: 'negotiate',
            FINALIZE: 'confirmation',
          };
          const overrideNode = phaseNodeMap[nudge.phaseTransition];
          if (overrideNode && nextNode !== 'polite_end' && nextNode !== 'end' &&
              routedState.status !== 'completed' && routedState.status !== 'escalated') {
            nextNode = overrideNode;
          }
        }

        const finalState = { ...routedState, currentNode: nextNode };
        const shouldEndCall = finalState.status === 'completed' || finalState.status === 'escalated';

        if (shouldEndCall) {
          // Send endCall tool_call chunk
          const toolCallChunk = {
            id,
            object: 'chat.completion.chunk',
            created,
            model: 'langgraph-state-machine',
            choices: [{
              index: 0,
              delta: {
                tool_calls: [{
                  index: 0,
                  id: `call_end_${crypto.randomUUID()}`,
                  type: 'function',
                  function: { name: 'endCall', arguments: '{}' },
                }],
              },
              finish_reason: null,
            }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolCallChunk)}\n\n`));
        }

        // Send finish chunk
        const finishChunk = {
          id,
          object: 'chat.completion.chunk',
          created,
          model: 'langgraph-state-machine',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: shouldEndCall ? 'tool_calls' : 'stop',
          }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finishChunk)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));

        // Save state and release lock AFTER streaming completes
        await saveCallState(callId, finalState);

        const aiResponse = getLastAIMessage(finalState);
        logger.info(
          {
            callId,
            previousNode,
            newNode: finalState.currentNode,
            status: finalState.status,
            responseLength: aiResponse.length,
            sentenceChunks: sentenceCount,
            streaming: true,
          },
          'Streaming LangGraph processing complete'
        );

        // Fire Overseer async for this turn (nudge for next turn)
        runOverseerAsync(callId, llmClient, finalState).catch(err =>
          logger.error({ callId, error: err.message }, 'Overseer async error (streaming path)')
        );
      } catch (error: any) {
        logger.error({ callId, error: error.message }, 'Streaming response error — sending fallback');

        // Send fallback response
        const fallback = "Could you repeat that?";
        const fallbackChunk = {
          id,
          object: 'chat.completion.chunk',
          created,
          model: 'langgraph-state-machine',
          choices: [{
            index: 0,
            delta: { role: 'assistant', content: fallback },
            finish_reason: null,
          }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallbackChunk)}\n\n`));
        const finishChunk = {
          id,
          object: 'chat.completion.chunk',
          created,
          model: 'langgraph-state-machine',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finishChunk)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));

        // Best-effort state save
        try {
          const fallbackState = addMessage(stateWithMessage, 'ai', fallback);
          await saveCallState(callId, { ...fallbackState, currentNode: 'conversational_response' });
        } catch { /* best effort */ }
      } finally {
        await releaseCallLock(callId);
        controller.close();
      }
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
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
  logger.info({
    url: req.url,
    contentType: req.headers.get('content-type'),
  }, 'LangGraph handler request received');
  
  let isStreaming = false;

  try {
    // Verify authorization - check VOIP_WEBHOOK_SECRET from environment
    const authHeader = req.headers.get('authorization');
    const webhookSecret = process.env.VOIP_WEBHOOK_SECRET;

    // Only enforce auth if VOIP_WEBHOOK_SECRET is configured
    if (webhookSecret) {
      const expectedAuth = `Bearer ${webhookSecret}`;

      if (authHeader !== expectedAuth) {
        logger.warn({
          authHeaderPreview: authHeader?.substring(0, 20),
        }, 'Unauthorized LangGraph handler request - auth mismatch');
        return NextResponse.json({
          error: 'Unauthorized',
          message: 'Invalid authorization header'
        }, { status: 401 });
      }

      logger.debug('Authorization check passed');
    } else {
      logger.warn(
        'VOIP_WEBHOOK_SECRET not configured - skipping auth check (set in Vercel environment variables for production)'
      );
    }

    const body = await req.json();

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
      // First turn: VAPI may send only system + assistant messages (no user message yet)
      // when using assistant-speaks-first-with-model-generated-message mode.
      // Return the greeting already seeded in call state instead of an error.
      if (callId) {
        try {
          const existingState = await getCallState(callId);
          if (existingState) {
            const greeting = getLastAIMessage(existingState);
            if (greeting) {
              logger.info(
                { callId, greetingLength: greeting.length },
                'First turn (no user message) — returning seeded greeting from call state'
              );
              if (isStreaming) return buildStreamingResponse(greeting);
              return NextResponse.json(buildChatCompletionResponse(greeting));
            }
          }
        } catch (stateError: any) {
          logger.warn({ callId, error: stateError.message }, 'Failed to load state for first-turn greeting');
        }
      }

      // Genuine missing user message (not first turn) — use a natural filler
      logger.warn(
        { messages: body.messages?.map((m: any) => ({ role: m.role, len: m.content?.length })) },
        'No user message found in messages array'
      );
      const fillerContent = "Mhm.";
      if (isStreaming) return buildStreamingResponse(fillerContent);
      return NextResponse.json(buildChatCompletionResponse(fillerContent));
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
      // Another request is processing — retry up to 3 times at 500ms intervals
      for (let i = 0; i < 3 && !lockAcquired; i++) {
        logger.warn({ callId, attempt: i + 1 }, 'Call lock busy, retrying in 500ms');
        await new Promise(resolve => setTimeout(resolve, 500));
        lockAcquired = await acquireCallLock(callId);
      }
      if (!lockAcquired) {
        logger.warn({ callId }, 'Could not acquire lock after 3 retries — returning minimal ack');
        const busyContent = "Mhm.";
        if (isStreaming) return buildStreamingResponse(busyContent);
        return NextResponse.json(buildChatCompletionResponse(busyContent));
      }
    }

    let streamingPathTaken = false;
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

      // Add supplier's message to conversation history and increment turn counter
      const stateWithMessage = addMessage(state, 'supplier', userMessage);
      stateWithMessage.turnNumber = (stateWithMessage.turnNumber || 0) + 1;

      // Wait for Overseer nudge (150ms gate — imperceptible to user)
      let nudge: OverseerNudge | null = null;
      try {
        nudge = await waitForNudge(callId);
        if (nudge) {
          // Stale nudge check — use real elapsed time, not turn counter (avoids race
          // when agent processes turns faster than Overseer finishes analyzing).
          const ageMs = Date.now() - nudge.timestamp;
          const isStale =
            (nudge.priority === 'P2' && ageMs > 15_000) ||   // P2: discard after 15s
            (nudge.priority === 'P1' && ageMs > 30_000) ||   // P1: discard after 30s
            (nudge.priority === 'P0' && ageMs > 60_000);     // P0: discard after 60s
          if (isStale) {
            logger.debug({ callId, priority: nudge.priority, ageMs }, 'Discarding stale nudge');
            nudge = null;
          } else {
            logger.info({ callId, priority: nudge.priority, source: nudge.source, text: nudge.text.substring(0, 100) }, 'Overseer nudge consumed');
          }
        }
      } catch (nudgeError: any) {
        logger.warn({ callId, error: nudgeError.message }, 'Failed to consume nudge — proceeding without');
      }

      // Use true streaming for conversational_response nodes to reduce dead air.
      // The streaming path returns a ReadableStream Response immediately and handles
      // its own lock release + state save after the stream completes.
      if (isStreaming && state.currentNode === 'conversational_response') {
        logger.info(
          { callId, currentNode: state.currentNode, hasNudge: !!nudge },
          'Using true LLM streaming for conversational_response'
        );
        // Lock is released inside buildTrueStreamingResponse — do NOT release in finally
        streamingPathTaken = true;
        return buildTrueStreamingResponse(callId, llmClient, stateWithMessage, state.currentNode, nudge);
      }

      // Non-streaming path (all other nodes, or non-streaming VAPI requests)
      const newState = await processCallTurn(llmClient, stateWithMessage, nudge);

      // Save updated state back to Redis
      await saveCallState(callId, newState);

      // Fire Overseer async for this turn (nudge for next turn)
      runOverseerAsync(callId, llmClient, newState).catch(err =>
        logger.error({ callId, error: err.message }, 'Overseer async error (non-streaming path)')
      );

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
      // Streaming path manages its own lock release inside the ReadableStream
      if (!streamingPathTaken) {
        await releaseCallLock(callId);
      }
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
