import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { partsIngestionQueue } from '@/lib/queue/queues';
import type { PartsIngestionJobData } from '@/lib/queue/types';

// POST /api/admin/ingestion/[id]/retry - Retry a failed ingestion job
export async function POST(
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

    const originalJob = await prisma.ingestionJob.findUnique({
      where: { id },
    });

    if (!originalJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Scope check
    if (currentUser.role !== 'MASTER_ADMIN' && originalJob.organizationId !== currentUser.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (originalJob.status !== 'FAILED' && originalJob.status !== 'COMPLETED_WITH_ERRORS') {
      return NextResponse.json(
        { error: 'Can only retry failed or partially completed jobs' },
        { status: 400 }
      );
    }

    // Create a new IngestionJob reusing the same S3 file
    const newJob = await prisma.ingestionJob.create({
      data: {
        organizationId: originalJob.organizationId,
        userId: currentUser.id,
        s3Key: originalJob.s3Key,
        fileName: originalJob.fileName,
        fileType: originalJob.fileType,
        fileSize: originalJob.fileSize,
        options: originalJob.options as any,
      },
    });

    // Enqueue new BullMQ job
    const options = (originalJob.options as any) || {};
    const jobData: PartsIngestionJobData = {
      organizationId: originalJob.organizationId,
      ingestionJobId: newJob.id,
      s3Key: originalJob.s3Key,
      fileType: originalJob.fileType as 'csv' | 'json',
      userId: currentUser.id,
      options: {
        dryRun: options.dryRun || false,
        skipPinecone: options.skipPinecone || false,
        skipNeo4j: options.skipNeo4j || false,
        skipPostgres: options.skipPostgres || false,
        batchSize: options.batchSize || 100,
        defaultNamespace: options.defaultNamespace,
        defaultManufacturer: options.defaultManufacturer,
        defaultMachineModel: options.defaultMachineModel,
        defaultTechnicalDomain: options.defaultTechnicalDomain,
        defaultSerialNumberRange: options.defaultSerialNumberRange,
      },
    };

    await partsIngestionQueue.add('ingest-parts', jobData, {
      jobId: newJob.id,
    });

    return NextResponse.json({
      ingestionJobId: newJob.id,
      status: 'PENDING',
      message: 'Retry job created and queued',
    });
  } catch (error: any) {
    console.error('Ingestion retry error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
