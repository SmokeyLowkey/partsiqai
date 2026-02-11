import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCallState, saveCallState, deleteCallState } from '@/lib/voip/state-manager';
import { processCallTurn } from '@/lib/voip/call-graph';
import { getLastAIMessage, determineOutcome, addMessage } from '@/lib/voip/helpers';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';

/**
 * Vapi.ai Webhook Handler
 * 
 * Receives events during phone calls and processes them through LangGraph
 */
export async function POST(req: NextRequest) {
  try {
    const event = await req.json();
    
    // Verify webhook signature (in production)
    const signature = req.headers.get('x-vapi-signature');
    if (process.env.NODE_ENV === 'production' && signature) {
      // TODO: Implement signature verification
      // const isValid = verifyVapiSignature(signature, JSON.stringify(event));
      // if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const callId = event.metadata?.callId;
    
    if (!callId) {
      console.warn('Webhook event missing callId:', event.type);
      return NextResponse.json({ ok: true });
    }

    console.log(`[VOIP Webhook] ${event.type} for call ${callId}`);

    switch (event.type) {
      case 'call-started':
        await handleCallStarted(callId, event);
        break;

      case 'transcript':
        if (event.transcript.role === 'user') {
          await handleSupplierResponse(callId, event.transcript.text);
        }
        break;

      case 'call-ended':
        await handleCallEnded(callId, event);
        break;

      case 'error':
        await handleCallError(callId, event);
        break;

      case 'status-update':
        await handleStatusUpdate(callId, event);
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCallStarted(callId: string, event: any) {
  await prisma.supplierCall.update({
    where: { id: callId },
    data: {
      status: 'ANSWERED',
      answeredAt: new Date(),
    },
  });
}

async function handleSupplierResponse(callId: string, text: string) {
  // Get current state
  const state = await getCallState(callId);
  if (!state) {
    console.error(`Call state not found for ${callId}`);
    return;
  }

  // Create LLM client for organization
  const llmClient = await OpenRouterClient.fromOrganization(state.organizationId);

  // Add supplier response to conversation
  const stateWithResponse = addMessage(state, 'supplier', text);

  // Process through graph to get next AI response
  const newState = await processCallTurn(llmClient, stateWithResponse);

  // Save updated state
  await saveCallState(callId, newState);

  // Update database with conversation log
  await prisma.supplierCall.update({
    where: { id: callId },
    data: {
      conversationLog: newState.conversationHistory,
      status: newState.status === 'escalated' ? 'HUMAN_ESCALATED' : 'IN_PROGRESS',
    },
  });

  // Return next AI message to Vapi
  const nextMessage = getLastAIMessage(newState);
  
  // Check if call should end
  if (newState.status === 'completed' || newState.status === 'escalated') {
    // Let Vapi know to end the call after this message
    return NextResponse.json({
      say: nextMessage,
      endCall: true,
    });
  }

  return NextResponse.json({ say: nextMessage });
}

async function handleCallEnded(callId: string, event: any) {
  const state = await getCallState(callId);

  // Extract final outcome
  const outcome = state ? determineOutcome(state) : 'NO_ANSWER';

  // Get call record
  const call = await prisma.supplierCall.findUnique({
    where: { id: callId },
  });

  if (!call) {
    console.error(`Call record not found: ${callId}`);
    return;
  }

  // Extract quotes from final state
  const extractedQuotes = state?.quotes.filter(q => q.price) || [];

  // Update call record
  await prisma.supplierCall.update({
    where: { id: callId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
      duration: event.durationSeconds || 0,
      recordingUrl: event.recordingUrl,
      conversationLog: state?.conversationHistory || [],
      extractedQuotes: extractedQuotes.length > 0 ? extractedQuotes : undefined,
      outcome: outcome as any,
      notes: state?.nextAction ? `Next action: ${state.nextAction}` : undefined,
    },
  });

  // If quote received, create SupplierQuoteItems
  if (extractedQuotes.length > 0 && call.quoteRequestId) {
    await createSupplierQuoteItems(
      call.quoteRequestId,
      call.supplierId,
      extractedQuotes
    );
  }

  // Handle next actions
  if (state?.nextAction === 'email_fallback') {
    // TODO: Queue email fallback job
    console.log(`[VOIP] Scheduling email fallback for call ${callId}`);
  }

  if (state?.nextAction === 'human_followup') {
    // TODO: Create notification for manager
    console.log(`[VOIP] Creating notification for human follow-up on call ${callId}`);
  }

  // Clean up Redis state
  await deleteCallState(callId);
}

async function handleCallError(callId: string, event: any) {
  await prisma.supplierCall.update({
    where: { id: callId },
    data: {
      status: 'FAILED',
      endedAt: new Date(),
      notes: `Error: ${event.error?.message || 'Unknown error'}`,
    },
  });

  // Clean up Redis state
  await deleteCallState(callId);
}

async function handleStatusUpdate(callId: string, event: any) {
  const statusMapping: Record<string, any> = {
    'ringing': 'RINGING',
    'answered': 'ANSWERED',
    'busy': 'BUSY',
    'no-answer': 'NO_ANSWER',
    'voicemail': 'VOICEMAIL',
  };

  const status = statusMapping[event.status] || event.status;

  // Handle voicemail detection
  if (status === 'VOICEMAIL') {
    const state = await getCallState(callId);
    if (state) {
      const { voicemailNode } = await import('@/lib/voip/call-graph');
      const stateWithVoicemail = voicemailNode(state);
      await saveCallState(callId, stateWithVoicemail);

      const voicemailMessage = getLastAIMessage(stateWithVoicemail);
      
      await prisma.supplierCall.update({
        where: { id: callId },
        data: {
          status: 'VOICEMAIL',
          conversationLog: stateWithVoicemail.conversationHistory,
          outcome: 'VOICEMAIL_LEFT',
        },
      });

      // Return voicemail message to Vapi
      return NextResponse.json({
        say: voicemailMessage,
        endCall: true,
      });
    }
  }

  await prisma.supplierCall.update({
    where: { id: callId },
    data: { status },
  });
}

/**
 * Create SupplierQuoteItems from extracted call data
 */
async function createSupplierQuoteItems(
  quoteRequestId: string,
  supplierId: string,
  extractedQuotes: any[]
) {
  const quoteRequest = await prisma.quoteRequest.findUnique({
    where: { id: quoteRequestId },
    include: { items: true },
  });

  if (!quoteRequest) return;

  for (const quote of extractedQuotes) {
    // Find matching quote request item
    const item = quoteRequest.items.find(
      (i) => i.partNumber === quote.partNumber
    );

    if (!item) continue;

    // Create or update supplier quote item
    await prisma.supplierQuoteItem.upsert({
      where: {
        quoteRequestItemId_supplierId: {
          quoteRequestItemId: item.id,
          supplierId: supplierId,
        },
      },
      create: {
        quoteRequestItemId: item.id,
        supplierId: supplierId,
        unitPrice: quote.price,
        totalPrice: quote.price * item.quantity,
        availability: (quote.availability?.toUpperCase() || 'UNKNOWN') as any,
        leadTimeDays: quote.leadTimeDays,
        notes: quote.notes || 'Received via phone call',
      },
      update: {
        unitPrice: quote.price,
        totalPrice: quote.price * item.quantity,
        availability: (quote.availability?.toUpperCase() || 'UNKNOWN') as any,
        leadTimeDays: quote.leadTimeDays,
        notes: quote.notes || 'Received via phone call',
      },
    });
  }
}
