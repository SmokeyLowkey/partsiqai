import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { QUEUE_NAMES, voipFallbackQueue } from '@/lib/queue/queues';
import { VoipCallRetryJobData } from '@/lib/queue/types';
import { workerLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { CallStatus } from '@prisma/client';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';

interface VapiCredentials {
  apiKey: string;
  phoneNumberId: string;
}

const logger = workerLogger.child({ worker: 'voip-call-retry' });

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

async function processVoipCallRetry(job: Job<VoipCallRetryJobData>) {
  const {
    quoteRequestId,
    supplierId,
    supplierName,
    supplierPhone,
    previousCallId,
    retryAttempt,
    maxRetries,
    context,
    metadata,
  } = job.data;

  logger.info(
    {
      quoteRequestId,
      supplierId,
      retryAttempt,
      maxRetries,
      jobId: job.id,
    },
    'Processing VOIP call retry'
  );

  try {
    // Check if previous call exists and verify it failed
    if (previousCallId) {
      const previousCall = await prisma.supplierCall.findUnique({
        where: { id: previousCallId },
      });

      if (previousCall && previousCall.status === CallStatus.COMPLETED) {
        logger.info(
          { previousCallId, quoteRequestId },
          'Previous call completed successfully, skipping retry'
        );
        return {
          success: false,
          skipped: true,
          reason: 'Previous call completed successfully',
        };
      }
    }

    // Create new call log entry for retry
    const callLog = await prisma.supplierCall.create({
      data: {
        quoteRequestId,
        supplierId,
        phoneNumber: supplierPhone,
        callerId: metadata.userId,
        organizationId: metadata.organizationId,
        status: CallStatus.INITIATED,
        callDirection: 'OUTBOUND',
        conversationLog: {
          context,
          initiatedBy: metadata.userId,
          retryAttempt,
          maxRetries,
          previousCallId,
        } as any,
      },
    });

    logger.info(
      { callId: callLog.id, retryAttempt },
      'Retry call log created'
    );

    // Fetch organization to check BYOK settings
    const organization = await prisma.organization.findUnique({
      where: { id: metadata.organizationId },
      select: {
        usePlatformKeys: true,
        vapiApiKey: true,
      },
    });

    if (!organization) {
      throw new Error(`Organization not found: ${metadata.organizationId}`);
    }

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
      'Retrieved VAPI credentials for retry from integration_credentials'
    );

    // Format phone number to E.164 format
    const formattedPhone = formatPhoneE164(supplierPhone);
    logger.debug({ original: supplierPhone, formatted: formattedPhone }, 'Formatted phone number for retry');

    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId: vapiPhoneNumber,
        customer: {
          number: formattedPhone,
        },
        assistant: {
          firstMessage: `Hi, this is a follow-up call from ${metadata.organizationId}. I'm calling again regarding quote request ${quoteRequestId.slice(0, 8)}. Am I speaking with someone at ${supplierName}?`,
          model: {
            provider: 'openai',
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 500,
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
          retryAttempt,
          previousCallId,
          context: JSON.stringify(context),
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `VAPI retry call failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    const vapiCallData = await response.json();

    // Update call log with VAPI call ID
    await prisma.supplierCall.update({
      where: { id: callLog.id },
      data: {
        vapiCallId: vapiCallData.id,
        status: CallStatus.RINGING,
      },
    });

    logger.info(
      {
        callId: callLog.id,
        vapiCallId: vapiCallData.id,
        retryAttempt,
      },
      'Retry call initiated successfully via VAPI'
    );

    return {
      success: true,
      callId: callLog.id,
      vapiCallId: vapiCallData.id,
      retryAttempt,
    };
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        quoteRequestId,
        supplierId,
        retryAttempt,
      },
      'Error during VOIP call retry'
    );

    // Update call log if it exists
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
        await prisma.supplierCall.update({
          where: { id: existingCall.id },
          data: {
            status: CallStatus.FAILED,
            endedAt: new Date(),
            conversationLog: {
              notes: `Retry attempt ${retryAttempt} failed: ${error.message}`,
            } as any,
          },
        });
      }
    } catch (updateError) {
      logger.error({ error: updateError }, 'Failed to update call log after retry error');
    }

    // If this was the last retry attempt, queue fallback email
    if (retryAttempt >= maxRetries) {
      logger.info(
        { quoteRequestId, supplierId, retryAttempt, maxRetries },
        'Max retries reached, queueing fallback email'
      );

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
            failureReason: `All ${maxRetries} call attempts failed. Last error: ${error.message}`,
            context,
            metadata: {
              userId: metadata.userId,
              organizationId: metadata.organizationId,
            },
          },
          {
            delay: 60000, // Wait 1 minute before sending fallback email
          }
        );
      }
    }

    throw error;
  }
}

export function startVoipCallRetryWorker() {
  const worker = new Worker<VoipCallRetryJobData>(
    QUEUE_NAMES.VOIP_CALL_RETRY,
    async (job) => {
      return await processVoipCallRetry(job);
    },
    {
      connection: redisConnection,
      concurrency: 3, // Process up to 3 retry calls simultaneously
      drainDelay: 30,
      limiter: {
        max: 5, // Max 5 retry calls
        duration: 60000, // per minute
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'VOIP call retry job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, error: err.message },
      'VOIP call retry job failed'
    );
  });

  logger.info('VOIP call retry worker started');

  return worker;
}
