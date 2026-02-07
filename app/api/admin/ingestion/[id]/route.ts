import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    return NextResponse.json(job);
  } catch (error: any) {
    console.error('Ingestion get error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/ingestion/[id] - Cancel a pending ingestion job
export async function DELETE(
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

    return NextResponse.json({ message: 'Job cancelled' });
  } catch (error: any) {
    console.error('Ingestion cancel error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
