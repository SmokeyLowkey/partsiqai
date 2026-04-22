import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadIngestionFile } from '@/lib/services/storage/s3-client';
import { ingestionPrepareQueue } from '@/lib/queue/queues';
import type { IngestionPrepareJobData } from '@/lib/queue/types';
import { IngestionBackend, UserRole } from '@prisma/client';
import { getTierLimits, canUseExpensiveFeatures } from '@/lib/subscription-limits';
import { withHardening } from '@/lib/api/with-hardening';
import { auditAdminAction } from '@/lib/audit-admin';

// 500 MB — feasible now that the prepare worker streams S3 → parse → chunks
// without ever holding the full file in memory. Bump again once we switch
// the route to multipart streaming upload (today the request body is still
// buffered once here).
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Compute which backends the initiating user is authorized to write to.
// MASTER_ADMIN writes to the shared platform catalog in Postgres; org ADMIN
// may only write their org's slice of Pinecone + Neo4j. Enforced both here
// (outbox rows are only created for authorized backends) and re-enforced in
// each backend worker at process time.
function authorizedBackendsFor(role: UserRole): IngestionBackend[] {
  if (role === 'MASTER_ADMIN') {
    return [IngestionBackend.POSTGRES, IngestionBackend.PINECONE, IngestionBackend.NEO4J];
  }
  return [IngestionBackend.PINECONE, IngestionBackend.NEO4J];
}

