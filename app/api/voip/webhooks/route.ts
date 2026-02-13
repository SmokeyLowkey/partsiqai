import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCallState, saveCallState, deleteCallState } from '@/lib/voip/state-manager';
import { processCallTurn, initializeCallState } from '@/lib/voip/call-graph';
import { getLastAIMessage, determineOutcome, addMessage } from '@/lib/voip/helpers';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { workerLogger } from '@/lib/logger';

const logger = workerLogger.child({ module: 'voip-webhooks' });

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

    // Extract callLogId from metadata (matches what worker sets when creating call)
    // Handle different event structures (call-started, transcript, end-of-call-report)
    const callId = event.metadata?.callLogId || 
                   event.call?.metadata?.callLogId || 
                   event.message?.call?.metadata?.callLogId;
    
    // Extract VAPI call ID from event (UUID format like 019c57c9-1381-7227-8d2e-bd56f788bc8f)
    const vapiCallId = event.call?.id || 
                       event.id || 
                       event.message?.call?.id;
    
    if (!callId) {
      const eventType = event.type || event.message?.type;
      console.warn('Webhook event missing callLogId:', eventType, {
        hasEventMetadata: !!event.metadata,
        hasEventCall: !!event.call,
        hasEventMessage: !!event.message,
        messageType: event.message?.type,
      });
      return NextResponse.json({ ok: true });
    }

    // Handle both top-level event.type and event.message.type (for end-of-call-report)
    const eventType = event.type || event.message?.type;
    console.log(`[VOIP Webhook] ${eventType} for call ${callId}`);

    switch (eventType) {
      case 'call-started':
        await handleCallStarted(callId, vapiCallId, event);
        break;

      case 'transcript':
        if (event.transcript?.role === 'user') {
          await handleSupplierResponse(callId, event.transcript.text);
        }
        break;

      case 'call-ended':
      case 'end-of-call-report':
        await handleCallEnded(callId, vapiCallId, event.message || event);
        break;

      case 'error':
        await handleCallError(callId, vapiCallId, event);
        break;

      case 'status-update':
        await handleStatusUpdate(callId, vapiCallId, event);
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

async function handleCallStarted(callId: string, vapiCallId: string | undefined, event: any) {
  // Get call record from database to extract context
  const call = await prisma.supplierCall.findUnique({
    where: { id: callId },
    include: {
      quoteRequest: {
        include: {
          items: true,
        },
      },
      supplier: true,
    },
  });

  if (!call) {
    logger.error({ callId }, 'Call record not found for handleCallStarted');
    return;
  }

  logger.info(
    { callId, vapiCallId, quoteRequestId: call.quoteRequestId, supplierId: call.supplierId },
    'Handling call started webhook'
  );

  // Check if state already exists (initialized by worker before VAPI call)
  const existingState = await getCallState(call.id);
  if (existingState) {
    logger.info(
      { callId, currentNode: existingState.currentNode },
      'Call state already initialized by worker, skipping re-initialization'
    );
    
    // Update database status and ensure VAPI call ID is saved (handles race condition)
    const updateData: any = {
      status: 'ANSWERED',
      answeredAt: new Date(),
    };
    
    // Only update vapiCallId if we have it and DB doesn't
    if (vapiCallId && !call.vapiCallId) {
      updateData.vapiCallId = vapiCallId;
      logger.info({ callId, vapiCallId }, 'Saved VAPI call ID from webhook (race condition handled)');
    }
    
    await prisma.supplierCall.update({
      where: { id: callId },
      data: updateData,
    });
    return;
  }

  logger.info({ callId }, 'Initializing call state from webhook (fallback)');

  // Extract parts information from quote request
  const parts = call.quoteRequest?.items.map(item => ({
    partNumber: item.partNumber,
    description: item.description || '',
    quantity: item.quantity,
    budgetMax: undefined, // Could add budget tracking later
  })) || [];

  // Extract custom context from conversationLog if available
  const conversationLog = call.conversationLog as any;
  const customContext = conversationLog?.context?.customContext;
  const customInstructions = conversationLog?.context?.customInstructions;

  // Initialize LangGraph state
  const initialState = initializeCallState({
    callId: call.id,
    quoteRequestId: call.quoteRequestId || '',
    supplierId: call.supplierId || '',
    supplierName: call.supplier?.name || 'the supplier',
    supplierPhone: call.phoneNumber,
    organizationId: call.organizationId,
    callerId: call.callerId || '',
    parts,
    customContext: customContext,
    customInstructions: customInstructions,
  });

  // Save initial state to Redis
  await saveCallState(call.id, initialState);

  logger.info(
    { 
      callId, 
      partsCount: parts.length, 
      hasCustomContext: !!customContext,
      initialNode: initialState.currentNode 
    },
    'Call state initialized successfully'
  );

  // Update database status and save VAPI call ID
  const updateData: any = {
    status: 'ANSWERED',
    answeredAt: new Date(),
  };
  
  if (vapiCallId && !call.vapiCallId) {
    updateData.vapiCallId = vapiCallId;
    logger.info({ callId, vapiCallId }, 'Saved VAPI call ID from webhook (fallback initialization)');
  }
  
  await prisma.supplierCall.update({
    where: { id: callId },
    data: updateData,
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

  // Get existing call record to preserve context data
  const existingCall = await prisma.supplierCall.findUnique({
    where: { id: callId },
    select: { conversationLog: true },
  });
  
  const existingLog = (existingCall?.conversationLog as any) || {};

  // Update database with conversation log - preserve context, add conversationHistory
  await prisma.supplierCall.update({
    where: { id: callId },
    data: {
      conversationLog: {
        ...existingLog,
        conversationHistory: newState.conversationHistory,
        currentNode: newState.currentNode,
        status: newState.status,
        negotiationAttempts: newState.negotiationAttempts,
        clarificationAttempts: newState.clarificationAttempts,
      },
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

async function handleCallEnded(callId: string, vapiCallId: string | undefined, event: any) {
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

  // Get existing call record to preserve context data
  const existingLog = (call.conversationLog as any) || {};

  // Update call record with all final data
  const updateData: any = {
    status: 'COMPLETED',
    endedAt: new Date(),
    duration: event.durationSeconds || 0,
    recordingUrl: event.recordingUrl,
    conversationLog: {
      ...existingLog,
      conversationHistory: state?.conversationHistory || [],
      currentNode: state?.currentNode,
      status: state?.status,
      outcome: outcome,
      negotiationAttempts: state?.negotiationAttempts,
      clarificationAttempts: state?.clarificationAttempts,
      contactName: state?.contactName,
      contactRole: state?.contactRole,
      nextAction: state?.nextAction,
      needsHumanEscalation: state?.needsHumanEscalation,
    },
    extractedQuotes: extractedQuotes.length > 0 ? extractedQuotes : undefined,
    outcome: outcome as any,
    notes: state?.nextAction ? `Next action: ${state.nextAction}` : undefined,
  };
  
  // Ensure VAPI call ID is saved (critical for fetching call details from VAPI later)
  if (vapiCallId && !call.vapiCallId) {
    updateData.vapiCallId = vapiCallId;
    logger.info({ callId, vapiCallId }, 'Saved VAPI call ID from end-of-call webhook');
  }
  
  await prisma.supplierCall.update({
    where: { id: callId },
    data: updateData,
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

async function handleCallError(callId: string, vapiCallId: string | undefined, event: any) {
  // Get call to check if vapiCallId is missing
  const call = await prisma.supplierCall.findUnique({ where: { id: callId } });
  
  const updateData: any = {
    status: 'FAILED',
    endedAt: new Date(),
    notes: `Error: ${event.error?.message || 'Unknown error'}`,
  };
  
  if (vapiCallId && call && !call.vapiCallId) {
    updateData.vapiCallId = vapiCallId;
  }
  
  await prisma.supplierCall.update({
    where: { id: callId },
    data: updateData,
  });

  // Clean up Redis state
  await deleteCallState(callId);
}

async function handleStatusUpdate(callId: string, vapiCallId: string | undefined, event: any) {
  const statusMapping: Record<string, any> = {
    'ringing': 'RINGING',
    'answered': 'ANSWERED',
    'busy': 'BUSY',
    'no-answer': 'NO_ANSWER',
    'voicemail': 'VOICEMAIL',
  };

  const status = statusMapping[event.status] || event.status;
  
  // Get call to check if vapiCallId is missing
  const call = await prisma.supplierCall.findUnique({ where: { id: callId } });

  // Handle voicemail detection
  if (status === 'VOICEMAIL') {
    const state = await getCallState(callId);
    if (state) {
      const { voicemailNode } = await import('@/lib/voip/call-graph');
      const stateWithVoicemail = voicemailNode(state);
      await saveCallState(callId, stateWithVoicemail);

      const voicemailMessage = getLastAIMessage(stateWithVoicemail);
      
      // Get existing call record to preserve context
      const existingCall = await prisma.supplierCall.findUnique({
        where: { id: callId },
        select: { conversationLog: true },
      });
      const existingLog = (existingCall?.conversationLog as any) || {};
      
      await prisma.supplierCall.update({
        where: { id: callId },
        data: {
          status: 'VOICEMAIL',
          conversationLog: {
            ...existingLog,
            conversationHistory: stateWithVoicemail.conversationHistory,
            currentNode: stateWithVoicemail.currentNode,
            status: stateWithVoicemail.status,
          },
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

  const updateData: any = { status };
  
  if (vapiCallId && call && !call.vapiCallId) {
    updateData.vapiCallId = vapiCallId;
    logger.info({ callId, vapiCallId }, 'Saved VAPI call ID from status update');
  }
  
  await prisma.supplierCall.update({
    where: { id: callId },
    data: updateData,
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
