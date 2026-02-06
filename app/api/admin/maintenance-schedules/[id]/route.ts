import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { z } from 'zod';

// GET /api/admin/maintenance-schedules/[id] - Get a single schedule with full details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requirePermission('vehicle:configure_search');

    const { id } = await params;

    const schedule = await prisma.maintenanceSchedule.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            serialNumber: true,
            make: true,
            model: true,
            year: true,
            operatingHours: true,
            healthScore: true,
            searchConfigStatus: true,
            maintenancePdfUrl: true,
            maintenancePdfFileName: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
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
      return NextResponse.json(
        { error: 'Maintenance schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ schedule });
  } catch (error: any) {
    console.error('Admin get maintenance schedule error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch maintenance schedule',
      },
      { status: 500 }
    );
  }
}

// Schema for updating intervals
const UpdateIntervalsSchema = z.object({
  intervals: z.array(
    z.object({
      id: z.string().optional(), // If provided, update existing; if not, create new
      intervalHours: z.number().int().positive(),
      intervalType: z.enum(['HOURS', 'DAYS', 'MONTHS', 'MILES']).default('HOURS'),
      serviceName: z.string().min(1),
      serviceDescription: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      parts: z.array(
        z.object({
          id: z.string().optional(),
          partNumber: z.string().min(1),
          partDescription: z.string().nullable().optional(),
          quantity: z.number().int().positive().default(1),
        })
      ).default([]),
    })
  ),
});

// PUT /api/admin/maintenance-schedules/[id] - Update intervals (admin edits before approval)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requirePermission('vehicle:configure_search');

    const { id } = await params;
    const body = await req.json();

    // Validate request body
    const validationResult = UpdateIntervalsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if schedule exists and belongs to organization
    const existingSchedule = await prisma.maintenanceSchedule.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Maintenance schedule not found' },
        { status: 404 }
      );
    }

    const { intervals } = validationResult.data;

    // Update in transaction
    const updatedSchedule = await prisma.$transaction(async (tx) => {
      // Delete all existing intervals and parts (will cascade)
      await tx.maintenanceInterval.deleteMany({
        where: { maintenanceScheduleId: id },
      });

      // Create new intervals with parts
      for (const interval of intervals) {
        await tx.maintenanceInterval.create({
          data: {
            maintenanceScheduleId: id,
            intervalHours: interval.intervalHours,
            intervalType: interval.intervalType,
            serviceName: interval.serviceName,
            serviceDescription: interval.serviceDescription,
            category: interval.category,
            requiredParts: {
              create: interval.parts.map((part) => ({
                partNumber: part.partNumber,
                partDescription: part.partDescription,
                quantity: part.quantity,
              })),
            },
          },
        });
      }

      // Update schedule to mark as corrected if it was pending or needs correction
      return tx.maintenanceSchedule.update({
        where: { id },
        data: {
          approvalStatus:
            existingSchedule.approvalStatus === 'REJECTED'
              ? 'PENDING_REVIEW'
              : existingSchedule.approvalStatus,
          reviewNotes: existingSchedule.reviewNotes
            ? `${existingSchedule.reviewNotes}\n[Admin edited intervals at ${new Date().toISOString()}]`
            : `[Admin edited intervals at ${new Date().toISOString()}]`,
        },
        include: {
          intervals: {
            orderBy: { intervalHours: 'asc' },
            include: {
              requiredParts: true,
            },
          },
        },
      });
    });

    return NextResponse.json({
      message: 'Maintenance schedule intervals updated',
      schedule: updatedSchedule,
    });
  } catch (error: any) {
    console.error('Admin update maintenance schedule error:', error);

    return NextResponse.json(
      {
        error: 'Failed to update maintenance schedule',
      },
      { status: 500 }
    );
  }
}
