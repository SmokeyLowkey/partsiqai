import { NextRequest, NextResponse } from 'next/server';
import { workerLogger } from '@/lib/logger';
import OpenAI from 'openai';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';
import {
  getReceptionistState,
  saveReceptionistState,
  type ReceptionistState,
  type ReceptionistMessage,
} from '@/lib/voip/receptionist/state';
import { generateReceptionistPrompt, RECEPTIONIST_TOOLS } from '@/lib/voip/receptionist/system-prompt';
import { getReceptionistConfig, isWithinBusinessHours } from '@/lib/voip/receptionist/config';
import { lookupCaller } from '@/lib/voip/receptionist/caller-lookup';
import { initReceptionistState } from '@/lib/voip/receptionist/state';
import { checkAndIncrementRateLimit, isSpamBlocked } from '@/lib/voip/receptionist/abuse-prevention';

const logger = workerLogger.child({ module: 'receptionist-handler' });

function completionId(): string {
  return `chatcmpl-recep-${crypto.randomUUID()}`;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

function buildResponse(content: string, toolCalls?: ToolCall[]) {
  const message: any = { role: 'assistant', content };
  let finishReason: 'stop' | 'tool_calls' = 'stop';
  if (toolCalls && toolCalls.length > 0) {
    message.tool_calls = toolCalls;
    finishReason = 'tool_calls';
  }
  return {
    id: completionId(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'receptionist-state-machine',
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function buildStreamingResponse(content: string, toolCalls?: ToolCall[]): Response {
  const id = completionId();
  const created = Math.floor(Date.now() / 1000);

  const contentChunk = {
    id,
    object: 'chat.completion.chunk',
    created,
    model: 'receptionist-state-machine',
    choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }],
  };

  const chunks = [`data: ${JSON.stringify(contentChunk)}\n\n`];

  if (toolCalls && toolCalls.length > 0) {
    const toolChunk = {
      id,
      object: 'chat.completion.chunk',
      created,
      model: 'receptionist-state-machine',
      choices: [{ index: 0, delta: { tool_calls: toolCalls }, finish_reason: null }],
    };
    chunks.push(`data: ${JSON.stringify(toolChunk)}\n\n`);
  }

  const finishChunk = {
    id,
    object: 'chat.completion.chunk',
    created,
    model: 'receptionist-state-machine',
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
      },
    ],
  };
  chunks.push(`data: ${JSON.stringify(finishChunk)}\n\n`);
  chunks.push('data: [DONE]\n\n');

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Apply tool call effects to state (e.g. updateState changes node, transferCall sets routing).
 * Returns: { newState, transferDestination?, shouldEndCall }
 */
function processToolCalls(
  state: ReceptionistState,
  toolCalls: ToolCall[]
): { newState: ReceptionistState; transferDestination?: string; shouldEndCall: boolean } {
  let newState = { ...state };
  let transferDestination: string | undefined;
  let shouldEndCall = false;

  for (const tc of toolCalls) {
    let args: any = {};
    try {
      args = JSON.parse(tc.function.arguments || '{}');
    } catch {
      // ignore parse errors
    }

    switch (tc.function.name) {
      case 'updateState': {
        if (args.currentNode) newState.currentNode = args.currentNode;
        if (args.selectedOrgId) newState.selectedOrgId = args.selectedOrgId;
        if (args.selectedCallId) {
          // Find the call across all matches
          for (const m of newState.matches) {
            const found = m.recentCalls.find((c) => c.callId === args.selectedCallId);
            if (found) {
              newState.selectedCall = found;
              newState.selectedOrgId = found.organizationId;
              break;
            }
          }
        }
        if (args.routingChoice) newState.routingChoice = args.routingChoice;
        if (args.messageCallerName) newState.message.callerName = args.messageCallerName;
        if (args.messageCallerCompany) newState.message.callerCompany = args.messageCallerCompany;
        if (args.messageReason) newState.message.reason = args.messageReason;
        if (args.messageCallbackNumber) newState.message.callbackNumber = args.messageCallbackNumber;
        break;
      }
      case 'transferCall': {
        transferDestination = args.destination;
        break;
      }
      case 'endCall': {
        shouldEndCall = true;
        break;
      }
    }
  }

  return { newState, transferDestination, shouldEndCall };
}

export async function POST(req: NextRequest) {
  let isStreaming = false;

  try {
    // Verify auth
    const webhookSecret = process.env.VOIP_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'VOIP_WEBHOOK_SECRET not configured' }, { status: 500 });
    }

    // Vapi sometimes sends the header as "Authorization " (trailing space) — iterate all headers
    // and find any authorization-like header, case-insensitive, space-tolerant.
    let authHeader: string | null = null;
    req.headers.forEach((value, key) => {
      if (key.trim().toLowerCase() === 'authorization') {
        authHeader = value;
      }
    });

    // Normalize: strip all "Bearer " prefixes (Vapi sometimes sends "Bearer Bearer <token>" when
    // the credential value already starts with "Bearer ")
    const token = (authHeader || '').replace(/^(Bearer\s+)+/i, '').trim();
    if (token !== webhookSecret) {
      logger.warn(
        { authHeaderPreview: (authHeader || '').slice(0, 30) },
        'Unauthorized receptionist request'
      );
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    isStreaming = body.stream === true;

    const callId = body.call?.id || body.call?.metadata?.callLogId;
    const callerPhone = body.call?.customer?.number || body.call?.from?.number || body.call?.phoneNumber?.number;

    logger.info(
      {
        callId,
        callerPhone,
        messageCount: body.messages?.length,
        stream: isStreaming,
      },
      'Receptionist handler invoked'
    );

    if (!callId) {
      logger.error('Missing call ID in receptionist request');
      return NextResponse.json(
        buildResponse("I'm sorry, I'm having trouble connecting you. Please try calling back."),
        { status: 200 }
      );
    }

    // Initialize or load state
    let state = await getReceptionistState(callId);

    if (!state) {
      // First turn — initialize state with caller lookup + abuse checks
      if (!callerPhone) {
        logger.warn({ callId }, 'No caller phone — cannot identify');
        return NextResponse.json(
          buildResponse(
            "Thanks for calling PartsIQ. I'm having trouble identifying your number. Could you tell me who you are and what company you're with?"
          )
        );
      }

      const config = await getReceptionistConfig();

      // Spam check
      if (isSpamBlocked(callerPhone, config.spamBlocklist)) {
        logger.info({ callerPhone }, 'Caller is on spam blocklist — ending call');
        return NextResponse.json(
          buildResponse('Goodbye.', [
            { id: `call_${crypto.randomUUID()}`, type: 'function', function: { name: 'endCall', arguments: '{}' } },
          ])
        );
      }

      // Rate limit check
      const rateCheck = await checkAndIncrementRateLimit(callerPhone, config.callerRateLimitPerHour);
      if (!rateCheck.allowed) {
        logger.warn({ callerPhone, count: rateCheck.count }, 'Caller rate limit exceeded');
        return NextResponse.json(
          buildResponse(
            "I see you've called us several times recently. Please try again later. Goodbye.",
            [{ id: `call_${crypto.randomUUID()}`, type: 'function', function: { name: 'endCall', arguments: '{}' } }]
          )
        );
      }

      // Caller lookup
      const matches = await lookupCaller(callerPhone);
      const isAfterHours = !isWithinBusinessHours(config);

      state = initReceptionistState({
        callId,
        vapiCallId: body.call?.id || null,
        callerPhone,
        matches,
        isAfterHours,
        rateLimitExceeded: false,
        maxCallDurationSec: config.maxCallDurationSec,
        identificationTimeoutSec: config.identificationTimeoutSec,
      });

      logger.info(
        {
          callId,
          callerPhone,
          matchCount: matches.length,
          isAfterHours,
          rateLimitCount: rateCheck.count,
        },
        'Receptionist state initialized'
      );

      await saveReceptionistState(callId, state);
    }

    // Check call deadline (max duration)
    if (new Date() > new Date(state.callDeadline)) {
      logger.warn({ callId }, 'Receptionist call exceeded max duration — ending');
      return NextResponse.json(
        buildResponse('I need to wrap up. Please call back if you need more help. Goodbye.', [
          { id: `call_${crypto.randomUUID()}`, type: 'function', function: { name: 'endCall', arguments: '{}' } },
        ])
      );
    }

    // Check identification deadline — force take_message if still in identification phase
    const identificationNodes: typeof state.currentNode[] = [
      'identify_caller',
      'qualify_unknown',
      'disambiguate_org',
      'disambiguate_quote',
    ];
    if (
      identificationNodes.includes(state.currentNode) &&
      new Date() > new Date(state.identificationDeadline)
    ) {
      logger.info({ callId }, 'Identification timeout reached — forcing take_message');
      state.currentNode = 'take_message';
      await saveReceptionistState(callId, state);
    }

    // Append the latest user message to history
    const lastMessage = body.messages?.[body.messages.length - 1];
    if (lastMessage?.role === 'user' && lastMessage.content) {
      state.conversationHistory.push({
        role: 'user',
        content: lastMessage.content,
        timestamp: new Date().toISOString(),
      });
    }

    // Build system prompt and call LLM
    const systemPrompt = generateReceptionistPrompt(state);

    // Get OpenRouter credentials (reuse platform creds since receptionist is platform-level)
    const credentialsManager = new CredentialsManager();
    const orCreds = await credentialsManager.getCredentialsWithFallback<{
      apiKey: string;
      voiceModel?: string;
    }>('system-platform-credentials', 'OPENROUTER');

    if (!orCreds?.apiKey) {
      logger.error('OpenRouter credentials missing for receptionist');
      return NextResponse.json(
        buildResponse("I'm having technical difficulties. Please call back in a moment.")
      );
    }

    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: orCreds.apiKey,
      defaultHeaders: { 'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://quotarc.com', 'X-Title': 'PartsIQ' },
    });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...state.conversationHistory.map((m) => ({ role: m.role, content: m.content })),
    ];

    const completion = await openai.chat.completions.create({
      model: orCreds.voiceModel || 'openai/gpt-4o-mini',
      messages,
      temperature: 0.5,
      max_tokens: 200,
      tools: RECEPTIONIST_TOOLS as any,
      tool_choice: 'auto',
    });

    const aiMessage = completion.choices[0].message;
    const aiContent = aiMessage.content || '';
    const aiToolCalls = (aiMessage.tool_calls || []) as ToolCall[];

    // Persist assistant turn
    if (aiContent) {
      state.conversationHistory.push({
        role: 'assistant',
        content: aiContent,
        timestamp: new Date().toISOString(),
      });
    }

    // Process tool calls (state updates, transfer, end)
    let transferDestination: string | undefined;
    let shouldEndCall = false;

    if (aiToolCalls.length > 0) {
      const result = processToolCalls(state, aiToolCalls);
      state = result.newState;
      transferDestination = result.transferDestination;
      shouldEndCall = result.shouldEndCall;
    }

    await saveReceptionistState(callId, state);

    // Build outgoing tool calls for Vapi
    const outgoingToolCalls: ToolCall[] = [];

    if (transferDestination) {
      outgoingToolCalls.push({
        id: `call_${crypto.randomUUID()}`,
        type: 'function',
        function: {
          name: 'transferCall',
          arguments: JSON.stringify({ destination: transferDestination }),
        },
      });
    }

    if (shouldEndCall) {
      outgoingToolCalls.push({
        id: `call_${crypto.randomUUID()}`,
        type: 'function',
        function: { name: 'endCall', arguments: '{}' },
      });
    }

    const responseContent = aiContent || 'One moment please.';

    if (isStreaming) {
      return buildStreamingResponse(responseContent, outgoingToolCalls.length > 0 ? outgoingToolCalls : undefined);
    }
    return NextResponse.json(buildResponse(responseContent, outgoingToolCalls.length > 0 ? outgoingToolCalls : undefined));
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Receptionist handler error');
    const fallback = "I'm having technical difficulties. Please call back in a moment.";
    if (isStreaming) return buildStreamingResponse(fallback);
    return NextResponse.json(buildResponse(fallback), { status: 200 });
  }
}
