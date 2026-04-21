import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cronLogger } from '@/lib/logger';
import { verifyCronAuth } from '@/lib/api-utils';

// Chunk size for paged deletes. Big enough to keep round-trip count low,
// small enough that each DELETE stays inside Postgres' fast-path locking
// (roughly what pg expects for short statements) and below Render's
// statement-timeout defaults on customer-tier plans.
const DELETE_BATCH = 1000;

// Run the provided `selectBatch(take)` → `ids[]` and then delete those ids,
// repeating until selectBatch returns fewer rows than `take`. Returns total
// rows deleted. Keeps each statement short so a single cleanup run can never
// lock an entire cleanup-target table for minutes.
async function deleteInBatches(
  label: string,
  selectBatch: (take: number) => Promise<Array<{ id: string }>>,
  deleteByIds: (ids: string[]) => Promise<{ count: number }>,
): Promise<number> {
  let total = 0;
  // Safety upper bound: don't loop forever if deletes aren't happening.
  // 100k rows × 1000 per batch = 100 iterations, ~hundreds of ms each.
  for (let i = 0; i < 100; i++) {
    const batch = await selectBatch(DELETE_BATCH);
    if (batch.length === 0) break;

    const result = await deleteByIds(batch.map((r) => r.id));
    total += result.count;
    cronLogger.debug({ label, iter: i, deleted: result.count, runningTotal: total }, 'Cleanup batch');

    if (batch.length < DELETE_BATCH) break;
  }
  return total;
}

/**
 * Cron Job: Cleanup Old Jobs
 *
 * This endpoint cleans up old completed/failed jobs from the database.
 * Schedule: Daily at midnight
 *
 * Setup with Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-jobs",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security (timing-safe)
    if (!verifyCronAuth(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cronLogger.info('Job cleanup triggered');
    const now = new Date();

    // 1. Completed jobs older than 7 days. Each previous unbounded deleteMany
    //    could lock the table for seconds on a customer with heavy queue
    //    turnover; batched deletes keep per-statement scope tight.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const completedDeletedCount = await deleteInBatches(
      'jobQueue.completed',
      (take) =>
        prisma.jobQueue.findMany({
          where: { status: 'COMPLETED', completedAt: { lt: sevenDaysAgo } },
          select: { id: true },
          take,
          orderBy: { id: 'asc' },
        }),
      (ids) => prisma.jobQueue.deleteMany({ where: { id: { in: ids } } }),
    );
    cronLogger.info({ count: completedDeletedCount }, 'Deleted completed jobs');

    // 2. Failed jobs older than 30 days.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const failedDeletedCount = await deleteInBatches(
      'jobQueue.failed',
      (take) =>
        prisma.jobQueue.findMany({
          where: { status: 'FAILED', failedAt: { lt: thirtyDaysAgo } },
          select: { id: true },
          take,
          orderBy: { id: 'asc' },
        }),
      (ids) => prisma.jobQueue.deleteMany({ where: { id: { in: ids } } }),
    );
    cronLogger.info({ count: failedDeletedCount }, 'Deleted failed jobs');

    // 3. Stuck jobs (ACTIVE > 1 hour) — not deleted, marked FAILED. Paginate
    //    the scan so a large backlog doesn't load into memory at once.
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    let stuckCursor: string | undefined;
    let stuckMarked = 0;
    while (true) {
      const batch = await prisma.jobQueue.findMany({
        where: { status: 'ACTIVE', startedAt: { lt: oneHourAgo } },
        select: { id: true },
        take: DELETE_BATCH,
        orderBy: { id: 'asc' },
        ...(stuckCursor ? { cursor: { id: stuckCursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;
      await prisma.jobQueue.updateMany({
        where: { id: { in: batch.map((r) => r.id) } },
        data: {
          status: 'FAILED',
          error: 'Job timed out - exceeded 1 hour execution time',
          failedAt: new Date(),
        },
      });
      stuckMarked += batch.length;
      if (batch.length < DELETE_BATCH) break;
      stuckCursor = batch[batch.length - 1].id;
    }
    cronLogger.info({ count: stuckMarked }, 'Marked stuck jobs as failed');

    // 4. Expired password reset tokens.
    const expiredResetsCount = await deleteInBatches(
      'passwordReset.expired',
      (take) =>
        prisma.passwordReset.findMany({
          where: { expires: { lt: now } },
          select: { id: true },
          take,
          orderBy: { id: 'asc' },
        }),
      (ids) => prisma.passwordReset.deleteMany({ where: { id: { in: ids } } }),
    );
    cronLogger.info({ count: expiredResetsCount }, 'Deleted expired password reset tokens');

    // 5. Expired verification tokens. `verificationToken` uses a composite
    //    primary key (identifier, token), so batch by identifier.
    let verifDeletedCount = 0;
    for (let i = 0; i < 100; i++) {
      const batch = await prisma.verificationToken.findMany({
        where: { expires: { lt: now } },
        select: { identifier: true, token: true },
        take: DELETE_BATCH,
      });
      if (batch.length === 0) break;
      const result = await prisma.verificationToken.deleteMany({
        where: { OR: batch.map((r) => ({ identifier: r.identifier, token: r.token })) },
      });
      verifDeletedCount += result.count;
      if (batch.length < DELETE_BATCH) break;
    }
    cronLogger.info({ count: verifDeletedCount }, 'Deleted expired verification tokens');

    // 6. Expired NextAuth sessions.
    const expiredSessionsCount = await deleteInBatches(
      'session.expired',
      (take) =>
        prisma.session.findMany({
          where: { expires: { lt: now } },
          select: { id: true },
          take,
          orderBy: { id: 'asc' },
        }),
      (ids) => prisma.session.deleteMany({ where: { id: { in: ids } } }),
    );
    cronLogger.info({ count: expiredSessionsCount }, 'Deleted expired sessions');

    // 7. Retention on processed_webhooks: 30 days covers every provider's
    //    retry window (Stripe ~3 days, Svix/Resend hours, Vapi minutes).
    //    Composite PK (source, externalId) — batch by those columns.
    const webhookCutoff = new Date();
    webhookCutoff.setDate(webhookCutoff.getDate() - 30);
    let processedWebhooksCount = 0;
    for (let i = 0; i < 100; i++) {
      const batch = await prisma.processedWebhook.findMany({
        where: { processedAt: { lt: webhookCutoff } },
        select: { source: true, externalId: true },
        take: DELETE_BATCH,
      });
      if (batch.length === 0) break;
      const result = await prisma.processedWebhook.deleteMany({
        where: { OR: batch.map((r) => ({ source: r.source, externalId: r.externalId })) },
      });
      processedWebhooksCount += result.count;
      if (batch.length < DELETE_BATCH) break;
    }
    cronLogger.info({ count: processedWebhooksCount }, 'Deleted old processed webhook rows');

    return NextResponse.json({
      success: true,
      message: 'Job cleanup completed',
      completedJobsDeleted: completedDeletedCount,
      failedJobsDeleted: failedDeletedCount,
      stuckJobsMarkedFailed: stuckMarked,
      expiredResetsDeleted: expiredResetsCount,
      expiredVerificationsDeleted: verifDeletedCount,
      expiredSessionsDeleted: expiredSessionsCount,
      processedWebhooksDeleted: processedWebhooksCount,
    });
  } catch (error: any) {
    cronLogger.error({ err: error }, 'Job cleanup error');

    return NextResponse.json(
      {
        error: 'Failed to cleanup jobs',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req);
}
