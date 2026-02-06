import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cronLogger } from '@/lib/logger';

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
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cronLogger.info('Job cleanup triggered');

    // Delete completed jobs older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const completedDeleted = await prisma.jobQueue.deleteMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    cronLogger.info({ count: completedDeleted.count }, 'Deleted completed jobs');

    // Delete failed jobs older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const failedDeleted = await prisma.jobQueue.deleteMany({
      where: {
        status: 'FAILED',
        failedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    cronLogger.info({ count: failedDeleted.count }, 'Deleted failed jobs');

    // Delete stuck jobs (active for more than 1 hour)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const stuckJobs = await prisma.jobQueue.findMany({
      where: {
        status: 'ACTIVE',
        startedAt: {
          lt: oneHourAgo,
        },
      },
    });

    // Mark stuck jobs as failed instead of deleting
    for (const job of stuckJobs) {
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: 'Job timed out - exceeded 1 hour execution time',
          failedAt: new Date(),
        },
      });
    }

    cronLogger.info({ count: stuckJobs.length }, 'Marked stuck jobs as failed');

    // Clean up expired password reset tokens
    const expiredResets = await prisma.passwordReset.deleteMany({
      where: {
        expires: { lt: new Date() },
      },
    });
    cronLogger.info({ count: expiredResets.count }, 'Deleted expired password reset tokens');

    // Clean up expired verification tokens
    const expiredVerifications = await prisma.verificationToken.deleteMany({
      where: {
        expires: { lt: new Date() },
      },
    });
    cronLogger.info({ count: expiredVerifications.count }, 'Deleted expired verification tokens');

    // Clean up expired sessions
    const expiredSessions = await prisma.session.deleteMany({
      where: {
        expires: { lt: new Date() },
      },
    });
    cronLogger.info({ count: expiredSessions.count }, 'Deleted expired sessions');

    return NextResponse.json({
      success: true,
      message: 'Job cleanup completed',
      completedJobsDeleted: completedDeleted.count,
      failedJobsDeleted: failedDeleted.count,
      stuckJobsMarkedFailed: stuckJobs.length,
      expiredResetsDeleted: expiredResets.count,
      expiredVerificationsDeleted: expiredVerifications.count,
      expiredSessionsDeleted: expiredSessions.count,
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
