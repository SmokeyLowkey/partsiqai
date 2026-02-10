import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface CostSavingsResult {
  manualCost: number;
  platformCost: number;
  totalSavings: number;
  savingsPercent: number;
  ordersProcessed: number;
  avgOrderValue: number;
}

/**
 * Calculate cost savings for an order by comparing the supplier's quoted prices
 * against the manufacturer list prices stored in the Parts table (part.price).
 *
 * - manualCost  = sum of (part.price × quantity) — what you'd pay at list price
 * - platformCost = sum of (orderItem.totalPrice) — what you actually paid the supplier
 * - totalSavings = manualCost − platformCost (positive = you saved money)
 */
export async function calculateOrderCostSavings(orderId: string): Promise<CostSavingsResult | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: {
          part: true,
        },
      },
    },
  });

  if (!order) {
    console.error(`Order not found: ${orderId}`);
    return null;
  }

  // Calculate manufacturer list price total (manualCost) from part.price.
  // Uses part.price (manufacturer list price, always set) as primary reference,
  // falling back to part.cost (OEM cost, optional) if price is 0.
  // EXCLUDES MISC-* items (shipping, taxes, fees) as they aren't parts.
  let manualCost = 0;
  let platformCost = 0;
  let itemsWithListPrice = 0;

  for (const item of order.orderItems) {
    // Skip MISC-* items (operational costs like shipping, taxes)
    if (item.partNumber.startsWith('MISC-')) {
      continue;
    }

    if (item.part) {
      const listPrice = Number(item.part.price) > 0
        ? Number(item.part.price)
        : (item.part.cost ? Number(item.part.cost) : 0);

      if (listPrice > 0) {
        manualCost += listPrice * item.quantity;
        platformCost += Number(item.totalPrice);
        itemsWithListPrice++;
      }
    }
  }

  // If no items have list prices, we can't calculate savings
  if (itemsWithListPrice === 0 || manualCost === 0) {
    console.log(`No manufacturer list prices found for order ${orderId}, skipping cost savings calculation`);
    return null;
  }

  const totalSavings = manualCost - platformCost;
  const savingsPercent = manualCost > 0 ? (totalSavings / manualCost) * 100 : 0;

  return {
    manualCost,
    platformCost,
    totalSavings,
    savingsPercent,
    ordersProcessed: 1,
    avgOrderValue: platformCost,
  };
}

/**
 * Record cost savings for an order into the monthly aggregated CostSavingsRecord
 * @deprecated Use finalizeOrderCostSavings instead - called when order is DELIVERED, not created
 */
export async function recordOrderCostSavings(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { organizationId: true, createdAt: true },
    });

    if (!order) {
      console.error(`Order not found: ${orderId}`);
      return;
    }

    const savings = await calculateOrderCostSavings(orderId);
    if (!savings) {
      return;
    }

    const month = order.createdAt.getMonth() + 1; // 1-indexed
    const year = order.createdAt.getFullYear();

    // Upsert the monthly cost savings record
    await prisma.costSavingsRecord.upsert({
      where: {
        organizationId_month_year: {
          organizationId: order.organizationId,
          month,
          year,
        },
      },
      create: {
        organizationId: order.organizationId,
        month,
        year,
        totalSavings: new Decimal(savings.totalSavings),
        manualCost: new Decimal(savings.manualCost),
        platformCost: new Decimal(savings.platformCost),
        savingsPercent: new Decimal(savings.savingsPercent),
        ordersProcessed: 1,
        avgOrderValue: new Decimal(savings.avgOrderValue),
      },
      update: {
        totalSavings: {
          increment: new Decimal(savings.totalSavings),
        },
        manualCost: {
          increment: new Decimal(savings.manualCost),
        },
        platformCost: {
          increment: new Decimal(savings.platformCost),
        },
        ordersProcessed: {
          increment: 1,
        },
        // Recalculate savings percent and avg order value
        // This is done via a raw update to handle the calculation properly
      },
    });

    // After upsert with increment, recalculate the derived fields
    const record = await prisma.costSavingsRecord.findUnique({
      where: {
        organizationId_month_year: {
          organizationId: order.organizationId,
          month,
          year,
        },
      },
    });

    if (record && Number(record.manualCost) > 0) {
      const newSavingsPercent = (Number(record.totalSavings) / Number(record.manualCost)) * 100;
      const newAvgOrderValue = Number(record.platformCost) / record.ordersProcessed;

      await prisma.costSavingsRecord.update({
        where: { id: record.id },
        data: {
          savingsPercent: new Decimal(newSavingsPercent),
          avgOrderValue: new Decimal(newAvgOrderValue),
        },
      });
    }

    console.log(`Cost savings recorded for order ${orderId}: $${savings.totalSavings.toFixed(2)} (${savings.savingsPercent.toFixed(1)}%)`);
  } catch (error) {
    console.error('Failed to record cost savings:', error);
    // Don't throw - cost savings recording shouldn't break order flow
  }
}

