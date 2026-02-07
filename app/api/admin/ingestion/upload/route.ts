import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadIngestionFile } from '@/lib/services/storage/s3-client';
import { partsIngestionQueue } from '@/lib/queue/queues';
import type { PartsIngestionJobData } from '@/lib/queue/types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// POST /api/admin/ingestion/upload - Upload file and start ingestion
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;

    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'MASTER_ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const targetOrgId = formData.get('organizationId') as string | null;
    const optionsStr = formData.get('options') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Determine target organization
    let organizationId: string;
    if (currentUser.role === 'MASTER_ADMIN' && targetOrgId) {
      // MASTER_ADMIN can target any org
      const org = await prisma.organization.findUnique({ where: { id: targetOrgId } });
      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }
      organizationId = targetOrgId;
    } else {
      // ADMIN can only target their own org
      organizationId = currentUser.organizationId;
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isJSON = fileName.endsWith('.json');
    if (!isCSV && !isJSON) {
      return NextResponse.json(
        { error: 'Only CSV and JSON files are supported' },
        { status: 400 }
      );
    }

    // Validate file size
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Parse options
    let options: any = {};
    if (optionsStr) {
      try {
        options = JSON.parse(optionsStr);
      } catch {
        return NextResponse.json({ error: 'Invalid options JSON' }, { status: 400 });
      }
    }

    // Upload to S3
    const contentType = isCSV ? 'text/csv' : 'application/json';
    const { key: s3Key } = await uploadIngestionFile(buffer, file.name, contentType, organizationId);

    // Create IngestionJob record
    const ingestionJob = await prisma.ingestionJob.create({
      data: {
        organizationId,
        userId: currentUser.id,
        s3Key,
        fileName: file.name,
        fileType: isCSV ? 'csv' : 'json',
        fileSize: buffer.length,
        options,
      },
    });

    // Enqueue BullMQ job
    const jobData: PartsIngestionJobData = {
      organizationId,
      ingestionJobId: ingestionJob.id,
      s3Key,
      fileType: isCSV ? 'csv' : 'json',
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
      jobId: ingestionJob.id,
    });

    return NextResponse.json({
      ingestionJobId: ingestionJob.id,
      status: 'PENDING',
      message: 'Ingestion job created and queued',
    });
  } catch (error: any) {
    console.error('Ingestion upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
