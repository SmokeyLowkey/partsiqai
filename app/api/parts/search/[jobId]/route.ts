import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { partsSearchQueue } from '@/lib/queue/queues';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;

    // Get job from database to verify ownership
    const jobRecord = await prisma.jobQueue.findUnique({
      where: { jobId },
    });

    if (!jobRecord) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify user has access to this job
    if (jobRecord.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get job from BullMQ
    const job = await partsSearchQueue.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        {
          error: 'Job not found in queue',
          status: jobRecord.status,
          result: jobRecord.result,
        },
        { status: 404 }
      );
    }

    // Get job state
    const state = await job.getState();
    const progress = job.progress;
    const returnvalue = job.returnvalue;
    const failedReason = job.failedReason;

    // Map BullMQ state to our JobStatus enum
    const statusMap: Record<string, string> = {
      waiting: 'PENDING',
      active: 'ACTIVE',
      completed: 'COMPLETED',
      failed: 'FAILED',
      delayed: 'DELAYED',
      paused: 'PAUSED',
    };

    const mappedStatus = statusMap[state] || state.toUpperCase();

    // Update database record if state changed
    if (jobRecord.status !== mappedStatus) {
      await prisma.jobQueue.update({
        where: { jobId },
        data: {
          status: mappedStatus as any,
          ...(state === 'active' && !jobRecord.startedAt
            ? { startedAt: new Date() }
            : {}),
          ...(state === 'completed'
            ? {
                completedAt: new Date(),
                result: returnvalue as any,
              }
            : {}),
          ...(state === 'failed'
            ? {
                failedAt: new Date(),
                error: failedReason,
                attempts: job.attemptsMade,
              }
            : {}),
        },
      });
    }

    return NextResponse.json({
      jobId,
      status: state,
      progress,
      result: returnvalue,
      error: failedReason,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      timestamp: job.timestamp,
    });
  } catch (error: any) {
    console.error('Job status API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get job status',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;

    // Get job from database to verify ownership
    const jobRecord = await prisma.jobQueue.findUnique({
      where: { jobId },
    });

    if (!jobRecord) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify user has access to this job
    if (jobRecord.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get job from BullMQ
    const job = await partsSearchQueue.getJob(jobId);

    if (job) {
      await job.remove();
    }

    // Update database record
    await prisma.jobQueue.delete({
      where: { jobId },
    });

    return NextResponse.json({
      success: true,
      message: 'Job removed successfully',
    });
  } catch (error: any) {
    console.error('Job deletion API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to remove job',
      },
      { status: 500 }
    );
  }
}
