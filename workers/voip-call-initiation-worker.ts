import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { QUEUE_NAMES, voipFallbackQueue, voipCallRetryQueue } from '@/lib/queue/queues';
import { VoipCallInitiationJobData } from '@/lib/queue/types';
import { workerLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { CallStatus } from '@prisma/client';
import { trackOverageUsage } from '@/lib/billing/overage-billing';
import { decrypt } from '@/lib/encryption';

const logger = workerLogger.child({ worker: 'voip-call-initiation' });

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

    // Determine which API keys to use (BYOK or Platform)
    let vapiApiKey: string;
    let vapiPhoneNumber: string;
    
    if (!organization.usePlatformKeys && organization.vapiApiKey) {
      // Use customer's own keys (BYOK)
      try {
        vapiApiKey = decrypt(organization.vapiApiKey);
        // For BYOK customers, they provide their own phone number ID
        // We'll need to store this in the organization or use a default
        vapiPhoneNumber = process.env.VAPI_PHONE_NUMBER_ID!; // Fallback for now
        logger.info({ organizationId: metadata.organizationId }, 'Using BYOK keys for VAPI call');
      } catch (error) {
        logger.error({ error, organizationId: metadata.organizationId }, 'Failed to decrypt BYOK keys, falling back to platform keys');
        vapiApiKey = process.env.VAPI_PRIVATE_KEY!;
        vapiPhoneNumber = process.env.VAPI_PHONE_NUMBER_ID!;
      }
    } else {
      // Use platform keys (default)
      vapiApiKey = process.env.VAPI_PRIVATE_KEY!;
      vapiPhoneNumber = process.env.VAPI_PHONE_NUMBER_ID!;
      logger.info({ organizationId: metadata.organizationId }, 'Using platform keys for VAPI call');
    }

    // Initiate call via VAPI
    if (!vapiApiKey || !vapiPhoneNumber) {
      throw new Error('Missing VAPI configuration (VAPI_PRIVATE_KEY or VAPI_PHONE_NUMBER_ID)');
    }

    // Extract custom call settings
    const customContext = context.customContext;
    const customInstructions = context.customInstructions;

    // Build first message
    const defaultFirstMessage = `Hi, this is an automated call from ${metadata.organizationId}. I'm calling regarding quote request ${quoteRequestId.slice(0, 8)}. Am I speaking with someone at ${supplierName}?`;
    const firstMessage = customContext || defaultFirstMessage;

    // Build system instructions for the AI agent
    const defaultSystemInstructions = `You are an AI assistant calling suppliers on behalf of ${metadata.organizationId}. Your goal is to request quotes for parts and gather pricing information. Be professional, concise, and friendly.`;
    const systemInstructions = customInstructions || defaultSystemInstructions;

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId: vapiPhoneNumber,
        customer: {
          number: supplierPhone,
        },
        assistant: {
          firstMessage: firstMessage,
          context: systemInstructions, // System-level instructions for the agent
          model: {
            provider: 'custom-llm',
            url: `${appUrl}/api/voip/langgraph-handler`,
            headers: {
              'Authorization': `Bearer ${process.env.VOIP_WEBHOOK_SECRET || 'dev-secret'}`,
            },
            // Fallback model settings in case custom LLM fails
            fallbackModel: {
              provider: 'openai',
              model: 'gpt-4',
              temperature: 0.7,
            },
          },
          voice: {
            provider: 'azure',
            voiceId: 'andrew',
          },
        },
        metadata: {
          quoteRequestId,
          supplierId,
          organizationId: metadata.organizationId,
          callLogId: callLog.id,
          context: JSON.stringify(context),
          hasCustomSettings: !!(customContext || customInstructions),
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `VAPI call initiation failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    const vapiCallData = await response.json();

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
