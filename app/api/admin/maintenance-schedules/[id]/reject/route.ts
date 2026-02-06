import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { z } from 'zod';

const RejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
  needsCorrection: z.boolean().default(false), // If true, sets to NEEDS_CORRECTION instead of REJECTED
});

// POST /api/admin/maintenance-schedules/[id]/reject - Reject a maintenance schedule
export async function POST(
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

    const validationResult = RejectSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { reason, needsCorrection } = validationResult.data;

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

    // Determine the new status
    const newStatus = needsCorrection ? 'NEEDS_CORRECTION' : 'REJECTED';
    const statusLabel = needsCorrection ? 'Needs Correction' : 'Rejected';

    // Update schedule
    const schedule = await prisma.maintenanceSchedule.update({
      where: { id },
      data: {
        approvalStatus: newStatus,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: existingSchedule.reviewNotes
          ? `${existingSchedule.reviewNotes}\n[${statusLabel}: ${reason}]`
          : `[${statusLabel}: ${reason}]`,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            make: true,
            model: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        type: 'MAINTENANCE_SCHEDULED', // Using existing enum
        title: `Maintenance Schedule ${statusLabel}`,
        description: `Maintenance schedule for ${schedule.vehicle.make} ${schedule.vehicle.model} (${schedule.vehicle.vehicleId}) was ${statusLabel.toLowerCase()}. Reason: ${reason}`,
        entityType: 'MaintenanceSchedule',
        entityId: schedule.id,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        metadata: {
          vehicleId: schedule.vehicleId,
          reason,
          status: newStatus,
          reviewedBy: session.user.email,
        },
      },
    });

    return NextResponse.json({
      message: `Maintenance schedule ${statusLabel.toLowerCase()}`,
      schedule,
      nextSteps: needsCorrection
        ? 'The schedule can be edited and resubmitted for approval.'
        : 'The customer should upload a new maintenance PDF.',
    });
  } catch (error: any) {
    console.error('Admin reject maintenance schedule error:', error);

    return NextResponse.json(
      {
        error: 'Failed to reject maintenance schedule',
      },
      { status: 500 }
    );
  }
}
