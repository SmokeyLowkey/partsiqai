import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const start = Date.now();

  let dbStatus = 'ok';
  try {
    // Use Prisma's executeRaw for safe database connectivity check
    await prisma.$executeRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  return NextResponse.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    responseTime: `${Date.now() - start}ms`,
  }, {
    status: dbStatus === 'ok' ? 200 : 503,
  });
}
