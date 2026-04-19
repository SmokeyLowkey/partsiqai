import { NextRequest, NextResponse } from 'next/server';
import { workerLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getReceptionistState, deleteReceptionistState } from '@/lib/voip/receptionist/state';

const logger = workerLogger.child({ module: 'receptionist-webhooks' });

/**
 * Vapi webhooks for the receptionist assistant.
 * Handles call lifecycle events (call-started, call-ended, end-of-call-report).
 * Persists messages to InboundMessage when the receptionist took a message.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify auth — Vapi sends both X-Vapi-Secret header and Authorization Bearer <token>
    // depending on which webhook secret / credential is configured. Accept either.
    // Also: Vapi sometimes uses a trailing space in "Authorization " header name.
    const vapiSecret = req.headers.get('x-vapi-secret');
    let authHeader: string | null = null;
    req.headers.forEach((value, key) => {
      if (key.trim().toLowerCase() === 'authorization') {
        authHeader = value;
      }
    });
    const vapiWebhookSecret = process.env.VAPI_WEBHOOK_SECRET;
    const voipWebhookSecret = process.env.VOIP_WEBHOOK_SECRET;

    const bearerToken = (authHeader || '').replace(/^(Bearer\s+)+/i, '').trim();

    const vapiSecretValid = vapiWebhookSecret && vapiSecret === vapiWebhookSecret;
    const bearerValid =
      (voipWebhookSecret && bearerToken === voipWebhookSecret) ||
      (vapiWebhookSecret && bearerToken === vapiWebhookSecret);

    if (!vapiSecretValid && !bearerValid) {
      logger.warn(
        {
          hasVapiSecret: !!vapiSecret,
          hasAuthHeader: !!authHeader,
          authHeaderPreview: (authHeader || '').slice(0, 30),
        },
        'Invalid auth on receptionist webhook'
      );
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const event = body.message || body;
    const eventType = event.type;
    const vapiCallId = event.call?.id || body.call?.id;
    const callId = event.call?.id || vapiCallId;

    logger.info(
      { eventType, callId, vapiCallId },
      'Receptionist webhook event received'
    );

    switch (eventType) {
      case 'call-started': {
        // State is initialized lazily on first chat completion request
        return NextResponse.json({ ok: true });
      }

      case 'call-ended':
      case 'end-of-call-report': {
        await handleCallEnded(callId, event);
        return NextResponse.json({ ok: true });
      }

      case 'status-update':
      case 'transcript':
      case 'speech-update':
      case 'conversation-update':
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json({ ok: true, ignored: eventType });
    }
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Receptionist webhook error');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCallEnded(callId: string | undefined, event: any) {
  if (!callId) return;

  const state = await getReceptionistState(callId);
  if (!state) {
    logger.info({ callId }, 'No receptionist state found for ended call (may be cleaned up)');
    return;
  }

  // If we collected a message OR call ended without successful routing, persist as InboundMessage
  const hasMessage =
    state.message.callerName ||
    state.message.callerCompany ||
    state.message.callbackNumber ||
    state.message.reason;

  // Persist message if we collected info OR if call ended without resolution
  const shouldPersist =
    hasMessage ||
    (state.currentNode === 'take_message') ||
    (state.matches.length > 0 && !state.selectedCall && state.currentNode !== 'transfer_to_human' && state.currentNode !== 'transfer_to_agent');

  if (shouldPersist) {
    try {
      // Determine supplier + org if we matched
      let supplierId: string | null = null;
      let organizationId: string | null = null;

      if (state.selectedCall) {
        // Used selected call's org
        organizationId = state.selectedCall.organizationId;
        // Find the supplier from matches
        for (const m of state.matches) {
          if (m.recentCalls.some((c) => c.callId === state.selectedCall!.callId)) {
            supplierId = m.supplier.id;
            break;
          }
        }
      } else if (state.matches.length === 1) {
        // Single match — use it
        supplierId = state.matches[0].supplier.id;
        organizationId = state.matches[0].supplier.organizationId;
      }

      await prisma.inboundMessage.create({
        data: {
          callerPhone: state.callerPhone,
          callerName: state.message.callerName || null,
          callerCompany: state.message.callerCompany || null,
          reason: state.message.reason || null,
          callbackNumber: state.message.callbackNumber || state.callerPhone,
          vapiCallId: state.vapiCallId,
          supplierId,
          organizationId,
        },
      });

      logger.info(
        { callId, supplierId, organizationId },
        'Inbound message persisted'
      );
    } catch (dbError: any) {
      logger.error({ callId, error: dbError.message }, 'Failed to persist inbound message');
    }
  }

  // Clean up Redis state
  await deleteReceptionistState(callId);
  logger.info({ callId, finalNode: state.currentNode }, 'Receptionist call cleaned up');
}
