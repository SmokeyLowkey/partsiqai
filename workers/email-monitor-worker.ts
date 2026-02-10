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

      // Find ALL users with email integration configured for this organization
      const usersWithEmail = await prisma.userEmailIntegration.findMany({
        where: {
          user: { organizationId },
          providerType: { in: ['GMAIL_OAUTH', 'MICROSOFT_OAUTH'] },
          isActive: true,
        },
        select: { userId: true, user: { select: { email: true, name: true } } },
      });

      if (usersWithEmail.length === 0) {
        throw new Error('No users with email integration found for this organization');
      }

      workerLogger.info({ userCount: usersWithEmail.length, organizationId }, 'Found users with email integrations');

      await job.updateProgress(20);

      let totalProcessedCount = 0;
      let totalSkippedCount = 0;
      let totalEmailsFound = 0;

      // Process each user's inbox independently
      for (const userWithEmail of usersWithEmail) {
        const userId = userWithEmail.userId;
        workerLogger.info({ userId, organizationId }, 'Processing inbox for user');

        try {
          // Get email client using this user's credentials
          const emailClient = await getEmailClientForUser(userId);
          const emailParser = new EmailParser();

          // Get last sync state for THIS user
          const userSyncState = await prisma.userEmailSyncState.findUnique({
            where: { userId },
          });

          // Fetch new emails since last sync for this user
          const emails = await emailClient.fetchNewEmails(
            userSyncState?.lastEmailId || undefined
          );

          totalEmailsFound += emails.length;
          workerLogger.info({ emailCount: emails.length, userId, organizationId }, 'Found new emails for user');

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

          // If no thread found by Gmail threadId, try to resolve via inReplyTo header.
          // This handles cross-account threading: when a manager sends an order confirmation
          // from their Gmail account, Gmail creates a new thread (different threadId).
          // When the supplier replies, the reply's threadId won't match the original
          // EmailThread.externalThreadId. We use the In-Reply-To header to find the
          // original thread and link the reply correctly.
          if (!thread && parsedEmail.inReplyTo) {
            const replyToMessage = await prisma.emailMessage.findFirst({
              where: {
                externalMessageId: parsedEmail.inReplyTo,
                thread: { organizationId },
              },
              include: { thread: true },
            });

            if (replyToMessage?.thread) {
              thread = replyToMessage.thread;
              // Update externalThreadId so future emails in this Gmail thread match directly
              await prisma.emailThread.update({
                where: { id: thread.id },
                data: { externalThreadId: email.threadId },
              });
              workerLogger.info(
                { threadId: thread.id, newExternalThreadId: email.threadId },
                'Resolved thread via inReplyTo header (cross-account threading)'
              );
            }
          }

          // Fallback 3: Try to match by order/quote number in subject line.
          // Handles the case where a supplier composes a fresh email (not a reply)
          // referencing an existing order or quote number.
          if (!thread) {
            const orderMatch = parsedEmail.subject.match(/ORD-\d{4}-\d{4}/);
            const quoteMatch = parsedEmail.subject.match(/QR-\d{2}-\d{4}-\d{4}/);

            if (orderMatch) {
              const order = await prisma.order.findFirst({
                where: { organizationId, orderNumber: orderMatch[0] },
                include: { emailThread: true },
              });
              if (order?.emailThread) {
                thread = order.emailThread;
                await prisma.emailThread.update({
                  where: { id: thread.id },
                  data: { externalThreadId: email.threadId },
                });
                workerLogger.info(
                  { threadId: thread.id, orderNumber: orderMatch[0], newExternalThreadId: email.threadId },
                  'Resolved thread via order number in subject line'
                );
              }
            }

            if (!thread && quoteMatch) {
              const quoteRequest = await prisma.quoteRequest.findFirst({
                where: { organizationId, quoteNumber: quoteMatch[0] },
                include: {
                  emailThreads: {
                    ...(supplier?.id ? { where: { supplierId: supplier.id } } : {}),
                    include: { emailThread: true },
                    take: 1,
                  },
                },
              });
              const qrThread = quoteRequest?.emailThreads[0]?.emailThread;
              if (qrThread) {
                thread = qrThread;
                await prisma.emailThread.update({
                  where: { id: thread.id },
                  data: { externalThreadId: email.threadId },
                });
                workerLogger.info(
                  { threadId: thread.id, quoteNumber: quoteMatch[0], newExternalThreadId: email.threadId },
                  'Resolved thread via quote number in subject line'
                );
              }
            }
          }

          if (!thread) {
            // Create new thread with ownerUserId set to the user whose inbox this email was found in
            thread = await prisma.emailThread.create({
              data: {
                organizationId,
                externalThreadId: email.threadId,
                subject: parsedEmail.subject,
                supplierId: supplier?.id,
                status: 'RESPONSE_RECEIVED', // Incoming email = response received
                createdById: systemUser.id,
                ownerUserId: userId, // Set the owner to the user whose inbox this came from
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
              userId, // Use this user's credentials for attachment downloads
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
          // (for updating quote request status — thread resolution already handled above)
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

              // Only queue additional extraction if the message ended up in a different thread
              // than the original. If thread was resolved via inReplyTo above, the message is
              // already in the correct thread and extraction was already queued.
              if (originalMessage.thread.id !== thread.id) {
                await quoteExtractionQueue.add('extract-quote', {
                  organizationId,
                  emailThreadId: originalMessage.thread.id,
                  emailMessageId: emailMessage.id,
                  userId,
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
          }

          processedCount++;
        } catch (emailError: any) {
          workerLogger.error({ err: emailError, emailId: email.id }, 'Error processing email');
          // Continue processing other emails
        }
      }

          totalProcessedCount += processedCount;
          totalSkippedCount += skippedCount;

          // Update sync state for THIS user
          if (emails.length > 0) {
            const lastEmail = emails[0]; // Emails are returned newest first

            await prisma.userEmailSyncState.upsert({
              where: { userId },
              update: {
                lastEmailId: lastEmail.id,
                lastSyncAt: new Date(),
                syncStatus: 'ACTIVE',
                errorCount: 0,
              },
              create: {
                userId,
                organizationId,
                lastEmailId: lastEmail.id,
                lastSyncAt: new Date(),
                syncStatus: 'ACTIVE',
                errorCount: 0,
              },
            });
          } else {
            // Update lastSyncAt even if no new emails for this user
            await prisma.userEmailSyncState.upsert({
              where: { userId },
              update: {
                lastSyncAt: new Date(),
                syncStatus: 'ACTIVE',
              },
              create: {
                userId,
                organizationId,
                lastSyncAt: new Date(),
                syncStatus: 'ACTIVE',
              },
            });
          }

          workerLogger.info({ userId, processedCount, skippedCount }, 'Completed processing inbox for user');

        } catch (userError: any) {
          workerLogger.error({ err: userError, userId }, 'Error processing inbox for user');

          // Update sync state with error for this user
          await prisma.userEmailSyncState.upsert({
            where: { userId },
            update: {
              syncStatus: 'ERROR',
              errorCount: { increment: 1 },
              lastSyncAt: new Date(),
            },
            create: {
              userId,
              organizationId,
              syncStatus: 'ERROR',
              errorCount: 1,
              lastSyncAt: new Date(),
            },
          }).catch((err) => {
            workerLogger.error({ err }, 'Failed to update user sync state with error');
          });

          // Continue processing other users - don't let one user's error block the others
        }
      }

      await job.updateProgress(90);

      // Also update the legacy EmailSyncState for backward compatibility
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
      }).catch((err) => {
        workerLogger.error({ err }, 'Failed to update legacy email sync state');
      });

      await job.updateProgress(100);

      workerLogger.info({ 
        jobId: job.id, 
        processedCount: totalProcessedCount, 
        skippedCount: totalSkippedCount,
        totalEmailsFound,
        usersProcessed: usersWithEmail.length
      }, 'Email monitor job completed');

      return {
        success: true,
        emailsFound: totalEmailsFound,
        emailsProcessed: totalProcessedCount,
        emailsSkipped: totalSkippedCount,
        usersProcessed: usersWithEmail.length,
      };
    } catch (error: any) {
      workerLogger.error({ err: error, jobId: job.id }, 'Email monitor job failed');

      // Error at job level (not user-specific) - log it but don't fail individual sync states
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
