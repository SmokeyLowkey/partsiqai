import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  ingestionPrepareQueue,
  ingestionPostgresQueue,
  ingestionPineconeQueue,
  ingestionNeo4jQueue,
} from '@/lib/queue/queues';
import type { IngestionPrepareJobData, IngestionBackendWriteJobData } from '@/lib/queue/types';
import { IngestionBackend, IngestionJobStatus, IngestionOutboxStatus } from '@prisma/client';
import { withHardening } from '@/lib/api/with-hardening';
import { auditAdminAction } from '@/lib/audit-admin';

/**
 * Retry endpoint for the chunked-outbox pipeline. Two modes:
 *
 * 1. Job had FAILED outbox rows → re-enqueue just those rows (per-chunk
 *    retry). Much cheaper than re-running the whole pipeline.
 * 2. Job never produced outbox rows (prepare itself failed) → re-enqueue
 *    the prepare job on the SAME IngestionJob row so the history stays
 *    consistent.
 *
 * Legacy (pre-outbox) jobs still fall through to the old retry-as-new-job
 * behavior — we keep that branch so pre-deploy failures remain retryable.
 */
export const POST = withHardening(
  {
    roles: ['ADMIN', 'MASTER_ADMIN'],
    rateLimit: { limit: 15, windowSeconds: 3600, prefix: 'admin-ingestion-retry', keyBy: 'user' },
  },
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const session = await getServerSession();
      const currentUser = session!.user;

      const originalJob = await prisma.ingestionJob.findUnique({
        where: { id },
        include: { outbox: true },
      });

      if (!originalJob) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      // Scope check
      if (currentUser.role !== 'MASTER_ADMIN' && originalJob.organizationId !== currentUser.organizationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      if (originalJob.status !== IngestionJobStatus.FAILED
        && originalJob.status !== IngestionJobStatus.COMPLETED_WITH_ERRORS) {
        return NextResponse.json(
          { error: 'Can only retry failed or partially completed jobs' },
          { status: 400 }
        );
      }

      const failedRows = originalJob.outbox.filter(r => r.status === IngestionOutboxStatus.FAILED);

      // Branch 1: per-chunk retry of failed outbox rows.
      if (failedRows.length > 0) {
        // Reset the failed rows to PENDING so the worker will pick them up
        // again; keep `attempts` incrementing across retries so we can spot
        // pathological chunks that keep failing.
        await prisma.ingestionOutbox.updateMany({
          where: { id: { in: failedRows.map(r => r.id) } },
          data: { status: IngestionOutboxStatus.PENDING, lastError: null },
        });

        // Transition the job back into an "in progress" state so the UI
        // doesn't display it as finished.
        await prisma.ingestionJob.update({
          where: { id },
          data: { status: IngestionJobStatus.PROCESSING, completedAt: null },
        });

        for (const row of failedRows) {
          const payload: IngestionBackendWriteJobData = { outboxId: row.id, backend: row.backend };
          const q =
            row.backend === IngestionBackend.POSTGRES ? ingestionPostgresQueue
            : row.backend === IngestionBackend.PINECONE ? ingestionPineconeQueue
            : ingestionNeo4jQueue;
          await q.add('write', payload, { jobId: row.id });
        }

        await auditAdminAction({
          req: request,
          session: { user: { id: currentUser.id, organizationId: currentUser.organizationId } },
          eventType: 'INGESTION_TRIGGERED',
          description: `${currentUser.email} retried ${failedRows.length} failed chunks on ingestion job ${id}`,
          targetOrganizationId: originalJob.organizationId,
          metadata: {
            action: 'retry_chunks',
            ingestionJobId: id,
            chunkCount: failedRows.length,
          },
        });

        return NextResponse.json({
          ingestionJobId: id,
          mode: 'chunks',
          chunksRetried: failedRows.length,
          message: `Re-enqueued ${failedRows.length} failed chunks`,
        });
      }

      // Branch 2: prepare itself failed (no outbox rows exist). Re-run
      // prepare on the same job row. Reset the error state so the worker
      // sees a clean slate.
      if (originalJob.outbox.length === 0) {
        await prisma.ingestionJob.update({
          where: { id },
          data: {
            status: IngestionJobStatus.PENDING,
            errors: undefined,
            completedAt: null,
          },
        });
        const payload: IngestionPrepareJobData = { ingestionJobId: id };
        await ingestionPrepareQueue.add('prepare', payload, { jobId: id });

        await auditAdminAction({
          req: request,
          session: { user: { id: currentUser.id, organizationId: currentUser.organizationId } },
          eventType: 'INGESTION_TRIGGERED',
          description: `${currentUser.email} retried prepare phase on ingestion job ${id}`,
          targetOrganizationId: originalJob.organizationId,
          metadata: { action: 'retry_prepare', ingestionJobId: id },
        });

        return NextResponse.json({
          ingestionJobId: id,
          mode: 'prepare',
          message: 'Re-enqueued prepare job',
        });
      }

      // All outbox rows are OK or REJECTED but the job is still flagged as
      // FAILED/COMPLETED_WITH_ERRORS — nothing left to retry automatically.
      return NextResponse.json(
        { error: 'No failed chunks to retry. If chunks were REJECTED (authorization), fix the user\'s role and re-upload.' },
        { status: 400 }
      );
    } catch (error: any) {
      console.error('Ingestion retry error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
