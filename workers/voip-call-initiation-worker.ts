import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { QUEUE_NAMES, voipFallbackQueue, voipCallRetryQueue } from '@/lib/queue/queues';
import { VoipCallInitiationJobData } from '@/lib/queue/types';
import { workerLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { CallStatus } from '@prisma/client';
import { trackOverageUsage } from '@/lib/billing/overage-billing';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';
import { initializeCallState } from '@/lib/voip/call-graph';
import { saveCallState } from '@/lib/voip/state-manager';

interface VapiCredentials {
  apiKey: string;
  phoneNumberId: string;
  assistantId?: string; // Optional: Pre-configured VAPI assistant ID
}

const logger = workerLogger.child({ worker: 'voip-call-initiation' });

/**
 * Format phone number to E.164 format (e.g., +15551234567)
 * Handles US/Canada numbers and basic international formats
 */
function formatPhoneE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If already starts with +, return as-is after cleaning
  if (phone.trim().startsWith('+')) {
    return '+' + digits;
  }
  
  // US/Canada: 10 digits -> add +1
  if (digits.length === 10) {
    return '+1' + digits;
  }
  
  // Already has country code (11+ digits) -> add +
  if (digits.length >= 11) {
    return '+' + digits;
  }
  
  // Invalid format - return original with + prefix
  logger.warn({ phone, digits }, 'Phone number may not be in valid E.164 format');
  return '+' + digits;
}

