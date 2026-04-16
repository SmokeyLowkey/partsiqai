import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { provisionNumber, releaseNumber, syncPoolConfig } from '@/lib/voip/phone-pool/provisioner';
import { markBlocked } from '@/lib/voip/phone-pool/health';
import { invalidatePhonePoolConfigCache } from '@/lib/voip/phone-pool/config';

// GET /api/admin/phone-pool — List all pool numbers with stats
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user || session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const numbers = await prisma.vapiPhoneNumber.findMany({
      orderBy: [{ isActive: 'desc' }, { healthStatus: 'asc' }, { lastUsedAt: 'desc' }],
      select: {
        id: true,
        vapiPhoneNumberId: true,
        e164: true,
        areaCode: true,
        provider: true,
        isActive: true,
        healthStatus: true,
        vapiStatus: true,
        blockedReason: true,
        blockedAt: true,
        dailyCallCount: true,
        lastUsedAt: true,
        createdAt: true,
        _count: { select: { supplierCalls: true } },
      },
    });

    // Pool summary
    const healthy = numbers.filter((n) => n.isActive && n.healthStatus === 'HEALTHY').length;
    const degraded = numbers.filter((n) => n.isActive && n.healthStatus === 'DEGRADED').length;
    const blocked = numbers.filter((n) => n.healthStatus === 'BLOCKED').length;
    const retired = numbers.filter((n) => n.healthStatus === 'RETIRED').length;

    // Check for alert
    const alert = await prisma.systemSetting.findUnique({
      where: { key: 'PHONE_POOL_ALERT' },
    });

    return NextResponse.json({
      numbers,
      summary: { healthy, degraded, blocked, retired, total: numbers.length },
      alert: alert?.value || null,
    });
  } catch (error: any) {
    console.error('Error fetching phone pool:', error);
    return NextResponse.json({ error: 'Failed to fetch phone pool' }, { status: 500 });
  }
}

// POST /api/admin/phone-pool — Provision new number or perform pool actions
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user || session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'provision': {
        const { areaCode, label } = body;
        const result = await provisionNumber({ areaCode, label });
        return NextResponse.json({ success: true, number: result });
      }

      case 'release': {
        const { phoneNumberId } = body;
        if (!phoneNumberId) {
          return NextResponse.json({ error: 'phoneNumberId required' }, { status: 400 });
        }
        await releaseNumber(phoneNumberId);
        return NextResponse.json({ success: true });
      }

      case 'block': {
        const { phoneNumberId, reason } = body;
        if (!phoneNumberId) {
          return NextResponse.json({ error: 'phoneNumberId required' }, { status: 400 });
        }
        await markBlocked(phoneNumberId, reason || 'Manually blocked by admin');
        return NextResponse.json({ success: true });
      }

      case 'sync': {
        const result = await syncPoolConfig();
        invalidatePhonePoolConfigCache();
        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: provision, release, block, sync' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Phone pool action failed:', error);
    return NextResponse.json(
      { error: error.message || 'Phone pool action failed' },
      { status: 500 }
    );
  }
}
