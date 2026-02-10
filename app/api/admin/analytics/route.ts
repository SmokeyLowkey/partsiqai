import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllOrganizationsCostSavings, getOrganizationCostSavings } from "@/lib/services/cost-savings";
import { 
  getOrganizationDeliveryMetrics, 
  getSupplierPerformance, 
  getOrderTrendAnalytics 
} from "@/lib/services/analytics-aggregation";

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    const currentUser = session?.user;

    // Allow both MASTER_ADMIN and ADMIN roles
    if (!currentUser || (currentUser.role !== "MASTER_ADMIN" && currentUser.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const isMasterAdmin = currentUser.role === "MASTER_ADMIN";
    const organizationId = currentUser.organizationId;

    // For org admins, require organization context
    if (!isMasterAdmin && !organizationId) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30"; // days
    const days = parseInt(period);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Organization filter for non-master admins
    const orgFilter = isMasterAdmin ? {} : { organizationId };

    // Get comprehensive analytics (filtered by organization for non-master admins)
    const [
      // User metrics
      totalUsers,
      activeUsers,
      usersByRole,
      recentUsers,
      userGrowth,

      // Organization metrics (only for master admin)
      totalOrganizations,
      organizationsByTier,
      organizationsByStatus,
      recentOrganizations,

      // Order metrics
      totalOrders,
      ordersByStatus,
      orderTotalValue,
      recentOrders,
      ordersOverTime,

      // Quote metrics
      totalQuotes,
      quotesByStatus,
      quoteConversionRate,

      // Parts metrics
      totalParts,
      partsLowStock,

      // Activity metrics
      recentActivities,
      activityByType,

      // Vehicle metrics
      totalVehicles,
      vehiclesByStatus,
      pendingVehicleConfigs,
    ] = await Promise.all([
      // Users - filtered by org for non-master admins
      prisma.user.count({ where: orgFilter }),
      prisma.user.count({ where: { isActive: true, ...orgFilter } }),
      prisma.user.groupBy({
        by: ['role'],
        where: orgFilter,
        _count: { role: true },
      }),
      prisma.user.findMany({
        take: 10,
        where: orgFilter,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          organization: { select: { name: true } },
        },
      }),
      prisma.user.count({ where: { createdAt: { gte: startDate }, ...orgFilter } }),

      // Organizations - only meaningful for master admin, returns 1 for org admin
      isMasterAdmin ? prisma.organization.count() : Promise.resolve(1),
      isMasterAdmin ? prisma.organization.groupBy({
        by: ['subscriptionTier'],
        _count: { subscriptionTier: true },
      }) : Promise.resolve([]),
      isMasterAdmin ? prisma.organization.groupBy({
        by: ['subscriptionStatus'],
        _count: { subscriptionStatus: true },
      }) : Promise.resolve([]),
      isMasterAdmin ? prisma.organization.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          createdAt: true,
        },
      }) : prisma.organization.findMany({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          createdAt: true,
        },
      }),

      // Orders - filtered by org for non-master admins
      prisma.order.count({ where: orgFilter }),
      prisma.order.groupBy({
        by: ['status'],
        where: orgFilter,
        _count: { status: true },
      }),
      prisma.order.aggregate({
        where: orgFilter,
        _sum: { total: true },
        _avg: { total: true },
      }),
      prisma.order.findMany({
        take: 10,
        where: orgFilter,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          organization: { select: { name: true } },
        },
      }),
      // Orders by day for the period - filtered by org
      // Fetch orders and group by date in JavaScript (safer than raw SQL)
      prisma.order.findMany({
        where: {
          createdAt: { gte: startDate },
          ...orgFilter,
        },
        select: {
          createdAt: true,
          total: true,
        },
      }),

      // Quotes - filtered by org for non-master admins
      prisma.quoteRequest.count({ where: orgFilter }),
      prisma.quoteRequest.groupBy({
        by: ['status'],
        where: orgFilter,
        _count: { status: true },
      }),
      prisma.quoteRequest.count({
        where: { status: 'CONVERTED_TO_ORDER', ...orgFilter }
      }).then(converted =>
        prisma.quoteRequest.count({ where: orgFilter }).then(total =>
          total > 0 ? (converted / total * 100).toFixed(2) : '0'
        )
      ),

      // Parts - not org-specific, show all
      prisma.part.count(),
      prisma.part.count({
        where: {
          stockQuantity: { lte: prisma.part.fields.minStockLevel },
        },
      }),

      // Activities - filtered by org for non-master admins
      prisma.activityLog.findMany({
        take: 20,
        where: orgFilter,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          userId: true,
          createdAt: true,
          organization: { select: { name: true } },
        },
      }),
      prisma.activityLog.groupBy({
        by: ['type'],
        where: orgFilter,
        _count: { type: true },
        orderBy: { _count: { type: 'desc' } },
        take: 10,
      }),

      // Vehicles - filtered by org for non-master admins
      prisma.vehicle.count({ where: orgFilter }),
      prisma.vehicle.groupBy({
        by: ['status'],
        where: orgFilter,
        _count: { status: true },
      }),
      prisma.vehicleSearchMapping.count({
        where: { verifiedAt: null },
      }),
    ]);

    // Group orders by date in JavaScript (safer than raw SQL)
    const ordersByDay = ordersOverTime.reduce((acc: Record<string, { date: string; count: number; total: number }>, order) => {
      const date = order.createdAt.toISOString().split('T')[0]; // Get YYYY-MM-DD
      if (!acc[date]) {
        acc[date] = { date, count: 0, total: 0 };
      }
      acc[date].count += 1;
      acc[date].total += Number(order.total) || 0;
      return acc;
    }, {});
    
    // Convert to array and sort by date
    const ordersOverTimeFormatted = Object.values(ordersByDay).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Calculate growth percentages
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - days);

    const previousOrders = await prisma.order.count({
      where: {
        createdAt: { gte: previousPeriodStart, lt: startDate },
        ...orgFilter,
      },
    });

    const orderGrowth = previousOrders > 0
      ? ((totalOrders - previousOrders) / previousOrders * 100).toFixed(1)
      : '0';

    // Get cost savings data - filtered by org for non-master admins
    const costSavingsData = isMasterAdmin
      ? await getAllOrganizationsCostSavings({
          months: Math.ceil(days / 30) || 12,
        })
      : await getOrganizationCostSavings(organizationId!, {
          months: Math.ceil(days / 30) || 12,
        });

    // Get new analytics data - delivery performance, supplier metrics, trends
    // Only fetch for organization context (not implemented for master admin cross-org aggregation yet)
    let deliveryPerformance = null;
    let supplierPerformance = null;
    let orderTrends = null;

    if (organizationId) {
      try {
        deliveryPerformance = await getOrganizationDeliveryMetrics(
          organizationId,
          startDate,
          new Date()
        );

        supplierPerformance = await getSupplierPerformance(
          organizationId,
          Math.ceil(days / 30) || 12
        );

        orderTrends = await getOrderTrendAnalytics(
          organizationId,
          Math.ceil(days / 30) || 12
        );
      } catch (error) {
        console.error('Error fetching enhanced analytics:', error);
        // Don't fail the entire request if new analytics fail
      }
    }

    return NextResponse.json({
      period: days,
      users: {
        total: totalUsers,
        active: activeUsers,
        byRole: usersByRole,
        recent: recentUsers,
        growth: userGrowth,
      },
      organizations: {
        total: totalOrganizations,
        byTier: organizationsByTier,
        byStatus: organizationsByStatus,
        recent: recentOrganizations,
      },
      orders: {
        total: totalOrders,
        byStatus: ordersByStatus,
        totalValue: orderTotalValue._sum?.total || 0,
        averageValue: orderTotalValue._avg?.total || 0,
        recent: recentOrders,
        overTime: ordersOverTimeFormatted,
        growth: orderGrowth,
      },
      quotes: {
        total: totalQuotes,
        byStatus: quotesByStatus,
        conversionRate: quoteConversionRate,
      },
      parts: {
        total: totalParts,
        lowStock: partsLowStock,
      },
      activities: {
        recent: recentActivities,
        byType: activityByType,
      },
      vehicles: {
        total: totalVehicles,
        byStatus: vehiclesByStatus,
        pendingConfigs: pendingVehicleConfigs,
      },
      costSavings: {
        totalSavings: costSavingsData.totalSavings,
        totalManualCost: costSavingsData.totalManualCost,
        totalPlatformCost: costSavingsData.totalPlatformCost,
        savingsPercent: costSavingsData.overallSavingsPercent,
        ordersProcessed: costSavingsData.totalOrdersProcessed,
        avgOrderValue: costSavingsData.avgOrderValue,
        // Only include byOrganization for master admins
        byOrganization: isMasterAdmin ? (costSavingsData as any).savingsByOrganization : undefined,
        monthly: costSavingsData.monthlySavings,
      },
      deliveryPerformance: deliveryPerformance ? {
        avgLeadTimeDays: deliveryPerformance.avgLeadTimeDays,
        onTimeDeliveryRate: deliveryPerformance.onTimeDeliveryRate,
        fulfillmentRate: deliveryPerformance.fulfillmentRate,
        totalOrdersCompleted: deliveryPerformance.totalOrdersCompleted,
        recentCompletedOrders: deliveryPerformance.completedOrders.slice(0, 10),
      } : null,
      supplierPerformance: supplierPerformance || [],
      orderTrends: orderTrends || [],
      // Include role info so frontend knows what view to show
      viewType: isMasterAdmin ? 'app-wide' : 'organization',
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
