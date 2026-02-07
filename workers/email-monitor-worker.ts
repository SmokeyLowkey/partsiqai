// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { EmailMonitorJobData } from '@/lib/queue/types';
import { getEmailClientForUser, EmailClient } from '@/lib/services/email/email-client-factory';
import { EmailData } from '@/lib/services/email/gmail-client';
import { EmailParser } from '@/lib/services/email/email-parser';
import { prisma } from '@/lib/prisma';
import { quoteExtractionQueue } from '@/lib/queue/queues';
import { workerLogger } from '@/lib/logger';

const QUEUE_NAME = 'email-monitor';

// Helper to parse email data from Gmail API format
function parseEmailData(email: EmailData, parser: EmailParser): {
  from: string;
  subject: string;
  body: string;
  bodyHtml: string;
  messageId: string | null;
  inReplyTo: string | null;
} {
  const headers = parser.parseHeaders(email.headers);
  const { text, html } = parser.extractBody(email.parts);

  return {
    from: parser.extractEmailAddress(headers.from),
    subject: headers.subject,
    body: text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), // Strip HTML if no plain text
    bodyHtml: html || `<p>${text}</p>`,
    messageId: headers.messageId || null,
    inReplyTo: headers.inReplyTo || null,
  };
}

// Create worker
export const emailMonitorWorker = new Worker<EmailMonitorJobData>(
  QUEUE_NAME,
  async (job: Job<EmailMonitorJobData>) => {
    workerLogger.info({ jobId: job.id, jobData: job.data }, 'Processing email monitor job');

    const { organizationId } = job.data;

    try {
      await job.updateProgress(10);

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
      const emailParser = new EmailParser();

      await job.updateProgress(20);

      // Get last sync state
      const emailSyncState = await prisma.emailSyncState.findUnique({
        where: { organizationId },
      });

      // Fetch new emails since last sync
      const emails = await emailClient.fetchNewEmails(
        emailSyncState?.lastEmailId || undefined
      );

      workerLogger.info({ emailCount: emails.length, organizationId }, 'Found new emails for organization');

      await job.updateProgress(50);

      // Get a system user to use as createdById for threads (first admin of the org)
      const systemUser = await prisma.user.findFirst({
        where: {
          organizationId,
          role: { in: ['MASTER_ADMIN', 'ADMIN'] },
        },
        select: { id: true },
      });

      if (!systemUser) {
        throw new Error('No admin user found for organization');
      }

      // Process each email
      let processedCount = 0;
      let skippedCount = 0;
      for (const email of emails) {
        try {
          // IMPORTANT: Check if this email was already processed by externalMessageId
          const existingMessage = await prisma.emailMessage.findFirst({
            where: {
              externalMessageId: email.id,
            },
          });

          if (existingMessage) {
            // Email already processed, skip it
            workerLogger.debug({ emailId: email.id }, 'Skipping already processed email');
            skippedCount++;
            continue;
          }

          // Parse email to extract data
          const parsedEmail = parseEmailData(email, emailParser);

          // Match supplier by email
          const supplier = await prisma.supplier.findFirst({
            where: {
              organizationId,
              OR: [
                { email: parsedEmail.from },
                {
                  auxiliaryEmails: {
                    some: {
                      email: parsedEmail.from,
                    },
                  },
                },
              ],
            },
          });

          // Create or find email thread by external thread ID
          let thread = await prisma.emailThread.findFirst({
            where: {
              organizationId,
              externalThreadId: email.threadId,
            },
          });

          if (!thread) {
            // Create new thread
            thread = await prisma.emailThread.create({
              data: {
                organizationId,
                externalThreadId: email.threadId,
                subject: parsedEmail.subject,
                supplierId: supplier?.id,
                status: 'RESPONSE_RECEIVED', // Incoming email = response received
                createdById: systemUser.id,
              },
            });
          }

          // Create email message record
          const emailMessage = await prisma.emailMessage.create({
            data: {
              threadId: thread.id,
              direction: 'INBOUND',
              from: parsedEmail.from,
              to: '', // Incoming email - to is our address
              subject: parsedEmail.subject,
              body: parsedEmail.body,
              bodyHtml: parsedEmail.bodyHtml,
              externalMessageId: parsedEmail.messageId || email.id, // Use Message-ID header, fallback to Gmail ID
              receivedAt: new Date(parseInt(email.date)),
              inReplyTo: parsedEmail.inReplyTo,
              attachments: {
                create: email.attachments.map((att: any) => ({
                  filename: att.filename,
                  contentType: att.mimeType,
                  size: att.size,
                  path: '', // Path will be set when attachment is downloaded to S3
                })),
              },
            },
          });

          // Update thread status
          await prisma.emailThread.update({
            where: { id: thread.id },
            data: {
              status: 'RESPONSE_RECEIVED',
            },
          });

          // Check if this looks like a quote response and has attachments
          const isQuoteEmail = emailParser.isQuoteEmail(parsedEmail.subject, parsedEmail.body);
          const hasAttachments = email.attachments.length > 0;

          if (isQuoteEmail || hasAttachments) {
            // Queue quote extraction job
            await quoteExtractionQueue.add('extract-quote', {
              organizationId,
              emailThreadId: thread.id,
              emailMessageId: emailMessage.id,
              emailData: {
                id: email.id,
                threadId: email.threadId,
                subject: parsedEmail.subject,
                body: parsedEmail.body,
                from: parsedEmail.from,
                date: email.date,
              },
              attachments: email.attachments.map((att: any) => ({
                id: `${email.id}-${att.attachmentId}`,
                filename: att.filename,
                contentType: att.mimeType,
                size: att.size,
                gmailAttachmentId: att.attachmentId,
              })),
            });

            workerLogger.info({ from: parsedEmail.from, attachmentCount: email.attachments.length }, 'Queued quote extraction for email');
          }

          // Also check if this email is a reply to one of our quote request threads
          if (parsedEmail.inReplyTo) {
            const originalMessage = await prisma.emailMessage.findFirst({
              where: {
                externalMessageId: parsedEmail.inReplyTo,
                thread: {
                  organizationId,
                },
              },
              include: {
                thread: {
                  include: {
                    quoteRequestEmailThreads: true,
                  },
                },
              },
            });

            if (originalMessage?.thread?.quoteRequestEmailThreads) {
              // Update quote request email thread status
              await prisma.quoteRequestEmailThread.updateMany({
                where: {
                  emailThreadId: originalMessage.thread.id,
                },
                data: {
                  status: 'RESPONDED',
                  responseDate: new Date(),
                },
              });

              // Queue quote extraction for this response
              await quoteExtractionQueue.add('extract-quote', {
                organizationId,
                emailThreadId: originalMessage.thread.id,
                emailMessageId: emailMessage.id,
                emailData: {
                  id: email.id,
                  threadId: email.threadId,
                  subject: parsedEmail.subject,
                  body: parsedEmail.body,
                  from: parsedEmail.from,
                  date: email.date,
                },
                attachments: email.attachments.map((att: any) => ({
                  id: `${email.id}-${att.attachmentId}`,
                  filename: att.filename,
                  contentType: att.mimeType,
                  size: att.size,
                  gmailAttachmentId: att.attachmentId,
                })),
              });

              workerLogger.info({ threadId: originalMessage.thread.id }, 'Queued quote extraction for reply to quote request thread');
            }
          }

          processedCount++;
        } catch (emailError: any) {
          workerLogger.error({ err: emailError, emailId: email.id }, 'Error processing email');
          // Continue processing other emails
        }
      }

      await job.updateProgress(90);

      // Update sync state
      if (emails.length > 0) {
        const lastEmail = emails[0]; // Emails are returned newest first

        await prisma.emailSyncState.upsert({
          where: { organizationId },
          update: {
            lastEmailId: lastEmail.id,
            lastSyncAt: new Date(),
            syncStatus: 'ACTIVE',
            errorCount: 0,
          },
          create: {
            organizationId,
            lastEmailId: lastEmail.id,
            lastSyncAt: new Date(),
            syncStatus: 'ACTIVE',
            errorCount: 0,
          },
        });
      } else {
        // Update lastSyncAt even if no new emails
        await prisma.emailSyncState.upsert({
          where: { organizationId },
          update: {
            lastSyncAt: new Date(),
            syncStatus: 'ACTIVE',
          },
          create: {
            organizationId,
            lastSyncAt: new Date(),
            syncStatus: 'ACTIVE',
          },
        });
      }

      await job.updateProgress(100);

      workerLogger.info({ jobId: job.id, processedCount, skippedCount }, 'Email monitor job completed');

      return {
        success: true,
        emailsFound: emails.length,
        emailsProcessed: processedCount,
        emailsSkipped: skippedCount,
      };
    } catch (error: any) {
      workerLogger.error({ err: error, jobId: job.id }, 'Email monitor job failed');

      // Update sync state with error
      await prisma.emailSyncState.upsert({
        where: { organizationId },
        update: {
          syncStatus: 'ERROR',
          errorCount: { increment: 1 },
          lastSyncAt: new Date(),
        },
        create: {
          organizationId,
          syncStatus: 'ERROR',
          errorCount: 1,
          lastSyncAt: new Date(),
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 organizations concurrently
    limiter: {
      max: 5, // Max 5 jobs
      duration: 60000, // per 60 seconds (to respect Gmail API limits)
    },
  }
);

// Event handlers
emailMonitorWorker.on('completed', async (job) => {
  workerLogger.info({ jobId: job.id }, 'Job completed');

  try {
    await prisma.jobQueue.updateMany({
      where: { jobId: job.id! },
      data: {
        status: 'COMPLETED',
        result: job.returnvalue,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    workerLogger.error({ err: error }, 'Failed to update job queue on completion');
  }
});

emailMonitorWorker.on('failed', async (job, err) => {
  workerLogger.error({ err, jobId: job?.id }, 'Job failed');

  if (job) {
    try {
      await prisma.jobQueue.updateMany({
        where: { jobId: job.id! },
        data: {
          status: 'FAILED',
          error: err.message,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      workerLogger.error({ err: error }, 'Failed to update job queue on failure');
    }
  }
});

emailMonitorWorker.on('active', async (job) => {
  workerLogger.info({ jobId: job.id }, 'Job started processing');

  try {
    await prisma.jobQueue.updateMany({
      where: { jobId: job.id! },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });
  } catch (error) {
    workerLogger.error({ err: error }, 'Failed to update job queue on active');
  }
});

emailMonitorWorker.on('progress', (job, progress) => {
  workerLogger.debug({ jobId: job.id, progress }, 'Job progress');
});

emailMonitorWorker.on('error', (err) => {
  workerLogger.error({ err }, 'Worker error');
});

workerLogger.info('Email monitor worker started');
