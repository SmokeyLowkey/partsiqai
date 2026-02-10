"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  ShoppingCart,
  FileText,
  Package,
  Truck,
  Activity,
  DollarSign,
  Percent,
  RefreshCw,
  PiggyBank,
  ExternalLink,
  Clock,
} from "lucide-react";

type AnalyticsData = {
  period: number;
  viewType: 'app-wide' | 'organization';
  users: {
    total: number;
    active: number;
    byRole: Array<{ role: string; _count: { role: number } }>;
    recent: Array<any>;
    growth: number;
  };
  organizations: {
    total: number;
    byTier: Array<{ subscriptionTier: string; _count: { subscriptionTier: number } }>;
    byStatus: Array<{ subscriptionStatus: string; _count: { subscriptionStatus: number } }>;
    recent: Array<any>;
  };
  orders: {
    total: number;
    byStatus: Array<{ status: string; _count: { status: number } }>;
    totalValue: number;
    averageValue: number;
    recent: Array<any>;
    overTime: Array<{ date: string; count: number; total: number }>;
    growth: string;
  };
  quotes: {
    total: number;
    byStatus: Array<{ status: string; _count: { status: number } }>;
    conversionRate: string;
  };
  parts: {
    total: number;
    lowStock: number;
  };
  activities: {
    recent: Array<any>;
    byType: Array<{ activityType: string; _count: { activityType: number } }>;
  };
  vehicles: {
    total: number;
    byStatus: Array<{ status: string; _count: { status: number } }>;
    pendingConfigs: number;
  };
  costSavings?: {
    totalSavings: number;
    totalManualCost: number;
    totalPlatformCost: number;
    savingsPercent: number;
    ordersProcessed: number;
    avgOrderValue: number;
    byOrganization?: Array<{
      organizationId: string;
      organizationName: string;
      totalSavings: number;
      savingsPercent: number;
      ordersProcessed: number;
    }>;
    monthly: Array<{
      month: number;
      year: number;
      totalSavings: number;
      savingsPercent: number;
      ordersProcessed: number;
    }>;
  };
  deliveryPerformance?: {
    avgLeadTimeDays: number;
    onTimeDeliveryRate: number;
    fulfillmentRate: number;
    totalOrdersCompleted: number;
    recentCompletedOrders: Array<{
      orderId: string;
      orderNumber: string;
      completedAt: Date;
      leadTimeDays: number;
      onTime: boolean;
      totalAmount: number;
    }>;
  };
  supplierPerformance?: Array<{
    supplierIdentifier: string;
    month: number;
    year: number;
    ordersDelivered: number;
    avgLeadTimeDays: number;
    onTimeRate: number;
    totalSavings: number;
    avgSavings: number;
  }>;
  orderTrends?: Array<{
    month: number;
    year: number;
    ordersCompleted: number;
    totalRevenue: number;
    avgOrderValue: number;
    avgLeadTime: number;
    onTimeRate: number;
  }>;
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics?period=${period}`);
      
      if (response.status === 403) {
        toast({
          title: "Access Denied",
          description: "Master Admin access required to view analytics",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      if (!response.ok) throw new Error("Failed to fetch analytics");
      
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="text-center py-12">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            {analytics.viewType === 'app-wide'
              ? 'Platform-wide metrics and insights'
              : 'Organization metrics and insights'}
          </p>
          {analytics.viewType === 'organization' && (
            <Badge variant="secondary" className="mt-2">Organization View</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analytics.orders.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {parseFloat(analytics.orders.growth) >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              {analytics.orders.growth}% from previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${analytics.orders.averageValue ? Number(analytics.orders.averageValue).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.orders.total} total orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quote Conversion</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.quotes.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.quotes.total} total quotes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.users.active}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.users.total} total users (+{analytics.users.growth})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Savings Section */}
      {analytics.costSavings && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/cost-savings" className="block">
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost Savings</CardTitle>
                <PiggyBank className="h-4 w-4 text-green-600 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  ${analytics.costSavings.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  View detailed analytics <ExternalLink className="h-3 w-3" />
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.costSavings.savingsPercent.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Average discount from OEM
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">OEM Cost (Avoided)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${analytics.costSavings.totalManualCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Would have cost at OEM prices
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actual Platform Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${analytics.costSavings.totalPlatformCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics.costSavings.ordersProcessed} orders tracked
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delivery Performance Section */}
      {analytics.deliveryPerformance && analytics.deliveryPerformance.totalOrdersCompleted > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Lead Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.deliveryPerformance.avgLeadTimeDays} days
              </div>
              <p className="text-xs text-muted-foreground">
                Order to delivery time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.deliveryPerformance.onTimeDeliveryRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Delivered on or before expected date
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fulfillment Rate</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.deliveryPerformance.fulfillmentRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics.deliveryPerformance.totalOrdersCompleted} orders completed
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Supplier Performance Section */}
      {analytics.supplierPerformance && analytics.supplierPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Supplier Performance</CardTitle>
            <CardDescription>Monthly supplier delivery metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-center">Avg Lead Time</TableHead>
                  <TableHead className="text-center">On-Time Rate</TableHead>
                  <TableHead className="text-right">Avg Savings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.supplierPerformance.slice(0, 10).map((supplier, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{supplier.supplierIdentifier}</TableCell>
                    <TableCell>
                      {new Date(supplier.year, supplier.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-center">{supplier.ordersDelivered}</TableCell>
                    <TableCell className="text-center">{supplier.avgLeadTimeDays.toFixed(1)} days</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={supplier.onTimeRate >= 80 ? "default" : "secondary"}>
                        {supplier.onTimeRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${supplier.avgSavings.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Charts and Detailed Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Orders Over Time */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Orders Over Time</CardTitle>
            <CardDescription>Daily order volume for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.orders.overTime.length > 0 ? (
              <div className="space-y-2">
                {analytics.orders.overTime.slice(-10).map((day: any) => (
                  <div key={day.date} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {new Date(day.date).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">{day.count} orders</span>
                      <span className="text-sm text-muted-foreground">
                        ${parseFloat(day.total || '0').toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No order data available</p>
            )}
          </CardContent>
        </Card>

        {/* Organization Breakdown - Only show for app-wide view */}
        {analytics.viewType === 'app-wide' ? (
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>Breakdown by tier and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">By Tier</h4>
                {analytics.organizations.byTier.map((tier) => (
                  <div key={tier.subscriptionTier} className="flex justify-between items-center mb-2">
                    <span className="text-sm">{tier.subscriptionTier}</span>
                    <Badge variant="outline">{tier._count.subscriptionTier}</Badge>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">By Status</h4>
                {analytics.organizations.byStatus.map((status) => (
                  <div key={status.subscriptionStatus} className="flex justify-between items-center mb-2">
                    <span className="text-sm">{status.subscriptionStatus}</span>
                    <Badge variant="outline">{status._count.subscriptionStatus}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Quote Status</CardTitle>
              <CardDescription>Breakdown by quote status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {analytics.quotes.byStatus.map((status) => (
                <div key={status.status} className="flex justify-between items-center">
                  <span className="text-sm">{status.status.replace(/_/g, ' ')}</span>
                  <Badge variant="outline">{status._count.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* User Roles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users by Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.users.byRole.map((role) => (
                <div key={role.role} className="flex justify-between items-center">
                  <span className="text-sm">{role.role}</span>
                  <Badge variant="secondary">{role._count.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Orders by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.orders.byStatus.map((status) => (
                <div key={status.status} className="flex justify-between items-center">
                  <span className="text-sm">{status.status.replace('_', ' ')}</span>
                  <Badge variant="secondary">{status._count.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Vehicles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Vehicles</span>
                <Badge variant="secondary">{analytics.vehicles.total}</Badge>
              </div>
              {analytics.vehicles.byStatus.map((status) => (
                <div key={status.status} className="flex justify-between items-center">
                  <span className="text-sm">{status.status}</span>
                  <Badge variant="outline">{status._count.status}</Badge>
                </div>
              ))}
              {analytics.vehicles.pendingConfigs > 0 && (
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm font-medium text-yellow-600">Pending Configs</span>
                  <Badge variant="outline" className="border-yellow-600">
                    {analytics.vehicles.pendingConfigs}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Savings by Organization - Only show for app-wide view */}
      {analytics.viewType === 'app-wide' && analytics.costSavings && analytics.costSavings.byOrganization && analytics.costSavings.byOrganization.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5" />
              Cost Savings by Organization
            </CardTitle>
            <CardDescription>Top organizations by cost savings</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Savings</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.costSavings.byOrganization.slice(0, 10).map((org) => (
                  <TableRow key={org.organizationId}>
                    <TableCell className="font-medium">{org.organizationName}</TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">
                      ${org.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right">
                      {org.savingsPercent.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{org.ordersProcessed}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            {analytics.viewType === 'app-wide'
              ? 'Latest system activities across all organizations'
              : 'Latest activities in your organization'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.activities.recent.slice(0, 10).map((activity: any) => (
                <TableRow key={activity.id}>
                  <TableCell>
                    <Badge variant="outline">{activity.activityType}</Badge>
                  </TableCell>
                  <TableCell>{activity.user?.name || 'System'}</TableCell>
                  <TableCell>{activity.organization?.name || 'N/A'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Activity Types */}
      <Card>
        <CardHeader>
          <CardTitle>Top Activity Types</CardTitle>
          <CardDescription>Most common activities in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {analytics.activities.byType.map((type) => (
              <Card key={type.activityType || 'unknown'}>
                <CardContent className="pt-6 text-center">
                  <div className="text-2xl font-bold">{type._count.activityType}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {type.activityType ? type.activityType.replace(/_/g, ' ') : 'Unknown'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
