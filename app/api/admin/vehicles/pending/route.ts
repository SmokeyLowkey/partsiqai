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

    const pendingVehicles = await prisma.vehicle.findMany({
      where: {
        organizationId: session.user.organizationId,
        searchConfigStatus: 'PENDING_ADMIN_REVIEW',
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        searchMapping: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(pendingVehicles);
  } catch (error: any) {
    console.error('[GET /api/admin/vehicles/pending] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending vehicles' },
      { status: 500 }
    );
  }
}
