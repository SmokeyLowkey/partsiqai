import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pingRedis } from '@/lib/cache/search-cache';

interface ServiceCheck {
  status: 'ok' | 'error' | 'not_configured';
  latencyMs?: number;
}

async function checkDatabase(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    await prisma.$executeRaw`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error', latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<ServiceCheck> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { status: 'not_configured' };
  }
  const start = Date.now();
  try {
    const ok = await pingRedis();
    return { status: ok ? 'ok' : 'error', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error', latencyMs: Date.now() - start };
  }
}

export async function GET() {
  const start = Date.now();

  const [database, redis] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const services = { database, redis };

  // healthy = all configured services OK
  // degraded = at least one configured service down but DB is OK
  // unhealthy = DB is down
  const configuredServices = Object.values(services).filter(s => s.status !== 'not_configured');
  const allOk = configuredServices.every(s => s.status === 'ok');
  const dbOk = database.status === 'ok';

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (!dbOk) {
    status = 'unhealthy';
  } else if (allOk) {
    status = 'healthy';
  } else {
    status = 'degraded';
  }

  return NextResponse.json({
    status,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services,
    responseTime: `${Date.now() - start}ms`,
  }, {
    status: dbOk ? 200 : 503,
  });
}
