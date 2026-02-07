import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/ingestion - List ingestion jobs
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;

    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'MASTER_ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const orgId = searchParams.get('organizationId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};

    // Scope by role
    if (currentUser.role === 'MASTER_ADMIN') {
      if (orgId) where.organizationId = orgId;
    } else {
      where.organizationId = currentUser.organizationId;
    }

    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.ingestionJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          organization: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.ingestionJob.count({ where }),
    ]);

    return NextResponse.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Ingestion list error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