// POST /api/admin/ingestion/upload - Upload file and start ingestion
// Low cap: each upload enqueues an expensive multi-backend job. 10/hr is
// generous for legitimate admin ingestion work but blocks accidental loops.
export const POST = withHardening(
  {
    roles: ['ADMIN', 'MASTER_ADMIN'],
    rateLimit: { limit: 10, windowSeconds: 3600, prefix: 'admin-ingestion-upload', keyBy: 'user' },
  },
  async (request: Request) => {
  try {
    const session = await getServerSession();
    const currentUser = session!.user;

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

    // Require vehicleId for non-MASTER_ADMIN uploads
    const vehicleId = options.vehicleId as string | undefined;
    if (currentUser.role !== 'MASTER_ADMIN' && !vehicleId) {
      return NextResponse.json(
        { error: 'A vehicle must be selected for data ingestion' },
        { status: 400 }
      );
    }

    // Validate vehicle belongs to the target organization
    if (vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId, organizationId },
      });
      if (!vehicle) {
        return NextResponse.json({ error: 'Vehicle not found in your organization' }, { status: 404 });
      }
    }

    // Fetch org subscription info for tier-based limits
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionStatus: true, subscriptionTier: true, trialEndsAt: true },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Block uploads from EXPIRED orgs (trial ended without conversion, or
    // data was already wiped by the freeze cron). 402 Payment Required is
    // the correct HTTP status here — distinguishes from 403 "not allowed"
    // so the UI can render a "subscribe to re-upload" prompt vs a generic
    // auth error. Applies even to MASTER_ADMIN targeting an EXPIRED org.
    if (!canUseExpensiveFeatures(org.subscriptionStatus, org.trialEndsAt)) {
      return NextResponse.json(
        {
          error: 'Subscription required',
          message: 'This organization\'s trial has ended. Subscribe to re-upload a parts catalog.',
        },
        { status: 402 },
      );
    }

    const tierLimits = getTierLimits(org.subscriptionTier, org.subscriptionStatus);

    // Compute authorization snapshot at enqueue time. Only MASTER_ADMIN may
    // write to the shared Postgres parts catalog — the outbox pipeline enforces
    // this by simply not creating a POSTGRES outbox row for other roles. The
    // legacy `skipPostgres` flag is also set to keep the old monolithic
    // pipeline safe while any in-flight legacy jobs drain.
    const authorizedBackends = authorizedBackendsFor(currentUser.role as UserRole);
    if (currentUser.role !== 'MASTER_ADMIN') {
      options.skipPostgres = true;
    }

    // Enforce per-vehicle ingestion limit for trial orgs
    if (vehicleId && tierLimits.maxIngestionsPerVehicle !== Infinity) {
      const existingJobs = await prisma.ingestionJob.count({
        where: {
          organizationId,
          options: { path: ['vehicleId'], equals: vehicleId },
          status: { notIn: ['FAILED'] },
        },
      });

      if (existingJobs >= tierLimits.maxIngestionsPerVehicle) {
        return NextResponse.json(
          {
            error: 'Ingestion limit reached',
            message: `Your trial allows ${tierLimits.maxIngestionsPerVehicle} parts catalog upload per vehicle. Please upgrade to upload more.`,
          },
          { status: 403 }
        );
      }
    }

    // Upload to S3
    const contentType = isCSV ? 'text/csv' : 'application/json';
    const { key: s3Key } = await uploadIngestionFile(buffer, file.name, contentType, organizationId);

    // If the admin skipped a whole backend via options, honor that by not
    // creating outbox rows for it. This collapses `skipPinecone: true` /
    // `skipNeo4j: true` from the legacy options into the outbox pipeline.
    let effectiveBackends = authorizedBackends;
    if (options.skipPinecone) effectiveBackends = effectiveBackends.filter(b => b !== IngestionBackend.PINECONE);
    if (options.skipNeo4j) effectiveBackends = effectiveBackends.filter(b => b !== IngestionBackend.NEO4J);
    if (options.skipPostgres) effectiveBackends = effectiveBackends.filter(b => b !== IngestionBackend.POSTGRES);

    // Create IngestionJob record in PREPARING state. Prepare worker will
    // transition it to READY once chunks are fanned out, then backend writers
    // aggregate to COMPLETED / COMPLETED_WITH_ERRORS / FAILED.
    const ingestionJob = await prisma.ingestionJob.create({
      data: {
        organizationId,
        userId: currentUser.id,
        s3Key,
        fileName: file.name,
        fileType: isCSV ? 'csv' : 'json',
        fileSize: buffer.length,
        status: 'PENDING',
        options,
        initiatedByRole: currentUser.role as UserRole,
        authorizedBackends: effectiveBackends,
        // Mark skipped phases as SKIPPED up front so per-backend status is
        // meaningful from the start (PENDING means "will run", SKIPPED means
        // "intentionally not running for this job").
        postgresStatus: effectiveBackends.includes(IngestionBackend.POSTGRES) ? 'PENDING' : 'SKIPPED',
        pineconeStatus: effectiveBackends.includes(IngestionBackend.PINECONE) ? 'PENDING' : 'SKIPPED',
        neo4jStatus:    effectiveBackends.includes(IngestionBackend.NEO4J)    ? 'PENDING' : 'SKIPPED',
      },
    });

    // Enqueue prepare job — all other job context is loaded from the DB at
    // process time, not carried in the payload.
    const jobData: IngestionPrepareJobData = { ingestionJobId: ingestionJob.id };
    await ingestionPrepareQueue.add('prepare', jobData, {
      jobId: ingestionJob.id,
    });

    await auditAdminAction({
      req: request,
      session: { user: { id: currentUser.id, organizationId: currentUser.organizationId } },
      eventType: 'INGESTION_TRIGGERED',
      description: `${currentUser.email} uploaded ${file.name} for ingestion (${ingestionJob.id})`,
      targetOrganizationId: organizationId,
      metadata: {
        action: 'upload',
        ingestionJobId: ingestionJob.id,
        fileName: file.name,
        fileType: ingestionJob.fileType,
        fileSizeBytes: file.size,
        targetOrganizationId: organizationId,
        skipPostgres: options.skipPostgres ?? false,
      },
    });

    return NextResponse.json({
      ingestionJobId: ingestionJob.id,
      status: 'PENDING',
      message: 'Ingestion job created and queued',
    });
  } catch (error: any) {
    console.error('Ingestion upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  }
);
