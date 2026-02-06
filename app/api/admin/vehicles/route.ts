import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requirePermission('vehicle:configure_search');

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // Filter by status
    const search = searchParams.get('search'); // Search by make/model/serial

    const whereClause: any = {
      organizationId: session.user.organizationId,
    };

    // Filter by status if provided
    if (status && status !== 'all') {
      whereClause.searchConfigStatus = status;
    }

    // Search filter
    if (search) {
      whereClause.OR = [
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { vehicleId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        searchMapping: {
          include: {
            verifier: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [
        { searchConfigStatus: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Get status counts for summary
    const statusCounts = await prisma.vehicle.groupBy({
      by: ['searchConfigStatus'],
      where: {
        organizationId: session.user.organizationId,
      },
      _count: {
        id: true,
      },
    });

    const counts = {
      PENDING_ADMIN_REVIEW: 0,
      SEARCH_READY: 0,
      NEEDS_UPDATE: 0,
      INACTIVE: 0,
      total: vehicles.length,
    };

    statusCounts.forEach((item) => {
      counts[item.searchConfigStatus as keyof typeof counts] = item._count.id;
    });

    return NextResponse.json({
      vehicles,
      counts,
    });
  } catch (error: any) {
    console.error('[GET /api/admin/vehicles] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicles' },
      { status: 500 }
    );
  }
}
