// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { AnalyticsCollectionJobData } from '@/lib/queue/types';
import { prisma } from '@/lib/prisma';
import { finalizeOrderCostSavings } from '@/lib/services/cost-savings';
import { workerLogger } from '@/lib/logger';
import { Decimal } from '@prisma/client/runtime/library';

const QUEUE_NAME = 'analytics-collection';

/**
 * Calculate delivery performance metrics
 */
function calculateDeliveryMetrics(
  orderDate: Date,
  expectedDelivery: Date | null,
  actualDelivery: Date
) {
  // Total lead time in days (order to delivery)
  const leadTimeMs = actualDelivery.getTime() - orderDate.getTime();
  const totalLeadTimeDays = Math.ceil(leadTimeMs / (1000 * 60 * 60 * 24));

  // Expected vs actual delivery (negative = early, positive = late)
  let expectedVsActualDays = 0;
  let onTimeDelivery = true;

  if (expectedDelivery) {
    const diffMs = actualDelivery.getTime() - expectedDelivery.getTime();
    expectedVsActualDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    onTimeDelivery = expectedVsActualDays <= 0; // On time if delivered on or before expected
  }

  return {
    totalLeadTimeDays,
    expectedVsActualDays,
    onTimeDelivery,
  };
}

/**
 * Update supplier performance aggregates for the month
 */
async function updateSupplierPerformance(
  organizationId: string,
  supplierIdentifier: string,
  completedAt: Date,
  metrics: {
    totalLeadTimeDays: number;
    onTimeDelivery: boolean;
    actualSavings: number;
  }
) {
  const month = completedAt.getMonth() + 1; // 1-indexed
  const year = completedAt.getFullYear();

  // Upsert supplier performance record
  await prisma.supplierPerformance.upsert({
    where: {
      organizationId_supplierIdentifier_month_year: {
        organizationId,
        supplierIdentifier,
        month,
        year,
      },
    },
    create: {
      organizationId,
      supplierIdentifier,
      month,
      year,
      ordersDelivered: 1,
      totalLeadTimeDays: metrics.totalLeadTimeDays,
      onTimeDeliveries: metrics.onTimeDelivery ? 1 : 0,
      avgLeadTimeDays: new Decimal(metrics.totalLeadTimeDays),
      onTimeRate: new Decimal(metrics.onTimeDelivery ? 100 : 0),
      totalSavings: new Decimal(metrics.actualSavings),
      avgSavings: new Decimal(metrics.actualSavings),
    },
    update: {
      ordersDelivered: { increment: 1 },
      totalLeadTimeDays: { increment: metrics.totalLeadTimeDays },
      onTimeDeliveries: { increment: metrics.onTimeDelivery ? 1 : 0 },
      totalSavings: { increment: new Decimal(metrics.actualSavings) },
    },
  });

  // Recalculate averages after increment
  const record = await prisma.supplierPerformance.findUnique({
    where: {
      organizationId_supplierIdentifier_month_year: {
        organizationId,
        supplierIdentifier,
        month,
        year,
      },
    },
  });

  if (record && record.ordersDelivered > 0) {
    const newAvgLeadTime = record.totalLeadTimeDays / record.ordersDelivered;
    const newOnTimeRate = (record.onTimeDeliveries / record.ordersDelivered) * 100;
    const newAvgSavings = Number(record.totalSavings) / record.ordersDelivered;

    await prisma.supplierPerformance.update({
      where: { id: record.id },
      data: {
        avgLeadTimeDays: new Decimal(newAvgLeadTime),
        onTimeRate: new Decimal(newOnTimeRate),
        avgSavings: new Decimal(newAvgSavings),
      },
    });
  }
}

// Create worker
export const analyticsCollectionWorker = new Worker<AnalyticsCollectionJobData>(
  QUEUE_NAME,
  async (job: Job<AnalyticsCollectionJobData>) => {
    workerLogger.info({ jobId: job.id, jobData: job.data }, 'Processing analytics collection job');

    const { orderId } = job.data;

    try {


      // Fetch order with all related data
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: {
            include: {
              part: true,
            },
          },
          supplier: true,
        },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (order.status !== 'DELIVERED') {
        throw new Error(`Order ${orderId} is not in DELIVERED status`);
      }

      if (!order.actualDelivery) {
        throw new Error(`Order ${orderId} has no actual delivery date`);
      }

      if (!order.completedAt) {
        throw new Error(`Order ${orderId} has no completion timestamp`);
      }



      // Calculate delivery metrics
      const deliveryMetrics = calculateDeliveryMetrics(
        order.orderDate,
        order.expectedDelivery,
        order.actualDelivery
      );

      workerLogger.info(
        { orderId, deliveryMetrics },
        'Calculated delivery metrics'
      );



      // Calculate cost savings (moved from order creation to delivery)
      const costSavings = await finalizeOrderCostSavings(orderId);
      
      const savingsData = costSavings || {
        manualCost: 0,
        platformCost: Number(order.total),
        totalSavings: 0,
        savingsPercent: 0,
      };

      workerLogger.info(
        { orderId, savings: savingsData.totalSavings },
        'Calculated cost savings'
      );



      // Calculate fulfillment metrics
      const itemsFulfilled = order.orderItems.filter(item => item.isReceived).length;
      const itemsOrdered = order.orderItems.length;
      const fulfillmentRate = itemsOrdered > 0 
        ? (itemsFulfilled / itemsOrdered) * 100 
        : 100;

      // Get supplier identifier (name or ID)
      const supplierIdentifier = order.supplier?.name || order.supplierId;

      // Create OrderAnalytics record
      await prisma.orderAnalytics.create({
        data: {
          orderId: order.id,
          organizationId: order.organizationId,
          completedAt: order.completedAt,
          totalLeadTimeDays: deliveryMetrics.totalLeadTimeDays,
          expectedVsActualDays: deliveryMetrics.expectedVsActualDays,
          onTimeDelivery: deliveryMetrics.onTimeDelivery,
          itemsFulfilled,
          itemsOrdered,
          fulfillmentRate: new Decimal(fulfillmentRate),
          actualSavings: new Decimal(savingsData.totalSavings),
          manualCost: new Decimal(savingsData.manualCost),
          platformCost: new Decimal(savingsData.platformCost),
          savingsPercent: new Decimal(savingsData.savingsPercent),
          supplierIdentifier,
        },
      });

      workerLogger.info({ orderId }, 'Created OrderAnalytics record');



      // Update supplier performance aggregates
      await updateSupplierPerformance(
        order.organizationId,
        supplierIdentifier,
        order.completedAt,
        {
          totalLeadTimeDays: deliveryMetrics.totalLeadTimeDays,
          onTimeDelivery: deliveryMetrics.onTimeDelivery,
          actualSavings: savingsData.totalSavings,
        }
      );

      workerLogger.info({ orderId, supplierIdentifier }, 'Updated supplier performance');

      await job.updateProgress(100);

      return {
        success: true,
        orderId,
        analyticsCreated: true,
        supplierPerformanceUpdated: true,
        costSavings: savingsData.totalSavings,
      };
    } catch (error) {
      workerLogger.error(
        { jobId: job.id, orderId, error },
        'Failed to process analytics collection job'
      );
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

analyticsCollectionWorker.on('completed', (job) => {
  workerLogger.info({ jobId: job.id }, 'Analytics collection job completed');
});

analyticsCollectionWorker.on('failed', (job, err) => {
  workerLogger.error(
    { jobId: job?.id, error: err.message },
    'Analytics collection job failed'
  );
});

workerLogger.info('Analytics collection worker started');
