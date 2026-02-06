import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getOrganizationCostSavings, getAllOrganizationsCostSavings } from '@/lib/services/cost-savings';

// GET /api/cost-savings - Get cost savings for the user's organization
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get('months') || '12');

    // Master admins can optionally see all organizations' data
    const viewAll = searchParams.get('all') === 'true' && session.user.role === 'MASTER_ADMIN';

    if (viewAll) {
      const data = await getAllOrganizationsCostSavings({ months });
      return NextResponse.json(data);
    }

    // Get cost savings for the user's organization
    const data = await getOrganizationCostSavings(session.user.organizationId, { months });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching cost savings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cost savings' },
      { status: 500 }
    );
  }
}
