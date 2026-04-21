require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker } from 'bullmq';
import { createWorkerConnection } from '@/lib/queue/connection';
import { QUEUE_NAMES } from '@/lib/queue/queues';
import type { IngestionBackendWriteJobData } from '@/lib/queue/types';
import { workerLogger } from '@/lib/logger';
import { IngestionBackend } from '@prisma/client';
import { ingestToPostgres } from '@/lib/services/ingestion/postgres-ingester';
import { mergeRecords } from '@/lib/services/ingestion/record-merger';
import { makeBackendProcessor } from './ingestion-backend-common';

const log = workerLogger.child({ worker: 'ingestion-postgres' });

// Postgres writes to the shared platform parts catalog → gated to MASTER_ADMIN.
// Backend-common re-verifies this at process time.
const processor = makeBackendProcessor({
  backend: IngestionBackend.POSTGRES,
  requiredRole: 'MASTER_ADMIN',
  process: async ({ records, organizationId }) => {
    // Run the legacy in-chunk merge so records sharing partNumber +
    // categoryBreadcrumb collapse into one upsert with `mergedEntries`.
    const merged = mergeRecords(records);
    const result = await ingestToPostgres(merged, organizationId, () => {}, log);
    return { success: result.success, failed: result.failed };
  },
});

export const ingestionPostgresWorker = new Worker<IngestionBackendWriteJobData>(
  QUEUE_NAMES.INGESTION_POSTGRES,
  processor,
  {
    connection: createWorkerConnection(),
    concurrency: 2, // Prisma connection pool limits how aggressive we can be
    drainDelay: 30,
  },
);

ingestionPostgresWorker.on('failed', (job, err) => {
  log.error({ err, jobId: job?.id }, 'Postgres chunk failed');
});
