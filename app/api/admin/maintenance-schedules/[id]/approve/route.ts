import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';
import { z } from 'zod';

const ApproveSchema = z.object({
  notes: z.string().optional(),
});

// POST /api/admin/maintenance-schedules/[id]/approve - Approve a maintenance schedule
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
    const body = await req.json().catch(() => ({}));

    const validationResult = ApproveSchema.safeParse(body);
    const notes = validationResult.success ? validationResult.data.notes : undefined;

    // Check if schedule exists and belongs to organization
    const existingSchedule = await prisma.maintenanceSchedule.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        intervals: true,
      },
    });

    if (!existingSchedule) {
      return NextResponse.json(
        { error: 'Maintenance schedule not found' },
        { status: 404 }
      );
    }

    // Check if parsing is complete
    if (existingSchedule.parsingStatus !== 'COMPLETED') {
      return NextResponse.json(
        {
          error: 'Cannot approve schedule',
          details: `Schedule parsing status is ${existingSchedule.parsingStatus}. Wait for parsing to complete.`,
        },
        { status: 400 }
      );
    }

    // Check if there are any intervals
    if (existingSchedule.intervals.length === 0) {
      return NextResponse.json(
        {
          error: 'Cannot approve schedule',
          details: 'Schedule has no maintenance intervals. Add intervals before approving.',
        },
        { status: 400 }
      );
    }

    // Update schedule to approved
    const schedule = await prisma.maintenanceSchedule.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: notes
          ? existingSchedule.reviewNotes
            ? `${existingSchedule.reviewNotes}\n[Approved: ${notes}]`
            : `[Approved: ${notes}]`
          : existingSchedule.reviewNotes
            ? `${existingSchedule.reviewNotes}\n[Approved at ${new Date().toISOString()}]`
            : `[Approved at ${new Date().toISOString()}]`,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            vehicleId: true,
            make: true,
            model: true,
          },
        },
        intervals: {
          include: {
            requiredParts: true,
          },
        },
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        type: 'MAINTENANCE_COMPLETED', // Using existing enum, ideally would have MAINTENANCE_SCHEDULE_APPROVED
        title: 'Maintenance Schedule Approved',
        description: `Maintenance schedule for ${schedule.vehicle.make} ${schedule.vehicle.model} (${schedule.vehicle.vehicleId}) has been approved`,
        entityType: 'MaintenanceSchedule',
        entityId: schedule.id,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        metadata: {
          vehicleId: schedule.vehicleId,
          intervalsCount: schedule.intervals.length,
          approvedBy: session.user.email,
        },
      },
    });

    return NextResponse.json({
      message: 'Maintenance schedule approved successfully',
      schedule,
    });
  } catch (error: any) {
    console.error('Admin approve maintenance schedule error:', error);

    return NextResponse.json(
      {
        error: 'Failed to approve maintenance schedule',
      },
      { status: 500 }
    );
  }
}
