import { Job } from 'bullmq';
import { gunzipSync } from 'zlib';
import { IngestionBackend, IngestionOutboxStatus, IngestionJobStatus, IngestionPhaseStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { workerLogger } from '@/lib/logger';
import { verifyJobAuthorization } from '@/lib/queue/verify-job-authorization';
import { downloadFromS3 } from '@/lib/services/storage/s3-client';
import type { IngestionBackendWriteJobData } from '@/lib/queue/types';
import type { PartIngestionRecord } from '@/lib/services/ingestion/types';

type BackendPhaseField = 'postgresStatus' | 'pineconeStatus' | 'neo4jStatus';

function phaseField(backend: IngestionBackend): BackendPhaseField {
  switch (backend) {
    case 'POSTGRES': return 'postgresStatus';
    case 'PINECONE': return 'pineconeStatus';
    case 'NEO4J':    return 'neo4jStatus';
  }
}

export interface BackendProcessorArgs {
  records: PartIngestionRecord[];
  organizationId: string;
  ingestionJobId: string;
}

export interface BackendProcessorResult {
  success: number;
  failed: number;
}

export type BackendProcessor = (args: BackendProcessorArgs) => Promise<BackendProcessorResult>;

/**
 * Shared backend-write job handler. Each of the three backend worker files
 * wraps this with its own BullMQ `Worker`; all the tricky parts (authz
 * re-check, idempotency guard, status aggregation) live here so they stay
 * consistent across backends.
 */
export function makeBackendProcessor(opts: {
  backend: IngestionBackend;
  /** The role required to write this backend. POSTGRES requires MASTER_ADMIN; PINECONE/NEO4J require ADMIN. */
  requiredRole: 'MASTER_ADMIN' | 'ADMIN';
  process: BackendProcessor;
}) {
  const log = workerLogger.child({ worker: `ingestion-${opts.backend.toLowerCase()}` });

  return async function handle(job: Job<IngestionBackendWriteJobData>) {
    const { outboxId, backend } = job.data;
    if (backend !== opts.backend) {
      // Defensive: wrong queue for this row.
      throw new Error(`Backend mismatch: row=${backend} worker=${opts.backend}`);
    }

    const row = await prisma.ingestionOutbox.findUnique({
      where: { id: outboxId },
      include: { job: true },
    });
    if (!row) {
      log.warn({ outboxId }, 'Outbox row not found — was the job cancelled?');
      return;
    }

    // Idempotency: already-done rows skip silently. BullMQ retries and manual
    // retry-endpoint calls both route through here and both must be safe.
    if (row.status === IngestionOutboxStatus.OK) {
      log.info({ outboxId }, 'Outbox row already OK, skipping');
      return;
    }
    if (row.status === IngestionOutboxStatus.REJECTED) {
      log.warn({ outboxId }, 'Outbox row already REJECTED, skipping');
      return;
    }

    // Authz re-check: the initiator must still have the required role at
    // process time. Catches role downgrades between enqueue and process, plus
    // any future code path that enqueued a backend job without going through
    // the upload handler.
    try {
      await verifyJobAuthorization({
        organizationId: row.job.organizationId,
        initiatedById: row.job.userId,
        requiredRole: opts.requiredRole,
      });
    } catch (authErr: any) {
      log.error({ outboxId, err: authErr }, 'Authorization re-check failed at process time');
      await prisma.ingestionOutbox.update({
        where: { id: outboxId },
        data: {
          status: IngestionOutboxStatus.REJECTED,
          lastError: `Authorization failed: ${authErr.message}`,
          processedAt: new Date(),
        },
      });
      await recomputeJobStatus(row.ingestionJobId, opts.backend);
      return;
    }

    // Authz from the job itself: was this backend authorized at enqueue?
    if (!row.job.authorizedBackends.includes(opts.backend)) {
      log.error({ outboxId }, 'Backend not in authorizedBackends for this job');
      await prisma.ingestionOutbox.update({
        where: { id: outboxId },
        data: {
          status: IngestionOutboxStatus.REJECTED,
          lastError: `Backend ${opts.backend} not authorized for this job`,
          processedAt: new Date(),
        },
      });
      await recomputeJobStatus(row.ingestionJobId, opts.backend);
      return;
    }

    await prisma.ingestionOutbox.update({
      where: { id: outboxId },
      data: {
        status: IngestionOutboxStatus.IN_PROGRESS,
        attempts: { increment: 1 },
        startedAt: row.startedAt ?? new Date(),
      },
    });

    // Bump parent job backend-phase to IN_PROGRESS the first time any chunk
    // for this backend starts.
    await markPhaseInProgress(row.ingestionJobId, opts.backend);

    try {
      const chunkBuffer = await downloadFromS3(row.chunkS3Key);
      const records = JSON.parse(gunzipSync(chunkBuffer).toString('utf-8')) as PartIngestionRecord[];

      const result = await opts.process({
        records,
        organizationId: row.job.organizationId,
        ingestionJobId: row.ingestionJobId,
      });

      await prisma.ingestionOutbox.update({
        where: { id: outboxId },
        data: {
          status: IngestionOutboxStatus.OK,
          processedAt: new Date(),
          lastError: null,
        },
      });
      await prisma.ingestionJob.update({
        where: { id: row.ingestionJobId },
        data: {
          processedRecords: { increment: result.success + result.failed },
          successRecords: { increment: result.success },
          failedRecords: { increment: result.failed },
        },
      });
      await recomputeJobStatus(row.ingestionJobId, opts.backend);
      log.info({ outboxId, success: result.success, failed: result.failed }, 'Chunk OK');
    } catch (err: any) {
      log.error({ err, outboxId }, 'Chunk failed');
      await prisma.ingestionOutbox.update({
        where: { id: outboxId },
        data: {
          status: IngestionOutboxStatus.FAILED,
          lastError: (err?.message || String(err)).slice(0, 2000),
          processedAt: new Date(),
        },
      });
      await recomputeJobStatus(row.ingestionJobId, opts.backend);
      // Let BullMQ retry — the OK/REJECTED short-circuits at top handle the
      // idempotent case.
      throw err;
    }
  };
}

async function markPhaseInProgress(ingestionJobId: string, backend: IngestionBackend) {
  const field = phaseField(backend);
  // Only transition PENDING → IN_PROGRESS; never clobber a COMPLETED/SKIPPED.
  await prisma.ingestionJob.updateMany({
    where: { id: ingestionJobId, [field]: IngestionPhaseStatus.PENDING },
    data: { [field]: IngestionPhaseStatus.IN_PROGRESS },
  });
}

/**
 * Recompute the per-backend phase status and the overall job status based on
 * the current set of outbox rows for that backend. Called after every outbox
 * state change. Cheap because outbox rows are indexed on (backend, status).
 */
async function recomputeJobStatus(ingestionJobId: string, backend: IngestionBackend) {
  const rows = await prisma.ingestionOutbox.groupBy({
    by: ['status'],
    where: { ingestionJobId, backend },
    _count: { status: true },
  });

  const counts = Object.fromEntries(rows.map(r => [r.status, r._count.status])) as Partial<Record<IngestionOutboxStatus, number>>;
  const total = (counts.PENDING ?? 0) + (counts.IN_PROGRESS ?? 0) + (counts.OK ?? 0) + (counts.FAILED ?? 0) + (counts.REJECTED ?? 0);
  const field = phaseField(backend);

  let newPhaseStatus: IngestionPhaseStatus;
  if (total === 0) {
    newPhaseStatus = IngestionPhaseStatus.SKIPPED;
  } else if ((counts.PENDING ?? 0) > 0 || (counts.IN_PROGRESS ?? 0) > 0) {
    newPhaseStatus = IngestionPhaseStatus.IN_PROGRESS;
  } else if ((counts.FAILED ?? 0) > 0) {
    newPhaseStatus = IngestionPhaseStatus.FAILED;
  } else if ((counts.OK ?? 0) > 0) {
    newPhaseStatus = IngestionPhaseStatus.COMPLETED;
  } else {
    // All REJECTED
    newPhaseStatus = IngestionPhaseStatus.FAILED;
  }

  await prisma.ingestionJob.update({
    where: { id: ingestionJobId },
    data: { [field]: newPhaseStatus },
  });

  // Aggregate overall job status across all three backend phases.
  const job = await prisma.ingestionJob.findUnique({
    where: { id: ingestionJobId },
    select: { postgresStatus: true, pineconeStatus: true, neo4jStatus: true, status: true },
  });
  if (!job) return;

  const phases = [job.postgresStatus, job.pineconeStatus, job.neo4jStatus];
  const anyInProgress = phases.some(p => p === 'IN_PROGRESS' || p === 'PENDING');
  const anyFailed = phases.some(p => p === 'FAILED');
  const allDone = phases.every(p => p === 'COMPLETED' || p === 'SKIPPED' || p === 'FAILED');

  let newJobStatus: IngestionJobStatus | null = null;
  if (anyInProgress) {
    // Keep READY/PROCESSING as-is while work is ongoing.
    if (job.status === IngestionJobStatus.READY || job.status === IngestionJobStatus.PREPARING) {
      newJobStatus = IngestionJobStatus.PROCESSING;
    }
  } else if (allDone) {
    if (anyFailed) {
      newJobStatus = phases.some(p => p === 'COMPLETED')
        ? IngestionJobStatus.COMPLETED_WITH_ERRORS
        : IngestionJobStatus.FAILED;
    } else {
      newJobStatus = IngestionJobStatus.COMPLETED;
    }
  }

  if (newJobStatus && newJobStatus !== job.status) {
    await prisma.ingestionJob.update({
      where: { id: ingestionJobId },
      data: {
        status: newJobStatus,
        completedAt: newJobStatus === IngestionJobStatus.COMPLETED
          || newJobStatus === IngestionJobStatus.COMPLETED_WITH_ERRORS
          || newJobStatus === IngestionJobStatus.FAILED
          ? new Date()
          : undefined,
      },
    });
  }
}
