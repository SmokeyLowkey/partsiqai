import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { followUpQueue } from '@/lib/queue/queues';
import { cronLogger } from '@/lib/logger';
import { verifyCronAuth } from '@/lib/api-utils';

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
const BATCH_SIZE = 200; // Smaller than maintenance-alerts because rows are much fatter (nested includes).

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security (timing-safe)
    if (!verifyCronAuth(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cronLogger.info('Follow-up check triggered');

    const now = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Cursor-paginate the overdue-threads query. The original `findMany`
    // loaded the entire result set plus a nested `messages.take(5)` include,
    // so a customer with thousands of open threads could push us past the
    // serverless memory ceiling. Paginate + stream work into the queue.
    let cursor: string | undefined;
    let overdueThreadsFound = 0;
    const jobIds: string[] = [];

    while (true) {
      const batch = await prisma.quoteRequestEmailThread.findMany({
        where: {
          status: 'SENT',
          emailThread: {
            status: { in: ['WAITING_RESPONSE', 'SENT'] },
            messages: {
              some: {
                direction: 'OUTBOUND',
                expectedResponseBy: { lt: now },
              },
            },
          },
        },
        include: {
          emailThread: {
            include: {
              messages: { orderBy: { sentAt: 'desc' }, take: 5 },
            },
          },
          quoteRequest: { select: { id: true, quoteNumber: true, organizationId: true } },
          supplier: { select: { id: true, name: true, email: true } },
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      overdueThreadsFound += batch.length;

      // Filter threads that haven't had a recent follow-up.
      const needs = batch.filter((thread) => {
        const lastFollowUp = thread.emailThread.messages.find(
          (m) => m.direction === 'OUTBOUND' && m.followUpSentAt
        );
        if (!lastFollowUp) return true;
        return lastFollowUp.followUpSentAt && lastFollowUp.followUpSentAt < threeDaysAgo;
      });

      // Queue jobs for this batch. Sequential inside the batch to bound
      // concurrent BullMQ adds — a spike of 500 concurrent `queue.add` calls
      // against Upstash Redis is worse than a steady trickle.
      for (const thread of needs) {
        const jobId = `follow-up-${thread.id}-${Date.now()}`;

        const existingJob = await prisma.jobQueue.findFirst({
          where: {
            queueName: 'follow-up',
            status: { in: ['PENDING', 'ACTIVE'] },
            data: { path: ['quoteRequestEmailThreadId'], equals: thread.id },
          },
        });
        if (existingJob) {
          cronLogger.debug({ threadId: thread.id }, 'Skipping thread - job already in progress');
          continue;
        }

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
            removeOnComplete: { age: 3600, count: 20 },
            removeOnFail: { age: 86400, count: 50 },
          }
        );

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

        cronLogger.info(
          { supplier: thread.supplier.name, quote: thread.quoteRequest.quoteNumber },
          'Queued follow-up'
        );
        if (job.id) jobIds.push(job.id);
      }

      if (batch.length < BATCH_SIZE) break;
      cursor = batch[batch.length - 1].id;
    }

    cronLogger.info({ overdueThreadsFound, followUpsQueued: jobIds.length }, 'Follow-up check complete');

    return NextResponse.json({
      success: true,
      message: 'Follow-up check completed',
      overdueThreadsFound,
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
