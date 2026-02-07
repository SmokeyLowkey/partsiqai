// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { PartsIngestionJobData } from '@/lib/queue/types';
import { runIngestion } from '@/lib/services/ingestion/pipeline';
import { prisma } from '@/lib/prisma';
import { workerLogger } from '@/lib/logger';

const QUEUE_NAME = 'parts-ingestion';

async function processIngestionJob(job: Job<PartsIngestionJobData>): Promise<void> {
  const logger = workerLogger.child({
    jobId: job.id,
    ingestionJobId: job.data.ingestionJobId,
    organizationId: job.data.organizationId,
  });

  logger.info('Starting parts ingestion job');

  try {
    // Mark as started
    await prisma.ingestionJob.update({
      where: { id: job.data.ingestionJobId },
      data: { status: 'VALIDATING', startedAt: new Date() },
    });

    await runIngestion(job.data, async (progress) => {
      // Update BullMQ progress
      await job.updateProgress(progress.percent);

      // Update DB record
      await prisma.ingestionJob.update({
        where: { id: job.data.ingestionJobId },
        data: {
          totalRecords: progress.total,
          processedRecords: progress.processed,
          successRecords: progress.success,
          failedRecords: progress.failed,
          postgresStatus: progress.postgresStatus as any,
          pineconeStatus: progress.pineconeStatus as any,
          neo4jStatus: progress.neo4jStatus as any,
          status: progress.overallStatus as any,
          ...(progress.phase === 'completed' ? { completedAt: new Date() } : {}),
        },
      });
    }, logger);

    logger.info('Ingestion job completed successfully');
  } catch (error: any) {
    logger.error({ err: error }, 'Ingestion job failed');

    await prisma.ingestionJob.update({
      where: { id: job.data.ingestionJobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errors: [{ row: 0, field: 'pipeline', message: error.message }],
      },
    });

    throw error;
  }
}

export const partsIngestionWorker = new Worker<PartsIngestionJobData>(
  QUEUE_NAME,
  async (job) => {
    await processIngestionJob(job);
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

partsIngestionWorker.on('completed', (job) => {
  workerLogger.info({ jobId: job.id }, 'Parts ingestion job completed');
});

partsIngestionWorker.on('failed', (job, err) => {
  workerLogger.error({ err, jobId: job?.id }, 'Parts ingestion job failed');
});

partsIngestionWorker.on('error', (err) => {
  workerLogger.error({ err }, 'Parts ingestion worker error');
});

workerLogger.info({ queue: QUEUE_NAME }, 'Parts Ingestion Worker started');