/**
 * Finalize cost savings for a delivered order
 * This should be called when an order is completed/delivered, not when created
 * Uses the completion date (actualDelivery) for month/year calculation
 */
export async function finalizeOrderCostSavings(orderId: string): Promise<CostSavingsResult | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { 
        organizationId: true, 
        actualDelivery: true,
        status: true,
      },
    });

    if (!order) {
      console.error(`Order not found: ${orderId}`);
      return null;
    }

    if (order.status !== 'DELIVERED') {
      console.error(`Order ${orderId} is not in DELIVERED status`);
      return null;
    }

    if (!order.actualDelivery) {
      console.error(`Order ${orderId} has no actual delivery date`);
      return null;
    }

    const savings = await calculateOrderCostSavings(orderId);
    if (!savings) {
      return null;
    }

    // Use actual delivery date for month/year (not creation date)
    const month = order.actualDelivery.getMonth() + 1; // 1-indexed
    const year = order.actualDelivery.getFullYear();

    // Upsert the monthly cost savings record
    await prisma.costSavingsRecord.upsert({
      where: {
        organizationId_month_year: {
          organizationId: order.organizationId,
          month,
          year,
        },
      },
      create: {
        organizationId: order.organizationId,
        month,
        year,
        totalSavings: new Decimal(savings.totalSavings),
        manualCost: new Decimal(savings.manualCost),
        platformCost: new Decimal(savings.platformCost),
        savingsPercent: new Decimal(savings.savingsPercent),
        ordersProcessed: 1,
        avgOrderValue: new Decimal(savings.avgOrderValue),
      },
      update: {
        totalSavings: {
          increment: new Decimal(savings.totalSavings),
        },
        manualCost: {
          increment: new Decimal(savings.manualCost),
        },
        platformCost: {
          increment: new Decimal(savings.platformCost),
        },
        ordersProcessed: {
          increment: 1,
        },
      },
    });

    // After upsert with increment, recalculate the derived fields
    const record = await prisma.costSavingsRecord.findUnique({
      where: {
        organizationId_month_year: {
          organizationId: order.organizationId,
          month,
          year,
        },
      },
    });

    if (record && Number(record.manualCost) > 0) {
      const newSavingsPercent = (Number(record.totalSavings) / Number(record.manualCost)) * 100;
      const newAvgOrderValue = Number(record.platformCost) / record.ordersProcessed;

      await prisma.costSavingsRecord.update({
        where: { id: record.id },
        data: {
          savingsPercent: new Decimal(newSavingsPercent),
          avgOrderValue: new Decimal(newAvgOrderValue),
        },
      });
    }

    console.log(`Cost savings finalized for order ${orderId}: $${savings.totalSavings.toFixed(2)} (${savings.savingsPercent.toFixed(1)}%)`);
    
    return savings;
  } catch (error) {
    console.error('Failed to finalize cost savings:', error);
    // Don't throw - cost savings recording shouldn't break order flow
    return null;
  }
}

/**
 * Get cost savings summary for an organization
 */
export async function getOrganizationCostSavings(
  organizationId: string,
  options?: {
    months?: number; // Number of months to look back (default: 12)
  }
): Promise<{
  totalSavings: number;
  totalManualCost: number;
  totalPlatformCost: number;
  overallSavingsPercent: number;
  totalOrdersProcessed: number;
  avgOrderValue: number;
  monthlySavings: Array<{
    month: number;
    year: number;
    totalSavings: number;
    savingsPercent: number;
    ordersProcessed: number;
  }>;
}> {
  const months = options?.months || 12;

  // Calculate the date range
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const startMonth = startDate.getMonth() + 1;
  const startYear = startDate.getFullYear();

  // Fetch all cost savings records for the organization in the date range
  const records = await prisma.costSavingsRecord.findMany({
    where: {
      organizationId,
      OR: [
        // Same year, month >= start month
        {
          year: startYear,
          month: { gte: startMonth },
        },
        // Later years
        {
          year: { gt: startYear },
        },
      ],
    },
    orderBy: [
      { year: 'asc' },
      { month: 'asc' },
    ],
  });

  // Aggregate the results
  let totalSavings = 0;
  let totalManualCost = 0;
  let totalPlatformCost = 0;
  let totalOrdersProcessed = 0;

  const monthlySavings = records.map(record => {
    const savings = Number(record.totalSavings);
    const manual = Number(record.manualCost);
    const platform = Number(record.platformCost);

    totalSavings += savings;
    totalManualCost += manual;
    totalPlatformCost += platform;
    totalOrdersProcessed += record.ordersProcessed;

    return {
      month: record.month,
      year: record.year,
      totalSavings: savings,
      savingsPercent: Number(record.savingsPercent),
      ordersProcessed: record.ordersProcessed,
    };
  });

  const overallSavingsPercent = totalManualCost > 0
    ? (totalSavings / totalManualCost) * 100
    : 0;

  const avgOrderValue = totalOrdersProcessed > 0
    ? totalPlatformCost / totalOrdersProcessed
    : 0;

  return {
    totalSavings,
    totalManualCost,
    totalPlatformCost,
    overallSavingsPercent,
    totalOrdersProcessed,
    avgOrderValue,
    monthlySavings,
  };
}

