// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { PartsSearchJobData } from '@/lib/queue/types';
import { MultiAgentOrchestrator } from '@/lib/services/search/multi-agent-orchestrator';
import { prisma } from '@/lib/prisma';
import { workerLogger } from '@/lib/logger';

const QUEUE_NAME = 'parts-search';

// Create worker
export const partsSearchWorker = new Worker<PartsSearchJobData>(
  QUEUE_NAME,
  async (job: Job<PartsSearchJobData>) => {
    workerLogger.info({ jobId: job.id, jobData: job.data }, 'Processing parts search job');

    const { organizationId, conversationId, query, vehicleContext } = job.data;

    try {
      // Initialize multi-agent orchestrator
      const orchestrator = new MultiAgentOrchestrator();

      // Execute search with formatting
      workerLogger.info({ query }, 'Executing multi-agent search');
      const searchResults = await orchestrator.searchWithFormatting(
        query,
        organizationId,
        vehicleContext
      );

      // Save results to conversation if exists
      if (conversationId && conversationId !== `temp-${Date.now()}`) {
        const conversation = await prisma.chatConversation.findUnique({
          where: { id: conversationId },
        });

        if (conversation) {
          // Save assistant message with search results
          await prisma.chatMessage.create({
            data: {
              conversationId,
              role: 'ASSISTANT',
              content: searchResults.messageText,
              messageType: 'PART_RECOMMENDATION',
              metadata: {
                formattedResponse: searchResults,
                searchMetadata: searchResults.metadata,
              } as any,
            },
          });

          workerLogger.info({ conversationId }, 'Saved search results to conversation');
        }
      }

      await job.updateProgress(100);

      workerLogger.info({ jobId: job.id }, 'Parts search job completed successfully');

      return {
        success: true,
        results: searchResults,
      };
    } catch (error: any) {
      workerLogger.error({ err: error, jobId: job.id }, 'Parts search job failed');

      // Update database job record
      await prisma.jobQueue.update({
        where: { jobId: job.id! },
        data: {
          status: 'FAILED',
          error: error.message,
          failedAt: new Date(),
          attempts: job.attemptsMade,
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // per 60 seconds
    },
  }
);

// Event handlers
partsSearchWorker.on('completed', async (job) => {
  workerLogger.info({ jobId: job.id }, 'Job completed');

  // Update database job record
  await prisma.jobQueue.update({
    where: { jobId: job.id! },
    data: {
      status: 'COMPLETED',
      result: job.returnvalue,
      completedAt: new Date(),
    },
  });
});

partsSearchWorker.on('failed', async (job, err) => {
  workerLogger.error({ err, jobId: job?.id }, 'Job failed');

  if (job) {
    await prisma.jobQueue.update({
      where: { jobId: job.id! },
      data: {
        status: 'FAILED',
        error: err.message,
        failedAt: new Date(),
        attempts: job.attemptsMade,
      },
    });
  }
});

partsSearchWorker.on('active', async (job) => {
  workerLogger.info({ jobId: job.id }, 'Job started processing');

  await prisma.jobQueue.update({
    where: { jobId: job.id! },
    data: {
      status: 'ACTIVE',
      startedAt: new Date(),
    },
  });
});

partsSearchWorker.on('progress', (job, progress) => {
  workerLogger.debug({ jobId: job.id, progress }, 'Job progress');
});

partsSearchWorker.on('error', (err) => {
  workerLogger.error({ err }, 'Worker error');
});

workerLogger.info('Parts search worker started');
