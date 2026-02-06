import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cronLogger } from '@/lib/logger';

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
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cronLogger.info('Maintenance alerts triggered');

    // Get all active vehicles with service intervals
    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: 'ACTIVE',
        serviceInterval: {
          not: null,
        },
      },
      include: {
        alerts: {
          where: {
            type: 'MAINTENANCE_DUE',
            isResolved: false,
          },
        },
      },
    });

    cronLogger.info({ count: vehicles.length }, 'Checking vehicles for maintenance alerts');

    let alertsCreated = 0;

    for (const vehicle of vehicles) {
      // Skip if already has unresolved maintenance alert
      if (vehicle.alerts.length > 0) {
        continue;
      }

      // Calculate hours until next service
      if (!vehicle.nextServiceDate || !vehicle.serviceInterval) {
        continue;
      }

      const hoursUntilService =
        vehicle.operatingHours +
        vehicle.serviceInterval -
        vehicle.operatingHours;

      // Create alert if service is due within 50 hours
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

      // Create alert if service is overdue based on date
      const now = new Date();
      const nextService = new Date(vehicle.nextServiceDate);

      if (nextService < now) {
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

    // Check for low health scores
    const lowHealthVehicles = await prisma.vehicle.findMany({
      where: {
        status: 'ACTIVE',
        healthScore: {
          lt: 70,
        },
      },
      include: {
        alerts: {
          where: {
            type: 'OTHER',
            isResolved: false,
          },
        },
      },
    });

    for (const vehicle of lowHealthVehicles) {
      // Skip if already has unresolved health alert
      if (vehicle.alerts.length > 0) {
        continue;
      }

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

    return NextResponse.json({
      success: true,
      message: 'Maintenance alerts processed',
      vehiclesChecked: vehicles.length,
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