async function processVoipCallInitiation(job: Job<VoipCallInitiationJobData>) {
  const {
    quoteRequestId,
    supplierId,
    supplierName,
    supplierPhone,
    context,
    metadata,
  } = job.data;

  logger.info(
    { quoteRequestId, supplierId, supplierName, jobId: job.id },
    'Processing VOIP call initiation'
  );

  try {
    // Check AI call limits for organization
    const organization = await prisma.organization.findUnique({
      where: { id: metadata.organizationId },
      select: {
        maxAICalls: true,
        aiCallsUsedThisMonth: true,
        aiCallsResetDate: true,
        overageEnabled: true,
        overageRate: true,
        hardCapEnabled: true,
        hardCapMultiplier: true,
        subscriptionTier: true,
        usePlatformKeys: true,
        vapiApiKey: true,
        elevenLabsApiKey: true,
      },
    });

    if (!organization) {
      throw new Error(`Organization not found: ${metadata.organizationId}`);
    }

    // Check if monthly reset is needed (first day of new month)
    const now = new Date();
    const needsReset = !organization.aiCallsResetDate || 
      organization.aiCallsResetDate.getMonth() !== now.getMonth() ||
      organization.aiCallsResetDate.getFullYear() !== now.getFullYear();

    if (needsReset) {
      // Reset counter for new month
      await prisma.organization.update({
        where: { id: metadata.organizationId },
        data: {
          aiCallsUsedThisMonth: 0,
          aiCallsResetDate: now,
        },
      });
      organization.aiCallsUsedThisMonth = 0;
    }

    // Calculate limits
    const softLimit = organization.maxAICalls;
    const hardLimit = organization.hardCapEnabled 
      ? Math.floor(softLimit * organization.hardCapMultiplier)
      : 9999; // Unlimited if no hard cap
    const currentUsage = organization.aiCallsUsedThisMonth;
    
    // Check if within included limit
    const isWithinLimit = currentUsage < softLimit;
    const isOverage = currentUsage >= softLimit && currentUsage < hardLimit;
    const isOverHardCap = currentUsage >= hardLimit && hardLimit < 9999;
    
    // Log overage status
    if (isOverage) {
      logger.info(
        { organizationId: metadata.organizationId, currentUsage, softLimit, overageRate: organization.overageRate },
        'Call will be billed as overage'
      );
    }

    // Check hard cap (9999 means unlimited)
    if (isOverHardCap) {
      const overageAmount = (hardLimit - softLimit) * Number(organization.overageRate);
      logger.warn(
        { organizationId: metadata.organizationId, currentUsage, hardLimit, overageAmount },
        'Hard cap reached'
      );
      throw new Error(
        `Hard limit reached (${hardLimit} calls). You have $${overageAmount.toFixed(2)} in pending overage charges. Contact support to increase limits.`
      );
    }

    // Check if at soft limit without overage enabled
    if (currentUsage >= softLimit && !organization.overageEnabled && organization.maxAICalls < 9999) {
      logger.warn(
        { organizationId: metadata.organizationId, used: currentUsage, limit: softLimit },
        'AI call limit reached (overage not enabled)'
      );
      throw new Error(
        `AI call limit reached. Your plan allows ${softLimit} calls per month. Please upgrade your plan, enable overage billing, or wait until next month.`
      );
    }

    // Create call log entry
    const callLog = await prisma.supplierCall.create({
      data: {
        quoteRequestId,
        supplierId,
        phoneNumber: supplierPhone,
        status: CallStatus.INITIATED,
        callDirection: 'OUTBOUND',
        callType: 'QUOTE_REQUEST',
        callerId: metadata.userId,
        organizationId: metadata.organizationId,
        conversationLog: {
          context,
          initiatedBy: metadata.userId,
          preferredMethod: metadata.preferredMethod,
        } as any,
      },
    });

    // Get VAPI credentials using CredentialsManager
    const credentialsManager = new CredentialsManager();
    const vapiCreds = await credentialsManager.getCredentialsWithFallback<VapiCredentials>(
      metadata.organizationId,
      'VAPI'
    );

    if (!vapiCreds || !vapiCreds.apiKey || !vapiCreds.phoneNumberId) {
      logger.error(
        { organizationId: metadata.organizationId, hasCredentials: !!vapiCreds },
        'Missing VAPI credentials in integration_credentials table'
      );
      throw new Error(
        'VAPI credentials not configured. Please add VAPI credentials in the Admin Integrations settings.'
      );
    }

    const vapiApiKey = vapiCreds.apiKey;
    const vapiPhoneNumber = vapiCreds.phoneNumberId;
    
    logger.info(
      { 
        organizationId: metadata.organizationId,
        usePlatformKeys: organization.usePlatformKeys,
        hasApiKey: !!vapiApiKey,
        hasPhoneNumber: !!vapiPhoneNumber
      },
      'Retrieved VAPI credentials from integration_credentials'
    );

    // Extract custom call settings
    const customContext = context.customContext; // Background facts (vehicle, parts, etc.)
    const customInstructions = context.customInstructions; // Behavioral guidance

    // Build first message - always a natural greeting, NEVER the context
    const firstMessage = `Hi, good morning! Could I speak to someone in your parts department?`;

    // Build system instructions for the AI agent
    // Include both the default guidelines AND the custom context/instructions
    let systemInstructions = `You are a real person calling suppliers to get parts quotes. Be natural, friendly, and conversational.

CRITICAL: Always start by asking for the parts department. Once connected, explain what you need naturally.`;

    // Append custom context (facts about this specific call)
    if (customContext) {
      systemInstructions += `\n\n## Call Information\nUse this information during your call - reference it naturally, don't read it verbatim:\n\n${customContext}`;
    }

    // Append custom behavioral instructions
    if (customInstructions) {
      systemInstructions += `\n\n## Special Instructions\n${customInstructions}`;
    }

    logger.info(
      { 
        quoteRequestId, 
        supplierId, 
        hasCustomContext: !!customContext, 
        hasCustomInstructions: !!customInstructions 
      },
      'Preparing VAPI call with LangGraph integration'
    );

    // Get app URL for webhook callbacks
    // Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL
    let appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && process.env.VERCEL_URL) {
      appUrl = `https://${process.env.VERCEL_URL}`;
    }
    if (!appUrl) {
      throw new Error('Neither NEXT_PUBLIC_APP_URL nor VERCEL_URL is set - cannot configure VAPI callback URL');
    }

    // Ensure URL doesn't have trailing slash
    appUrl = appUrl.replace(/\/$/, '');

    logger.info(
      { 
        appUrl, 
        hasVercelUrl: !!process.env.VERCEL_URL, 
        hasPublicUrl: !!process.env.NEXT_PUBLIC_APP_URL,
        vercelUrl: process.env.VERCEL_URL,
        publicUrl: process.env.NEXT_PUBLIC_APP_URL
      },
      'Using app URL for VAPI callbacks'
    );

    // Format phone number to E.164 format
    const formattedPhone = formatPhoneE164(supplierPhone);
    logger.debug({ original: supplierPhone, formatted: formattedPhone }, 'Formatted phone number');

    // Initialize call state BEFORE making VAPI API call to avoid race condition
    // Extract parts information from quote request
    const quoteRequestData = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
      include: {
        items: true,
      },
    });

    const parts = quoteRequestData?.items.map(item => ({
      partNumber: item.partNumber,
      description: item.description || '',
      quantity: item.quantity,
      budgetMax: undefined,
    })) || [];

    // Initialize LangGraph state and save to Redis
    const initialCallState = initializeCallState({
      callId: callLog.id,
      quoteRequestId,
      supplierId,
      supplierName,
      supplierPhone: formattedPhone,
      organizationId: metadata.organizationId,
      callerId: metadata.userId,
      parts,
      customContext: customContext,
      customInstructions: customInstructions,
    });

    try {
      await saveCallState(callLog.id, initialCallState);
      
      logger.info(
        { 
          callLogId: callLog.id, 
          partsCount: parts.length,
          hasCustomContext: !!(customContext || customInstructions),
          currentNode: initialCallState.currentNode 
        },
        'Call state successfully saved to Redis before VAPI API call'
      );
    } catch (redisError: any) {
      logger.error(
        {
          callLogId: callLog.id,
          error: redisError.message,
          stack: redisError.stack
        },
        'Failed to save call state to Redis'
      );
      throw new Error(`Failed to save call state: ${redisError.message}`);
    }

    // Check for pre-configured VAPI assistant ID (more reliable than inline config)
    // Priority: 1. From credentials (DB), 2. Environment variable
    const vapiAssistantId = vapiCreds.assistantId || process.env.VAPI_ASSISTANT_ID;
    
    // Log URL configuration for debugging
    logger.info(
      {
        appUrl,
        langgraphHandlerUrl: `${appUrl}/api/voip/langgraph-handler`,
        webhookUrl: `${appUrl}/api/voip/webhooks`,
        usingAssistantId: !!vapiAssistantId,
        assistantIdPreview: vapiAssistantId ? vapiAssistantId.slice(0, 10) + '...' : 'none',
      },
      'VAPI URL configuration'
    );

    // Build VAPI assistant configuration (only if not using assistant ID)
    const vapiAssistantConfig = vapiAssistantId ? undefined : {
      firstMessage: firstMessage,
      context: systemInstructions,
      model: {
        provider: 'custom-llm',
        model: 'langgraph-state-machine',
        url: `${appUrl}/api/voip/langgraph-handler`,
        headers: {
          'Authorization': `Bearer ${process.env.VOIP_WEBHOOK_SECRET || 'dev-secret'}`,
        },
      },
      voice: {
        provider: 'azure',
        voiceId: 'andrew',
      },
    };

    if (vapiAssistantConfig) {
      logger.info(
        {
          customLlmUrl: vapiAssistantConfig.model.url,
          provider: vapiAssistantConfig.model.provider,
          voiceProvider: vapiAssistantConfig.voice.provider,
          firstMessageLength: firstMessage.length,
          systemInstructionsLength: systemInstructions.length
        },
        'Built VAPI assistant configuration with custom LLM (inline)'
      );
    } else {
      logger.info(
        {
          assistantId: vapiAssistantId,
          firstMessageLength: firstMessage.length,
          systemInstructionsLength: systemInstructions.length
        },
        'Using pre-configured VAPI assistant with ID'
      );
    }

    const callPayload: any = {
      phoneNumberId: vapiPhoneNumber,
      customer: {
        number: formattedPhone,
      },
      metadata: {
        quoteRequestId,
        supplierId,
        organizationId: metadata.organizationId,
        callLogId: callLog.id,
        context: JSON.stringify(context),
        hasCustomSettings: !!(customContext || customInstructions),
      },
    };
    
    // Use assistant ID if provided, otherwise inline config
    if (vapiAssistantId) {
      callPayload.assistantId = vapiAssistantId;
      // Pass custom values via assistant overrides
      callPayload.assistantOverrides = {
        variableValues: {
          firstMessage,
          systemContext: systemInstructions,
          callId: callLog.id,
        },
      };
      // Note: When using assistantId, serverUrl is pre-configured in VAPI dashboard
      // and should NOT be included in the call payload
    } else {
      callPayload.assistant = vapiAssistantConfig;
      // Only include serverUrl when using inline assistant config
      callPayload.serverUrl = `${appUrl}/api/voip/webhooks`;
    }

    // Log the full payload being sent to VAPI for debugging
    logger.info(
      {
        callPayload: JSON.stringify(callPayload, null, 2),
        customLlmEndpoint: callPayload.assistant?.model?.url || 'using-assistant-id',
        webhookEndpoint: callPayload.serverUrl || 'configured-in-assistant',
        assistantId: callPayload.assistantId || 'inline-config',
      },
      'Sending call request to VAPI'
    );

    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload),
    });

    // Get response body for detailed error logging
    const responseText = await response.text();
    let vapiCallData: any;

    if (!response.ok) {
      let errorDetails = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorDetails = JSON.stringify(errorJson, null, 2);
      } catch {
        // Response is not JSON, use as-is
      }
      
      logger.error(
        { 
          status: response.status,
          statusText: response.statusText,
          responseBody: errorDetails,
          supplierId,
          quoteRequestId 
        },
        'VAPI API call failed'
      );
      
      throw new Error(
        `VAPI call initiation failed: ${response.status} ${response.statusText} - ${errorDetails}`
      );
    }

    // Parse successful response
    try {
      vapiCallData = JSON.parse(responseText);
      logger.info(
        {
          vapiCallId: vapiCallData.id,
          status: vapiCallData.status,
          hasAssistant: !!vapiCallData.assistant,
          assistantModel: vapiCallData.assistant?.model?.provider,
          customLlmUrl: vapiCallData.assistant?.model?.url
        },
        'VAPI call created successfully, verifying custom LLM configuration'
      );
    } catch (parseError) {
      logger.error(
        { responseText, parseError },
        'Failed to parse VAPI response'
      );
      throw new Error('Failed to parse VAPI API response');
    }

    // Update call log with VAPI call ID and increment AI calls counter
    await prisma.$transaction([
      prisma.supplierCall.update({
        where: { id: callLog.id },
        data: {
          vapiCallId: vapiCallData.id,
          status: CallStatus.RINGING,
        },
      }),
      prisma.organization.update({
        where: { id: metadata.organizationId },
        data: {
          aiCallsUsedThisMonth: {
            increment: 1,
          },
        },
      }),
    ]);

    // Track overage usage if call exceeds included limit
    if (isOverage) {
      try {
        await trackOverageUsage(metadata.organizationId);
        logger.info(
          { organizationId: metadata.organizationId, currentUsage: currentUsage + 1 },
          'Overage usage tracked for AI call'
        );
      } catch (overageError) {
        logger.error(
          { organizationId: metadata.organizationId, error: overageError },
          'Failed to track overage usage - continuing anyway'
        );
      }
    }

    logger.info(
      { callId: callLog.id, vapiCallId: vapiCallData.id },
      'Call initiated successfully via VAPI and call counter incremented'
    );

    return {
      success: true,
      callId: callLog.id,
      vapiCallId: vapiCallData.id,
    };
  } catch (error: any) {
    logger.error(
      { error: error.message, quoteRequestId, supplierId },
      'Error initiating VOIP call'
    );

    // Update call log if it exists
    let failedCallId: string | undefined;
    
    try {
      const existingCall = await prisma.supplierCall.findFirst({
        where: {
          quoteRequestId,
          supplierId,
          status: CallStatus.INITIATED,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingCall) {
        failedCallId = existingCall.id;
        await prisma.supplierCall.update({
          where: { id: existingCall.id },
          data: {
            status: CallStatus.FAILED,
            endedAt: new Date(),
            notes: `Call initiation failed: ${error.message}`,
          },
        });
      }
    } catch (updateError) {
      logger.error({ error: updateError }, 'Failed to update call log after error');
    }

    // Queue fallback email if email is available and method is 'both'
    if (metadata.preferredMethod === 'both') {
      logger.info({ quoteRequestId, supplierId }, 'Queueing fallback email');
      
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { email: true },
      });

      if (supplier?.email) {
        await voipFallbackQueue.add(
          `voip-fallback-${quoteRequestId}-${supplierId}`,
          {
            quoteRequestId,
            supplierId,
            supplierName,
            supplierEmail: supplier.email,
            callId: failedCallId, // Pass the failed call log ID
            failureReason: error.message,
            context,
            metadata: {
              userId: metadata.userId,
              organizationId: metadata.organizationId,
            },
          },
          {
            delay: 30000, // Wait 30 seconds before sending fallback email
          }
        );
      }
    }

    // Queue retry for call-only or if retry count is below max
    const retryAttempt = (job.attemptsMade || 0) + 1;
    const maxRetries = 3;

    if (retryAttempt < maxRetries && (metadata.preferredMethod === 'call' || metadata.preferredMethod === 'both')) {
      logger.info(
        { quoteRequestId, supplierId, retryAttempt },
        'Queueing call retry'
      );

      await voipCallRetryQueue.add(
        `voip-retry-${quoteRequestId}-${supplierId}-${retryAttempt}`,
        {
          quoteRequestId,
          supplierId,
          supplierName,
          supplierPhone,
          previousCallId: '', // Will be filled from the failed call log
          retryAttempt,
          maxRetries,
          context,
          metadata: {
            userId: metadata.userId,
            organizationId: metadata.organizationId,
          },
        },
        {
          delay: Math.min(60000 * Math.pow(2, retryAttempt), 300000), // Exponential backoff: 2min, 4min, 5min max
        }
      );
    }

    throw error;
  }
}

export function startVoipCallInitiationWorker() {
  const worker = new Worker<VoipCallInitiationJobData>(
    QUEUE_NAMES.VOIP_CALL_INITIATION,
    async (job) => {
      return await processVoipCallInitiation(job);
    },
    {
      connection: redisConnection,
      concurrency: 5, // Process up to 5 calls simultaneously
      limiter: {
        max: 10, // Max 10 calls
        duration: 60000, // per minute (rate limiting)
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'VOIP call initiation job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, error: err.message },
      'VOIP call initiation job failed'
    );
  });

  logger.info('VOIP call initiation worker started');

  return worker;
}
