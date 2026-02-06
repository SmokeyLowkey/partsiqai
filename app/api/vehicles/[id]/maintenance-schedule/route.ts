import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { maintenancePdfQueue } from '@/lib/queue/queues';

// GET /api/vehicles/[id]/maintenance-schedule - Get maintenance schedule for a vehicle
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: vehicleId } = await params;

    // Get the vehicle first to verify ownership
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: session.user.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Get the maintenance schedule with intervals and parts
    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { vehicleId },
      include: {
        intervals: {
          orderBy: { intervalHours: 'asc' },
          include: {
            requiredParts: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({
        schedule: null,
        message: 'No maintenance schedule found. Upload a maintenance PDF to create one.',
      });
    }

    return NextResponse.json({ schedule });
  } catch (error: any) {
    console.error('Get maintenance schedule API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch maintenance schedule',
      },
      { status: 500 }
    );
  }
}

// POST /api/vehicles/[id]/maintenance-schedule - Trigger PDF parsing (manual re-parse)
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

    // Get the vehicle with its maintenance PDF info
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: session.user.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    if (!vehicle.maintenancePdfUrl) {
      return NextResponse.json(
        { error: 'No maintenance PDF uploaded for this vehicle' },
        { status: 400 }
      );
    }

    // Check if a schedule already exists
    let schedule = await prisma.maintenanceSchedule.findUnique({
      where: { vehicleId },
    });

    if (schedule) {
      // Reset status for re-parsing
      schedule = await prisma.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: {
          parsingStatus: 'PENDING',
          parsingError: null,
          parsedAt: null,
          approvalStatus: 'PENDING_REVIEW',
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
        },
      });
    } else {
      // Create new schedule record
      schedule = await prisma.maintenanceSchedule.create({
        data: {
          vehicleId,
          organizationId: session.user.organizationId,
          pdfS3Key: vehicle.maintenancePdfUrl,
          pdfFileName: vehicle.maintenancePdfFileName || 'maintenance.pdf',
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
        pdfS3Key: vehicle.maintenancePdfUrl,
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
      message: 'Maintenance PDF parsing started',
      schedule: {
        id: schedule.id,
        parsingStatus: 'PENDING',
        approvalStatus: 'PENDING_REVIEW',
      },
    });
  } catch (error: any) {
    console.error('Trigger maintenance PDF parsing API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to trigger PDF parsing',
      },
      { status: 500 }
    );
  }
}
