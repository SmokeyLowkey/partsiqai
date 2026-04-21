require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker } from 'bullmq';
import { createWorkerConnection } from '@/lib/queue/connection';
import { QUEUE_NAMES } from '@/lib/queue/queues';
import type { IngestionBackendWriteJobData } from '@/lib/queue/types';
import { workerLogger } from '@/lib/logger';
import { IngestionBackend } from '@prisma/client';
import { ingestToNeo4j } from '@/lib/services/ingestion/neo4j-ingester';
import { mergeRecords } from '@/lib/services/ingestion/record-merger';
import { makeBackendProcessor } from './ingestion-backend-common';

const log = workerLogger.child({ worker: 'ingestion-neo4j' });

const processor = makeBackendProcessor({
  backend: IngestionBackend.NEO4J,
  requiredRole: 'ADMIN',
  process: async ({ records, organizationId }) => {
    const merged = mergeRecords(records);
    const result = await ingestToNeo4j(merged, organizationId, () => {}, log);
    return { success: result.success, failed: result.failed };
  },
});

export const ingestionNeo4jWorker = new Worker<IngestionBackendWriteJobData>(
  QUEUE_NAMES.INGESTION_NEO4J,
  processor,
  {
    connection: createWorkerConnection(),
    concurrency: 2, // Neo4j MERGE locks are node-scoped; too much parallelism = deadlock risk
    drainDelay: 30,
  },
);

ingestionNeo4jWorker.on('failed', (job, err) => {
  log.error({ err, jobId: job?.id }, 'Neo4j chunk failed');
});
