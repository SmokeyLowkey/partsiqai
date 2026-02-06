import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { followUpQueue } from '@/lib/queue/queues';
import { cronLogger } from '@/lib/logger';

/**
 * Cron Job: Follow-Up Check
 *
 * This endpoint checks for quote requests that need follow-up emails.
 * It identifies suppliers who haven't responded after the expected response date.
 *
 * Schedule: Daily at 9 AM
 *
 * Setup with Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/follow-up-check",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cronLogger.info('Follow-up check triggered');

    const now = new Date();

    // Find all quote request email threads that:
    // 1. Have status 'SENT' (no response yet)
    // 2. Have an email message with expectedResponseBy < now
    // 3. Haven't had a follow-up sent yet OR last follow-up was > 3 days ago
    const overdueThreads = await prisma.quoteRequestEmailThread.findMany({
      where: {
        status: 'SENT',
        emailThread: {
          status: {
            in: ['WAITING_RESPONSE', 'SENT'],
          },
          messages: {
            some: {
              direction: 'OUTBOUND',
              expectedResponseBy: {
                lt: now,
              },
            },
          },
        },
      },
      include: {
        emailThread: {
          include: {
            messages: {
              orderBy: { sentAt: 'desc' },
              take: 5,
            },
          },
        },
        quoteRequest: {
          select: {
            id: true,
            quoteNumber: true,
            organizationId: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    cronLogger.info({ count: overdueThreads.length }, 'Found threads needing follow-up check');

    // Filter threads that haven't had a recent follow-up
    const threadsNeedingFollowUp = overdueThreads.filter((thread) => {
      const lastMessage = thread.emailThread.messages[0];

      // Check if the last outbound message was a follow-up and was sent recently
      const lastFollowUp = thread.emailThread.messages.find(
        (m) => m.direction === 'OUTBOUND' && m.followUpSentAt
      );

      if (!lastFollowUp) {
        // No follow-up sent yet
        return true;
      }

      // Check if last follow-up was more than 3 days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      return lastFollowUp.followUpSentAt && lastFollowUp.followUpSentAt < threeDaysAgo;
    });

    cronLogger.info({ count: threadsNeedingFollowUp.length }, 'Threads need follow-up emails');

    // Queue follow-up jobs
    const jobPromises = threadsNeedingFollowUp.map(async (thread) => {
      const jobId = `follow-up-${thread.id}-${Date.now()}`;

      // Check if there's already a pending job for this thread
      const existingJob = await prisma.jobQueue.findFirst({
        where: {
          queueName: 'follow-up',
          status: {
            in: ['PENDING', 'ACTIVE'],
          },
          data: {
            path: ['quoteRequestEmailThreadId'],
            equals: thread.id,
          },
        },
      });

      if (existingJob) {
        cronLogger.debug({ threadId: thread.id }, 'Skipping thread - job already in progress');
        return null;
      }

      // Add job to queue
      const job = await (followUpQueue as any).add(
        'send-follow-up',
        {
          organizationId: thread.quoteRequest.organizationId,
          quoteRequestId: thread.quoteRequest.id,
          quoteRequestEmailThreadId: thread.id,
          supplierId: thread.supplier.id,
          supplierName: thread.supplier.name,
          supplierEmail: thread.supplier.email,
          emailThreadId: thread.emailThread.id,
          quoteNumber: thread.quoteRequest.quoteNumber,
        },
        {
          jobId,
          removeOnComplete: {
            age: 3600,
            count: 20,
          },
          removeOnFail: {
            age: 86400,
            count: 50,
          },
        }
      );

      // Create database record
      await prisma.jobQueue.create({
        data: {
          jobId: job.id!,
          queueName: 'follow-up',
          jobType: 'send-follow-up',
          status: 'PENDING',
          organizationId: thread.quoteRequest.organizationId,
          data: {
            quoteRequestId: thread.quoteRequest.id,
            quoteRequestEmailThreadId: thread.id,
            supplierId: thread.supplier.id,
          },
        },
      });

      cronLogger.info({ supplier: thread.supplier.name, quote: thread.quoteRequest.quoteNumber }, 'Queued follow-up');

      return job.id;
    });

    const jobIds = (await Promise.all(jobPromises)).filter(Boolean);

    return NextResponse.json({
      success: true,
      message: 'Follow-up check completed',
      overdueThreadsFound: overdueThreads.length,
      followUpsQueued: jobIds.length,
      jobIds,
    });
  } catch (error: any) {
    cronLogger.error({ err: error }, 'Follow-up check error');

    return NextResponse.json(
      {
        error: 'Failed to check for follow-ups',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req);
}
