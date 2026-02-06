import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';

// GET /api/admin/maintenance-schedules - List all maintenance schedules for review
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requirePermission('vehicle:configure_search');

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // Filter by approval status
    const parsingStatus = searchParams.get('parsingStatus'); // Filter by parsing status

    const whereClause: any = {
      organizationId: session.user.organizationId,
    };

    // Filter by approval status
    if (status && status !== 'all') {
      whereClause.approvalStatus = status;
    }

    // Filter by parsing status
    if (parsingStatus && parsingStatus !== 'all') {
      whereClause.parsingStatus = parsingStatus;
    }

    const schedules = await prisma.maintenanceSchedule.findMany({
      where: whereClause,
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
            searchConfigStatus: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            intervals: true,
          },
        },
      },
      orderBy: [
        { approvalStatus: 'asc' }, // PENDING_REVIEW first
        { createdAt: 'desc' },
      ],
    });

    // Get status counts for summary
    const approvalStatusCounts = await prisma.maintenanceSchedule.groupBy({
      by: ['approvalStatus'],
      where: {
        organizationId: session.user.organizationId,
      },
      _count: {
        id: true,
      },
    });

    const parsingStatusCounts = await prisma.maintenanceSchedule.groupBy({
      by: ['parsingStatus'],
      where: {
        organizationId: session.user.organizationId,
      },
      _count: {
        id: true,
      },
    });

    const counts = {
      approval: {
        PENDING_REVIEW: 0,
        APPROVED: 0,
        REJECTED: 0,
        NEEDS_CORRECTION: 0,
      },
      parsing: {
        PENDING: 0,
        PROCESSING: 0,
        COMPLETED: 0,
        FAILED: 0,
      },
    };

    approvalStatusCounts.forEach((item) => {
      counts.approval[item.approvalStatus as keyof typeof counts.approval] = item._count.id;
    });

    parsingStatusCounts.forEach((item) => {
      counts.parsing[item.parsingStatus as keyof typeof counts.parsing] = item._count.id;
    });

    return NextResponse.json({
      schedules,
      counts,
      total: schedules.length,
    });
  } catch (error: any) {
    console.error('Admin get maintenance schedules error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch maintenance schedules',
      },
      { status: 500 }
    );
  }
}
