import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  uploadMaintenancePdf,
  validatePdfFile,
  sanitizeFileName,
} from '@/lib/services/storage/s3-client';
import { maintenancePdfQueue } from '@/lib/queue/queues';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: vehicleId } = await params;

    // Verify vehicle belongs to user's organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: session.user.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file is PDF and size
    try {
      validatePdfFile(file, 10); // Max 10MB
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Sanitize filename
    const sanitizedFileName = sanitizeFileName(file.name);

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF magic number on server side
    try {
      validatePdfFile(buffer, 10);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Upload to S3
    const { key, url } = await uploadMaintenancePdf(
      buffer,
      sanitizedFileName,
      session.user.organizationId,
      vehicleId
    );

    // Update vehicle record with S3 key and filename
    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        maintenancePdfUrl: key, // Store S3 key, not the signed URL
        maintenancePdfFileName: sanitizedFileName,
        maintenancePdfUploadedAt: new Date(),
      },
    });

    // Create or update maintenance schedule record and queue parsing job
    let schedule = await prisma.maintenanceSchedule.findUnique({
      where: { vehicleId },
    });

    if (schedule) {
      // Reset existing schedule for re-parsing
      schedule = await prisma.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: {
          pdfS3Key: key,
          pdfFileName: sanitizedFileName,
          parsingStatus: 'PENDING',
          parsingError: null,
          parsedAt: null,
          oem: null,
          extractionConfidence: null,
          approvalStatus: 'PENDING_REVIEW',
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
        },
      });

      // Delete existing intervals (will cascade to parts)
      await prisma.maintenanceInterval.deleteMany({
        where: { maintenanceScheduleId: schedule.id },
      });
    } else {
      // Create new schedule record
      schedule = await prisma.maintenanceSchedule.create({
        data: {
          vehicleId,
          organizationId: session.user.organizationId,
          pdfS3Key: key,
          pdfFileName: sanitizedFileName,
          parsingStatus: 'PENDING',
          approvalStatus: 'PENDING_REVIEW',
        },
      });
    }

    // Queue the parsing job
    await (maintenancePdfQueue as any).add(
      'parse-maintenance-pdf',
      {
        organizationId: session.user.organizationId,
        vehicleId,
        scheduleId: schedule.id,
        pdfS3Key: key,
        vehicleContext: {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
        },
      },
      {
        jobId: `maintenance-pdf-${schedule.id}-${Date.now()}`,
      }
    );

    return NextResponse.json({
      success: true,
      vehicle: updatedVehicle,
      downloadUrl: url, // Return signed URL for immediate download
      message: 'PDF uploaded successfully. Parsing has been queued.',
      schedule: {
        id: schedule.id,
        parsingStatus: 'PENDING',
        approvalStatus: 'PENDING_REVIEW',
      },
    });
  } catch (error: any) {
    console.error('Upload PDF error:', error);

    return NextResponse.json(
      {
        error: 'Failed to upload PDF',
      },
      { status: 500 }
    );
  }
}
