// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { FollowUpJobData } from '@/lib/queue/types';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { prisma } from '@/lib/prisma';
import { addBusinessDays, getDaysSince } from '@/lib/utils/business-days';
import { workerLogger } from '@/lib/logger';

const QUEUE_NAME = 'follow-up';

// Create worker
export const followUpWorker = new Worker<FollowUpJobData>(
  QUEUE_NAME,
  async (job: Job<FollowUpJobData>) => {
    workerLogger.info({ jobId: job.id, jobData: job.data }, 'Processing follow-up job');

    const {
      organizationId,
      quoteRequestId,
      quoteRequestEmailThreadId,
      supplierId,
      supplierName,
      supplierEmail,
      emailThreadId,
      quoteNumber,
      customSubject,
      customBody,
    } = job.data;

    try {
      // Validate supplier has email
      if (!supplierEmail) {
        throw new Error(`Supplier ${supplierName} does not have an email address`);
      }

      // Get the original email thread and messages
      const emailThread = await prisma.emailThread.findUnique({
        where: { id: emailThreadId },
        include: {
          messages: {
            orderBy: { sentAt: 'asc' },
          },
        },
      });

      if (!emailThread) {
        throw new Error(`Email thread ${emailThreadId} not found`);
      }

      // Get quote request details for context
      const quoteRequest = await prisma.quoteRequest.findUnique({
        where: { id: quoteRequestId },
        include: {
          items: true,
          vehicle: true,
          organization: {
            select: {
              name: true,
              billingEmail: true,
            },
          },
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (!quoteRequest) {
        throw new Error(`Quote request ${quoteRequestId} not found`);
      }

      // Calculate days since original email
      const originalMessage = emailThread.messages.find((m) => m.direction === 'OUTBOUND');
      const daysSinceOriginal = originalMessage?.sentAt
        ? getDaysSince(originalMessage.sentAt)
        : 0;

      // Generate follow-up email content if not provided
      let subject = customSubject;
      let body = customBody;

      if (!subject || !body) {
        const generated = await generateFollowUpEmail(
          quoteRequest,
          supplierName,
          daysSinceOriginal,
          emailThread.subject,
          organizationId
        );
        subject = subject || generated.subject;
        body = body || generated.body;
      }

      // Find a user with email integration configured for this organization
      const userWithEmail = await prisma.userEmailIntegration.findFirst({
        where: {
          user: { organizationId },
          providerType: { in: ['GMAIL_OAUTH', 'MICROSOFT_OAUTH'] },
          isActive: true,
        },
        select: { userId: true },
      });

      if (!userWithEmail) {
        throw new Error('No user with email integration found for this organization');
      }

      // Get email client using that user's credentials (supports Gmail and Microsoft)
      const emailClient = await getEmailClientForUser(userWithEmail.userId);

      // Convert plain text body to HTML
      const htmlBody = body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');



      // Send the follow-up email as a reply in the same thread
      const { messageId } = await emailClient.sendEmail(
        supplierEmail,
        subject,
        `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
        undefined, // cc
        undefined, // bcc
        {
          // Include threadId to keep the follow-up in the same Gmail thread
          threadId: emailThread.externalThreadId || undefined,
          // Include In-Reply-To header if we have the original message ID
          inReplyTo: originalMessage?.externalMessageId || undefined,
        }
      );

      workerLogger.info({ supplierEmail, messageId }, 'Follow-up email sent');



      // Get from email
      const fromEmail =
        quoteRequest.organization.billingEmail ||
        quoteRequest.createdBy.email ||
        'noreply@example.com';

      // Calculate next expected response (3 business days from now)
      const nextExpectedResponse = addBusinessDays(new Date(), 3);

      // Create email message record for the follow-up
      await prisma.emailMessage.create({
        data: {
          threadId: emailThreadId,
          direction: 'OUTBOUND',
          from: fromEmail,
          to: supplierEmail,
          subject,
          body,
          bodyHtml: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
          externalMessageId: messageId,
          sentAt: new Date(),
          followUpSentAt: new Date(),
          followUpReason: `No response after ${daysSinceOriginal} days`,
          expectedResponseBy: nextExpectedResponse,
        },
      });

      // Update email thread status
      await prisma.emailThread.update({
        where: { id: emailThreadId },
        data: {
          status: 'FOLLOW_UP_NEEDED',
          updatedAt: new Date(),
        },
      });

      // Update job queue record
      await prisma.jobQueue.updateMany({
        where: {
          jobId: job.id!,
          queueName: QUEUE_NAME,
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: {
            success: true,
            messageId,
            sentTo: supplierEmail,
          },
        },
      });

      await job.updateProgress(100);

      return {
        success: true,
        messageId,
        supplierName,
        supplierEmail,
        daysSinceOriginal,
      };
    } catch (error: any) {
      workerLogger.error({ err: error, jobId: job.id }, 'Follow-up job failed');

      // Update job queue record
      await prisma.jobQueue.updateMany({
        where: {
          jobId: job.id!,
          queueName: QUEUE_NAME,
        },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

/**
 * Generate follow-up email content using AI
 */
async function generateFollowUpEmail(
  quoteRequest: any,
  supplierName: string,
  daysSinceOriginal: number,
  originalSubject: string,
  organizationId: string
): Promise<{ subject: string; body: string }> {
  try {
    const llmClient = await OpenRouterClient.fromOrganization(organizationId);

    // Build parts list for reference
    const partsList = quoteRequest.items
      .map(
        (item: any, index: number) =>
          `${index + 1}. Part Number: ${item.partNumber} - ${item.description} (Qty: ${item.quantity})`
      )
      .join('\n');

    const prompt = `Generate a professional follow-up email for a quote request that hasn't received a response.

CONTEXT:
- Company: ${quoteRequest.organization.name}
- Contact: ${quoteRequest.createdBy.name || quoteRequest.createdBy.email}
- Quote Number: ${quoteRequest.quoteNumber}
- Supplier: ${supplierName}
- Days since original request: ${daysSinceOriginal}
- Original subject: ${originalSubject}

PARTS REQUESTED:
${partsList}

REQUIREMENTS:
1. Generate a polite follow-up subject line (reference the original request)
2. Generate a professional follow-up email that:
   - Politely references the original quote request
   - Mentions the ${daysSinceOriginal} days that have passed
   - Reiterates interest in receiving a quote
   - Asks if they need any additional information
   - Keeps a friendly, professional tone
   - Is concise (not more than 3-4 short paragraphs)

Output your response as JSON with the following structure:
{
  "subject": "Re: [original subject] - Follow Up",
  "body": "the email body (use \\n for line breaks)"
}`;

    const response = await llmClient.generateStructuredOutput<{
      subject: string;
      body: string;
    }>(prompt, {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['subject', 'body'],
    });

    return response;
  } catch (error: any) {
    workerLogger.error({ err: error }, 'AI follow-up generation failed');

    // Fallback to template-based email
    return {
      subject: `Re: ${originalSubject} - Follow Up`,
      body: `Dear ${supplierName},

I hope this message finds you well. I'm following up on our quote request (${quoteRequest.quoteNumber}) that was sent ${daysSinceOriginal} days ago.

We are still very interested in receiving pricing and availability for the requested parts. If you need any additional information to process this request, please don't hesitate to let me know.

Looking forward to hearing from you soon.

Best regards,
${quoteRequest.createdBy.name || 'The Team'}
${quoteRequest.organization.name}`,
    };
  }
}

// Worker event handlers
followUpWorker.on('completed', (job, result) => {
  workerLogger.info({ jobId: job.id, result }, 'Follow-up job completed');
});

followUpWorker.on('failed', (job, error) => {
  workerLogger.error({ err: error, jobId: job?.id }, 'Follow-up job failed');
});

followUpWorker.on('error', (error) => {
  workerLogger.error({ err: error }, 'Follow-up worker error');
});

// Export for use in worker index
export default followUpWorker;
