import { prisma } from '@/lib/prisma';

interface DeliveryMetrics {
  avgLeadTimeDays: number;
  onTimeDeliveryRate: number;
  fulfillmentRate: number;
  totalOrdersCompleted: number;
  completedOrders: Array<{
    orderId: string;
    orderNumber: string;
    completedAt: Date;
    leadTimeDays: number;
    onTime: boolean;
    totalAmount: number;
  }>;
}

interface SupplierPerformanceMetric {
  supplierIdentifier: string;
  month: number;
  year: number;
  ordersDelivered: number;
  avgLeadTimeDays: number;
  onTimeRate: number;
  totalSavings: number;
  avgSavings: number;
}

interface OrderTrendData {
  month: number;
  year: number;
  ordersCompleted: number;
  totalRevenue: number;
  avgOrderValue: number;
  avgLeadTime: number;
  onTimeRate: number;
}

/**
 * Get delivery performance metrics for an organization
 */
export async function getOrganizationDeliveryMetrics(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<DeliveryMetrics> {
  const analytics = await prisma.orderAnalytics.findMany({
    where: {
      organizationId,
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      order: {
        select: {
          orderNumber: true,
          total: true,
        },
      },
    },
  });

  if (analytics.length === 0) {
    return {
      avgLeadTimeDays: 0,
      onTimeDeliveryRate: 0,
      fulfillmentRate: 0,
      totalOrdersCompleted: 0,
      completedOrders: [],
    };
  }

  // Calculate aggregates
  const totalLeadTime = analytics.reduce((sum, a) => sum + a.totalLeadTimeDays, 0);
  const onTimeCount = analytics.filter(a => a.onTimeDelivery).length;
  const totalFulfillment = analytics.reduce((sum, a) => sum + Number(a.fulfillmentRate), 0);

  return {
    avgLeadTimeDays: Math.round(totalLeadTime / analytics.length),
    onTimeDeliveryRate: Number(((onTimeCount / analytics.length) * 100).toFixed(2)),
    fulfillmentRate: Number((totalFulfillment / analytics.length).toFixed(2)),
    totalOrdersCompleted: analytics.length,
    completedOrders: analytics.map(a => ({
      orderId: a.orderId,
      orderNumber: a.order.orderNumber,
      completedAt: a.completedAt,
      leadTimeDays: a.totalLeadTimeDays,
      onTime: a.onTimeDelivery,
      totalAmount: Number(a.order.total),
    })),
  };
}

/**
 * Get supplier performance metrics for an organization
 */
export async function getSupplierPerformance(
  organizationId: string,
  months: number = 12
): Promise<SupplierPerformanceMetric[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const startMonth = startDate.getMonth() + 1;
  const startYear = startDate.getFullYear();

  const records = await prisma.supplierPerformance.findMany({
    where: {
      organizationId,
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
    orderBy: [
      { year: 'desc' },
      { month: 'desc' },
    ],
  });

  return records.map(r => ({
    supplierIdentifier: r.supplierIdentifier,
    month: r.month,
    year: r.year,
    ordersDelivered: r.ordersDelivered,
    avgLeadTimeDays: Number(r.avgLeadTimeDays || 0),
    onTimeRate: Number(r.onTimeRate || 0),
    totalSavings: Number(r.totalSavings),
    avgSavings: Number(r.avgSavings || 0),
  }));
}

/**
 * Get order trend analytics over time
 */
export async function getOrderTrendAnalytics(
  organizationId: string,
  months: number = 12
): Promise<OrderTrendData[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  // Get all completed orders in the time range
  const analytics = await prisma.orderAnalytics.findMany({
    where: {
      organizationId,
      completedAt: {
        gte: startDate,
      },
    },
    include: {
      order: {
        select: {
          total: true,
        },
      },
    },
  });

  // Group by month/year
  const monthMap = new Map<string, {
    month: number;
    year: number;
    ordersCompleted: number;
    totalRevenue: number;
    totalLeadTime: number;
    onTimeCount: number;
  }>();

  for (const record of analytics) {
    const date = new Date(record.completedAt);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const key = `${year}-${month}`;

    const existing = monthMap.get(key);
    if (existing) {
      existing.ordersCompleted += 1;
      existing.totalRevenue += Number(record.order.total);
      existing.totalLeadTime += record.totalLeadTimeDays;
      if (record.onTimeDelivery) existing.onTimeCount += 1;
    } else {
      monthMap.set(key, {
        month,
        year,
        ordersCompleted: 1,
        totalRevenue: Number(record.order.total),
        totalLeadTime: record.totalLeadTimeDays,
        onTimeCount: record.onTimeDelivery ? 1 : 0,
      });
    }
  }

  // Convert to array and calculate averages
  return Array.from(monthMap.values())
    .map(m => ({
      month: m.month,
      year: m.year,
      ordersCompleted: m.ordersCompleted,
      totalRevenue: m.totalRevenue,
      avgOrderValue: m.ordersCompleted > 0 ? m.totalRevenue / m.ordersCompleted : 0,
      avgLeadTime: m.ordersCompleted > 0 ? m.totalLeadTime / m.ordersCompleted : 0,
      onTimeRate: m.ordersCompleted > 0 ? (m.onTimeCount / m.ordersCompleted) * 100 : 0,
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
}

/**
 * Get comprehensive analytics combining real-time and pre-aggregated data
 */
export async function getComprehensiveAnalytics(
  organizationId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    months?: number;
    isMasterAdmin?: boolean;
  } = {}
) {
  const {
    startDate = new Date(new Date().setMonth(new Date().getMonth() - 12)),
    endDate = new Date(),
    months = 12,
    isMasterAdmin = false,
  } = options;

  // If master admin, aggregate across all organizations
  const orgFilter = isMasterAdmin ? {} : { organizationId };

  // Get delivery metrics from OrderAnalytics
  const deliveryMetrics = await getOrganizationDeliveryMetrics(
    organizationId,
    startDate,
    endDate
  );

  // Get supplier performance
  const supplierMetrics = await getSupplierPerformance(organizationId, months);

  // Get trend data
  const trendData = await getOrderTrendAnalytics(organizationId, months);

  // Get real-time order counts by status
  const ordersByStatus = await prisma.order.groupBy({
    by: ['status'],
    where: {
      ...orgFilter,
      orderDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: {
      status: true,
    },
  });

  return {
    deliveryPerformance: deliveryMetrics,
    supplierPerformance: supplierMetrics,
    trends: trendData,
    ordersByStatus: ordersByStatus.map(o => ({
      status: o.status,
      count: o._count.status,
    })),
  };
}
