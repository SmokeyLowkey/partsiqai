import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CRITICAL: Only admins can verify mappings
    await requirePermission('vehicle:verify_mapping');

    const { id } = await params;
    const body = await req.json();
    const { testQuery, testResults } = body;

    // Update vehicle status to SEARCH_READY
    await prisma.vehicle.update({
      where: { id },
      data: {
        searchConfigStatus: 'SEARCH_READY',
        updatedAt: new Date(),
      },
    });

    // Update mapping with verification data
    await prisma.vehicleSearchMapping.update({
      where: { vehicleId: id },
      data: {
        verifiedAt: new Date(),
        verifiedBy: session.user.id,
        lastTestQuery: testQuery,
        lastTestResults: testResults,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[POST /api/vehicles/[vehicleId]/verify-search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify vehicle search' },
      { status: 500 }
    );
  }
}