/**
 * Get cost savings summary across all organizations (for admin dashboard)
 */
export async function getAllOrganizationsCostSavings(options?: {
  months?: number;
}): Promise<{
  totalSavings: number;
  totalManualCost: number;
  totalPlatformCost: number;
  overallSavingsPercent: number;
  totalOrdersProcessed: number;
  avgOrderValue: number;
  savingsByOrganization: Array<{
    organizationId: string;
    organizationName: string;
    totalSavings: number;
    savingsPercent: number;
    ordersProcessed: number;
  }>;
  monthlySavings: Array<{
    month: number;
    year: number;
    totalSavings: number;
    savingsPercent: number;
    ordersProcessed: number;
  }>;
}> {
  const months = options?.months || 12;

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startMonth = startDate.getMonth() + 1;
  const startYear = startDate.getFullYear();

  // Fetch all cost savings records in the date range
  const records = await prisma.costSavingsRecord.findMany({
    where: {
      OR: [
        {
          year: startYear,
          month: { gte: startMonth },
        },
        {
          year: { gt: startYear },
        },
      ],
    },
    include: {
      organization: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      { year: 'asc' },
      { month: 'asc' },
    ],
  });

  // Aggregate by organization
  const orgMap = new Map<string, {
    organizationId: string;
    organizationName: string;
    totalSavings: number;
    manualCost: number;
    ordersProcessed: number;
  }>();

  // Aggregate by month
  const monthMap = new Map<string, {
    month: number;
    year: number;
    totalSavings: number;
    manualCost: number;
    ordersProcessed: number;
  }>();

  let totalSavings = 0;
  let totalManualCost = 0;
  let totalPlatformCost = 0;
  let totalOrdersProcessed = 0;

  for (const record of records) {
    const savings = Number(record.totalSavings);
    const manual = Number(record.manualCost);
    const platform = Number(record.platformCost);

    totalSavings += savings;
    totalManualCost += manual;
    totalPlatformCost += platform;
    totalOrdersProcessed += record.ordersProcessed;

    // Aggregate by organization
    const orgKey = record.organizationId;
    const existing = orgMap.get(orgKey);
    if (existing) {
      existing.totalSavings += savings;
      existing.manualCost += manual;
      existing.ordersProcessed += record.ordersProcessed;
    } else {
      orgMap.set(orgKey, {
        organizationId: record.organizationId,
        organizationName: record.organization.name,
        totalSavings: savings,
        manualCost: manual,
        ordersProcessed: record.ordersProcessed,
      });
    }

    // Aggregate by month
    const monthKey = `${record.year}-${record.month}`;
    const monthExisting = monthMap.get(monthKey);
    if (monthExisting) {
      monthExisting.totalSavings += savings;
      monthExisting.manualCost += manual;
      monthExisting.ordersProcessed += record.ordersProcessed;
    } else {
      monthMap.set(monthKey, {
        month: record.month,
        year: record.year,
        totalSavings: savings,
        manualCost: manual,
        ordersProcessed: record.ordersProcessed,
      });
    }
  }

  const overallSavingsPercent = totalManualCost > 0
    ? (totalSavings / totalManualCost) * 100
    : 0;

  const avgOrderValue = totalOrdersProcessed > 0
    ? totalPlatformCost / totalOrdersProcessed
    : 0;

  const savingsByOrganization = Array.from(orgMap.values()).map(org => ({
    organizationId: org.organizationId,
    organizationName: org.organizationName,
    totalSavings: org.totalSavings,
    savingsPercent: org.manualCost > 0 ? (org.totalSavings / org.manualCost) * 100 : 0,
    ordersProcessed: org.ordersProcessed,
  })).sort((a, b) => b.totalSavings - a.totalSavings);

  const monthlySavings = Array.from(monthMap.values()).map(m => ({
    month: m.month,
    year: m.year,
    totalSavings: m.totalSavings,
    savingsPercent: m.manualCost > 0 ? (m.totalSavings / m.manualCost) * 100 : 0,
    ordersProcessed: m.ordersProcessed,
  }));

  return {
    totalSavings,
    totalManualCost,
    totalPlatformCost,
    overallSavingsPercent,
    totalOrdersProcessed,
    avgOrderValue,
    savingsByOrganization,
    monthlySavings,
  };
}
