// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker, Job } from 'bullmq';
import { gzipSync } from 'zlib';
import { z } from 'zod';
import { parse as csvParseStream } from 'csv-parse';
// stream-json has no type exports for the composition helpers we use; the
// surface is small so we type the pieces ad hoc.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parser: jsonParser } = require('stream-json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pick } = require('stream-json/filters/Pick');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { streamArray } = require('stream-json/streamers/StreamArray');

import { createWorkerConnection } from '@/lib/queue/connection';
import {
  QUEUE_NAMES,
  ingestionPostgresQueue,
  ingestionPineconeQueue,
  ingestionNeo4jQueue,
} from '@/lib/queue/queues';
import type {
  IngestionPrepareJobData,
  IngestionBackendWriteJobData,
} from '@/lib/queue/types';
import { prisma } from '@/lib/prisma';
import { workerLogger } from '@/lib/logger';
import { verifyJobAuthorization } from '@/lib/queue/verify-job-authorization';
import { openS3Stream, uploadChunkToS3 } from '@/lib/services/storage/s3-client';
import { normalizeJsonPart, normalizeCsvRow, dedupKey } from '@/lib/services/ingestion/record-normalizer';
import type { PartIngestionRecord, IngestionFileMetadata } from '@/lib/services/ingestion/types';
import { IngestionBackend, IngestionJobStatus } from '@prisma/client';

const logger = workerLogger.child({ worker: 'ingestion-prepare' });

// Records per chunk. Tuned so a full chunk's JSON stays <5 MB uncompressed
// and each backend writer's in-memory footprint per job stays small.
const CHUNK_SIZE = 5000;

// Zod re-used from validators.ts but inlined to avoid importing the whole
// non-streaming validator module (which builds per-file arrays).
const PartRecordSchema = z.object({
  partNumber: z.string().min(1).max(50).trim(),
  partTitle: z.string().min(1).max(500).trim(),
  manufacturer: z.string().min(1).max(100).trim(),
  machineModel: z.string().min(1).max(200).trim(),
  namespace: z.string().max(100).trim().optional(),
  categoryBreadcrumb: z.string().max(500).trim().optional(),
  diagramTitle: z.string().max(500).trim().optional(),
  serialNumberRange: z.string().max(500).trim().optional(),
  technicalDomain: z.string().max(100).trim().optional(),
  quantity: z.string().max(20).trim().optional(),
  remarks: z.string().max(1000).trim().optional(),
  sourceUrl: z.string().max(2000).optional(),
  price: z.number().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
});

async function enqueueBackendJobs(outboxRows: Array<{ id: string; backend: IngestionBackend }>) {
  for (const row of outboxRows) {
    const payload: IngestionBackendWriteJobData = { outboxId: row.id, backend: row.backend };
    if (row.backend === IngestionBackend.POSTGRES) {
      await ingestionPostgresQueue.add('write', payload, { jobId: row.id });
    } else if (row.backend === IngestionBackend.PINECONE) {
      await ingestionPineconeQueue.add('write', payload, { jobId: row.id });
    } else {
      await ingestionNeo4jQueue.add('write', payload, { jobId: row.id });
    }
  }
}

/**
 * Async iterator yielding normalized PartIngestionRecords from a JSON stream.
 * Expects the top-level shape `{metadata: {...}, parts: [...]}`; extracts
 * metadata from the upload options instead of the file (metadata may stream
 * after `parts` and we don't want to delay chunking).
 */
async function* streamJsonRecords(
  stream: NodeJS.ReadableStream,
  metadata: IngestionFileMetadata,
): AsyncGenerator<PartIngestionRecord> {
  const pipeline = stream.pipe(jsonParser()).pipe(pick({ filter: 'parts' })).pipe(streamArray());
  for await (const { value } of pipeline as AsyncIterable<{ key: number; value: any }>) {
    yield normalizeJsonPart(value, metadata);
  }
}

