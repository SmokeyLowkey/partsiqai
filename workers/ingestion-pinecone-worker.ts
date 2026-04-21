require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker } from 'bullmq';
import { createWorkerConnection } from '@/lib/queue/connection';
import { QUEUE_NAMES } from '@/lib/queue/queues';
import type { IngestionBackendWriteJobData } from '@/lib/queue/types';
import { workerLogger } from '@/lib/logger';
import { IngestionBackend } from '@prisma/client';
import { ingestToPinecone } from '@/lib/services/ingestion/pinecone-ingester';
import { mergeRecords } from '@/lib/services/ingestion/record-merger';
import { makeBackendProcessor } from './ingestion-backend-common';

const log = workerLogger.child({ worker: 'ingestion-pinecone' });

// Pinecone is per-org namespaced — org ADMIN can write their own slice.
const processor = makeBackendProcessor({
  backend: IngestionBackend.PINECONE,
  requiredRole: 'ADMIN',
  process: async ({ records, organizationId }) => {
    const merged = mergeRecords(records);
    const result = await ingestToPinecone(merged, organizationId, () => {}, log);
    return { success: result.success, failed: result.failed };
  },
});

export const ingestionPineconeWorker = new Worker<IngestionBackendWriteJobData>(
  QUEUE_NAMES.INGESTION_PINECONE,
  processor,
  {
    connection: createWorkerConnection(),
    concurrency: 3, // Pinecone upserts are I/O bound; 3 keeps its SDK happy without rate limiting
    drainDelay: 30,
  },
);

ingestionPineconeWorker.on('failed', (job, err) => {
  log.error({ err, jobId: job?.id }, 'Pinecone chunk failed');
});
