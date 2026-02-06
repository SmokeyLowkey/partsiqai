import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailMonitorQueue } from '@/lib/queue/queues';
import { cronLogger } from '@/lib/logger';

/**
 * Cron Job: Email Monitor
 *
 * This endpoint triggers email monitoring for all organizations with Gmail configured.
 * Schedule: Every 5 minutes
 *
 * Setup with Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/email-monitor",
 *     "schedule": "0/5 * * * *"
 *   }]
 * }
 *
 * Or use an external cron service (cron-job.org, EasyCron, etc.)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cronLogger.info('Email monitor triggered');

    // Get all organizations with Gmail integration configured
    const organizations = await prisma.integrationCredential.findMany({
      where: {
        integrationType: 'GMAIL',
        isActive: true,
      },
      select: {
        organizationId: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    cronLogger.info({ count: organizations.length }, 'Found organizations with Gmail configured');

    // Queue email monitor jobs for each organization
    const jobPromises = organizations.map(async (org) => {
      const jobId = `email-monitor-${org.organizationId}-${Date.now()}`;

      // Check if there's already a pending/active job for this org
      const existingJob = await prisma.jobQueue.findFirst({
        where: {
          organizationId: org.organizationId,
          queueName: 'email-monitor',
          status: {
            in: ['PENDING', 'ACTIVE'],
          },
        },
      });

      if (existingJob) {
        cronLogger.debug({ org: org.organization.name }, 'Skipping - job already in progress');
        return null;
      }

      // Add job to queue
      const job = await (emailMonitorQueue as any).add(
        'monitor',
        {
          organizationId: org.organizationId,
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
          queueName: 'email-monitor',
          jobType: 'monitor',
          status: 'PENDING',
          organizationId: org.organizationId,
          data: {
            organizationId: org.organizationId,
          },
        },
      });

      cronLogger.info({ org: org.organization.name }, 'Queued email monitor job');

      return job.id;
    });

    const jobIds = (await Promise.all(jobPromises)).filter(Boolean);

    return NextResponse.json({
      success: true,
      message: 'Email monitor jobs queued',
      organizationsProcessed: organizations.length,
      jobsQueued: jobIds.length,
      jobIds,
    });
  } catch (error: any) {
    cronLogger.error({ err: error }, 'Email monitor error');

    return NextResponse.json(
      {
        error: 'Failed to trigger email monitoring',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req);
}
