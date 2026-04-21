import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withHardening } from '@/lib/api/with-hardening';
import { auditAdminAction } from '@/lib/audit-admin';

// GET /api/admin/ingestion/[id] - Get ingestion job details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession();
    const currentUser = session?.user;

    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'MASTER_ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const job = await prisma.ingestionJob.findUnique({
      where: { id },
      include: {
        organization: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Scope check: ADMIN can only see their own org's jobs
    if (currentUser.role !== 'MASTER_ADMIN' && job.organizationId !== currentUser.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Per-backend chunk breakdown for the outbox pipeline UI. Legacy jobs
    // (no outbox rows) return empty breakdown objects.
    const rows = await prisma.ingestionOutbox.groupBy({
      by: ['backend', 'status'],
      where: { ingestionJobId: id },
      _count: { status: true },
    });
    const backendBreakdown = {
      POSTGRES: { PENDING: 0, IN_PROGRESS: 0, OK: 0, FAILED: 0, REJECTED: 0 },
      PINECONE: { PENDING: 0, IN_PROGRESS: 0, OK: 0, FAILED: 0, REJECTED: 0 },
      NEO4J:    { PENDING: 0, IN_PROGRESS: 0, OK: 0, FAILED: 0, REJECTED: 0 },
    } as Record<string, Record<string, number>>;
    for (const r of rows) {
      backendBreakdown[r.backend][r.status] = r._count.status;
    }

    return NextResponse.json({ ...job, backendBreakdown });
  } catch (error: any) {
    console.error('Ingestion get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/ingestion/[id] - Cancel a pending ingestion job
export const DELETE = withHardening(
  {
    roles: ['ADMIN', 'MASTER_ADMIN'],
    rateLimit: { limit: 30, windowSeconds: 60, prefix: 'admin-ingestion-cancel', keyBy: 'user' },
  },
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const session = await getServerSession();
    const currentUser = session!.user;

    const job = await prisma.ingestionJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Scope check
    if (currentUser.role !== 'MASTER_ADMIN' && job.organizationId !== currentUser.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (job.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only cancel jobs in PENDING status' },
        { status: 400 }
      );
    }

    await prisma.ingestionJob.update({
      where: { id },
      data: { status: 'FAILED', completedAt: new Date(), errors: [{ row: 0, field: 'system', message: 'Cancelled by admin' }] },
    });

    await auditAdminAction({
      req: request,
      session: { user: { id: currentUser.id, organizationId: currentUser.organizationId } },
      eventType: 'INGESTION_TRIGGERED',
      description: `${currentUser.email} cancelled ingestion job ${id}`,
      targetOrganizationId: job.organizationId,
      metadata: { action: 'cancel', ingestionJobId: id },
    });

    return NextResponse.json({ message: 'Job cancelled' });
  } catch (error: any) {
    console.error('Ingestion cancel error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  }
);
