import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cronLogger } from '@/lib/logger';
import { verifyCronAuth } from '@/lib/api-utils';

/**
 * Cron Job: Maintenance Alerts
 *
 * This endpoint checks all vehicles and creates maintenance alerts when needed.
 * Schedule: Hourly
 *
 * Setup with Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/maintenance-alerts",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
// Batch size chosen so memory stays bounded for customers with O(100k)
// vehicles — well under Prisma's 1000-row default ceiling, leaves headroom
// for the `include: { alerts }` expansion.
const BATCH_SIZE = 500;

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security (timing-safe)
    if (!verifyCronAuth(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cronLogger.info('Maintenance alerts triggered');

    // Phase 1: active vehicles with service intervals. Cursor-paginate so
    // we never load >BATCH_SIZE rows into memory at once. This also breaks
    // one long-running transaction into many short ones so a single slow
    // insert can't hold locks across the full fleet.
    let alertsCreated = 0;
    let vehiclesChecked = 0;
    let cursor: string | undefined;

    while (true) {
      const batch = await prisma.vehicle.findMany({
        where: {
          status: 'ACTIVE',
          serviceInterval: { not: null },
        },
        include: {
          alerts: {
            where: { type: 'MAINTENANCE_DUE', isResolved: false },
          },
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      for (const vehicle of batch) {
        vehiclesChecked++;
        // Skip if already has unresolved maintenance alert
        if (vehicle.alerts.length > 0) continue;
        // Calculate hours until next service
        if (!vehicle.nextServiceDate || !vehicle.serviceInterval) continue;

        const nextServiceAt =
          Math.ceil(vehicle.operatingHours / vehicle.serviceInterval) * vehicle.serviceInterval;
        const hoursUntilService = nextServiceAt - vehicle.operatingHours;

        // Alert if service is due within 50 hours
        if (hoursUntilService <= 50 && hoursUntilService > 0) {
          await prisma.vehicleAlert.create({
            data: {
              vehicleId: vehicle.id,
              type: 'MAINTENANCE_DUE',
              severity: hoursUntilService <= 25 ? 'HIGH' : 'MEDIUM',
              title: 'Maintenance Due Soon',
              description: `Service is due in approximately ${hoursUntilService} operating hours`,
            },
          });
          alertsCreated++;
          cronLogger.info({ vehicleId: vehicle.vehicleId }, 'Created maintenance alert');
        }

        // Alert if service is overdue based on date
        const nextService = new Date(vehicle.nextServiceDate);
        if (nextService < new Date()) {
          await prisma.vehicleAlert.create({
            data: {
              vehicleId: vehicle.id,
              type: 'MAINTENANCE_DUE',
              severity: 'HIGH',
              title: 'Maintenance Overdue',
              description: `Service was due on ${nextService.toLocaleDateString()}`,
            },
          });
          alertsCreated++;
          cronLogger.info({ vehicleId: vehicle.vehicleId }, 'Created overdue alert');
        }
      }

      if (batch.length < BATCH_SIZE) break;
      cursor = batch[batch.length - 1].id;
    }

    cronLogger.info({ count: vehiclesChecked }, 'Checked vehicles for maintenance alerts');

    // Phase 2: low health scores. Same cursor pattern so a customer with
    // a large unhealthy fleet doesn't blow memory.
    let healthCursor: string | undefined;
    while (true) {
      const batch = await prisma.vehicle.findMany({
        where: { status: 'ACTIVE', healthScore: { lt: 70 } },
        include: {
          alerts: { where: { type: 'OTHER', isResolved: false } },
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(healthCursor ? { cursor: { id: healthCursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      for (const vehicle of batch) {
        if (vehicle.alerts.length > 0) continue;

        await prisma.vehicleAlert.create({
          data: {
            vehicleId: vehicle.id,
            type: 'OTHER',
            severity: vehicle.healthScore < 50 ? 'HIGH' : 'MEDIUM',
            title: 'Low Health Score',
            description: `Vehicle health score is ${vehicle.healthScore}%. Inspection recommended.`,
          },
        });
        alertsCreated++;
        cronLogger.info({ vehicleId: vehicle.vehicleId }, 'Created health alert');
      }

      if (batch.length < BATCH_SIZE) break;
      healthCursor = batch[batch.length - 1].id;
    }

    return NextResponse.json({
      success: true,
      message: 'Maintenance alerts processed',
      vehiclesChecked,
      alertsCreated,
    });
  } catch (error: any) {
    cronLogger.error({ err: error }, 'Maintenance alerts error');

    return NextResponse.json(
      {
        error: 'Failed to process maintenance alerts',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req);
}
