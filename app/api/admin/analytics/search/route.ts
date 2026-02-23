import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    const user = session?.user;

    if (!user || (user.role !== 'MASTER_ADMIN' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7', 10), 90);
    const organizationId = user.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const where = {
      organizationId,
      createdAt: { gte: since },
    };

    // Run all queries in parallel
    const [
      totalSearches,
      aggregates,
      cacheHits,
      spellingCorrected,
      zeroResults,
      byIntent,
      byDay,
      topQueries,
      zeroResultQueries,
    ] = await Promise.all([
      // Total searches
      prisma.searchLog.count({ where }),

      // Aggregates: avg search time
      prisma.searchLog.aggregate({
        where,
        _avg: { searchTimeMs: true },
      }),

      // Cache hit count
      prisma.searchLog.count({ where: { ...where, cacheHit: true } }),

      // Spelling correction count
      prisma.searchLog.count({ where: { ...where, spellingCorrected: true } }),

      // Zero-result count
      prisma.searchLog.count({ where: { ...where, totalResults: 0 } }),

      // By intent
      prisma.searchLog.groupBy({
        by: ['intent'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // By day
      prisma.$queryRaw<Array<{ date: string; count: bigint; avg_time: number }>>`
        SELECT
          DATE("createdAt") AS date,
          COUNT(*)::bigint AS count,
          AVG("searchTimeMs")::int AS avg_time
        FROM "search_logs"
        WHERE "organizationId" = ${organizationId}
          AND "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Top queries (most frequent)
      prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
        SELECT "query", COUNT(*)::bigint AS count
        FROM "search_logs"
        WHERE "organizationId" = ${organizationId}
          AND "createdAt" >= ${since}
        GROUP BY "query"
        ORDER BY count DESC
        LIMIT 20
      `,

      // Zero-result queries
      prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
        SELECT "query", COUNT(*)::bigint AS count
        FROM "search_logs"
        WHERE "organizationId" = ${organizationId}
          AND "createdAt" >= ${since}
          AND "totalResults" = 0
        GROUP BY "query"
        ORDER BY count DESC
        LIMIT 20
      `,
    ]);

    return NextResponse.json({
      period: { days, from: since.toISOString(), to: new Date().toISOString() },
      summary: {
        totalSearches,
        avgSearchTimeMs: Math.round(aggregates._avg.searchTimeMs || 0),
        cacheHitRate: totalSearches > 0 ? cacheHits / totalSearches : 0,
        spellingCorrectionRate: totalSearches > 0 ? spellingCorrected / totalSearches : 0,
        zeroResultRate: totalSearches > 0 ? zeroResults / totalSearches : 0,
      },
      byIntent: Object.fromEntries(
        byIntent.map(row => [row.intent || 'unknown', row._count.id])
      ),
      byDay: byDay.map(row => ({
        date: row.date,
        count: Number(row.count),
        avgTimeMs: row.avg_time,
      })),
      topQueries: topQueries.map(row => ({
        query: row.query,
        count: Number(row.count),
      })),
      zeroResultQueries: zeroResultQueries.map(row => ({
        query: row.query,
        count: Number(row.count),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch search analytics' },
      { status: 500 }
    );
  }
}