async function* streamCsvRecords(
  stream: NodeJS.ReadableStream,
  defaults: IngestionFileMetadata,
): AsyncGenerator<PartIngestionRecord> {
  const parser = csvParseStream({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
  stream.pipe(parser);
  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    yield normalizeCsvRow(row, defaults);
  }
}

async function processPrepare(job: Job<IngestionPrepareJobData>) {
  const { ingestionJobId } = job.data;
  logger.info({ ingestionJobId }, 'Prepare job started');

  const ingestionJob = await prisma.ingestionJob.findUnique({ where: { id: ingestionJobId } });
  if (!ingestionJob) throw new Error(`IngestionJob ${ingestionJobId} not found`);

  // Re-verify tenant still exists + initiating user still has their role.
  // MASTER_ADMIN requirement only applies if this job was MASTER-authorized;
  // otherwise org ADMIN is sufficient to write chunks to S3 for Pinecone/Neo4j.
  await verifyJobAuthorization({
    organizationId: ingestionJob.organizationId,
    initiatedById: ingestionJob.userId,
    requiredRole: ingestionJob.initiatedByRole,
  });

  await prisma.ingestionJob.update({
    where: { id: ingestionJobId },
    data: { status: IngestionJobStatus.PREPARING, startedAt: new Date() },
  });

  const options = (ingestionJob.options as any) || {};
  const defaults: IngestionFileMetadata = {
    manufacturer: options.defaultManufacturer,
    machineModel: options.defaultMachineModel,
    namespace: options.defaultNamespace,
    technicalDomain: options.defaultTechnicalDomain,
    serialNumberRange: options.defaultSerialNumberRange,
  };

  const s3Stream = await openS3Stream(ingestionJob.s3Key);
  const recordIter =
    ingestionJob.fileType === 'csv'
      ? streamCsvRecords(s3Stream, defaults)
      : streamJsonRecords(s3Stream, defaults);

  // In-memory state: current chunk buffer + cross-chunk dedup keys + counters.
  // Memory bound: buffer = CHUNK_SIZE * ~2KB/record ≈ 10MB. Dedup Set =
  // ~40B/key × 1M records ≈ 40MB. Safe on Standard (2GB).
  let buffer: PartIngestionRecord[] = [];
  const seenKeys = new Set<string>();
  let totalRecords = 0;
  let validRecords = 0;
  let invalidRecords = 0;
  let duplicateRecords = 0;
  let chunkIndex = 0;
  const writtenChunks: number[] = [];

  const flushChunk = async () => {
    if (buffer.length === 0) return;
    const thisChunkIndex = chunkIndex;
    chunkIndex += 1;

    const chunkS3Key = `${ingestionJob.s3Key}.chunks/batch-${String(thisChunkIndex).padStart(6, '0')}.json.gz`;
    const gz = gzipSync(Buffer.from(JSON.stringify(buffer)));
    await uploadChunkToS3(chunkS3Key, gz, 'application/gzip', {
      ingestionJobId,
      chunkIndex: String(thisChunkIndex),
      recordCount: String(buffer.length),
    });

    // Create one outbox row per authorized backend. Enqueued at end of the
    // stream so a mid-stream failure doesn't leave half-processed backend
    // jobs running.
    await prisma.ingestionOutbox.createMany({
      data: ingestionJob.authorizedBackends.map((backend) => ({
        ingestionJobId,
        backend,
        chunkIndex: thisChunkIndex,
        chunkS3Key,
        recordCount: buffer.length,
      })),
      skipDuplicates: true, // in case of retry after partial progress
    });

    writtenChunks.push(thisChunkIndex);
    logger.info(
      { ingestionJobId, chunkIndex: thisChunkIndex, records: buffer.length },
      'Chunk written',
    );
    buffer = [];
    await prisma.ingestionJob.update({
      where: { id: ingestionJobId },
      data: { preparedChunks: writtenChunks.length },
    });
  };

  try {
    for await (const record of recordIter) {
      totalRecords += 1;

      const result = PartRecordSchema.safeParse(record);
      if (!result.success) {
        invalidRecords += 1;
        continue;
      }

      const key = dedupKey(record);
      if (seenKeys.has(key)) {
        duplicateRecords += 1;
        continue;
      }
      seenKeys.add(key);
      validRecords += 1;
      buffer.push(record);

      if (buffer.length >= CHUNK_SIZE) {
        await flushChunk();
        // Allow other microtasks (BullMQ heartbeat, logger) to run so we
        // don't starve the event loop even on the dedicated ingestion
        // worker process.
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    // Final partial chunk
    await flushChunk();

    // If nothing valid came out of the file, flag job FAILED rather than
    // silently COMPLETED with 0 records.
    if (validRecords === 0) {
      await prisma.ingestionJob.update({
        where: { id: ingestionJobId },
        data: {
          status: IngestionJobStatus.FAILED,
          errors: [{ phase: 'prepare', message: 'No valid records found in file' }] as any,
          totalRecords,
          failedRecords: invalidRecords,
          completedAt: new Date(),
        },
      });
      logger.warn({ ingestionJobId, totalRecords }, 'Prepare produced zero valid records');
      return;
    }

    // Enqueue all backend-write jobs only after every chunk + outbox row
    // is durably committed. If the queue `add` calls race with a process
    // crash we're fine — the outbox rows are the source of truth and the
    // retry endpoint re-enqueues any PENDING rows.
    const pendingOutbox = await prisma.ingestionOutbox.findMany({
      where: { ingestionJobId, status: 'PENDING' },
      select: { id: true, backend: true },
    });
    await enqueueBackendJobs(pendingOutbox);

    await prisma.ingestionJob.update({
      where: { id: ingestionJobId },
      data: {
        status: IngestionJobStatus.READY,
        totalRecords,
        successRecords: 0, // incremented by backend writers
        failedRecords: invalidRecords,
        totalChunks: writtenChunks.length,
        preparedChunks: writtenChunks.length,
        warnings: duplicateRecords > 0
          ? ([{ message: `${duplicateRecords} duplicate records skipped` }] as any)
          : undefined,
      },
    });

    logger.info(
      {
        ingestionJobId,
        totalRecords,
        validRecords,
        invalidRecords,
        duplicateRecords,
        chunks: writtenChunks.length,
        backends: ingestionJob.authorizedBackends,
      },
      'Prepare job complete',
    );
  } catch (err: any) {
    logger.error({ err, ingestionJobId }, 'Prepare job failed');
    await prisma.ingestionJob.update({
      where: { id: ingestionJobId },
      data: {
        status: IngestionJobStatus.FAILED,
        errors: [{ phase: 'prepare', message: err.message }] as any,
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

export const ingestionPrepareWorker = new Worker<IngestionPrepareJobData>(
  QUEUE_NAMES.INGESTION_PREPARE,
  processPrepare,
  {
    connection: createWorkerConnection(),
    concurrency: 1, // CPU-bound; never run more than one prepare at a time per process
    drainDelay: 30,
  },
);

ingestionPrepareWorker.on('failed', (job, err) => {
  logger.error({ err, jobId: job?.id }, 'ingestion-prepare failed');
});
