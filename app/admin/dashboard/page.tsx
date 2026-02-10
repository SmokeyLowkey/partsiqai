import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, ShoppingCart, Package, Building2, TrendingUp, AlertCircle, CheckCircle, Clock, Truck, DollarSign, Timer, BarChart3 } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

export const revalidate = 60 // Revalidate every 60 seconds

// Stats for MASTER_ADMIN (platform-wide)
async function getMasterAdminStats() {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

  const [
    totalUsers,
    lastMonthUsers,
    totalOrganizations,
    activeOrganizations,
    lastMonthOrganizations,
    totalOrders,
    lastMonthOrders,
    totalParts,
    totalQuoteRequests,
    recentOrders,
    orderAnalytics,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: lastMonth } } }),
    prisma.organization.count(),
    prisma.organization.count({ where: { subscriptionStatus: "ACTIVE" } }),
    prisma.organization.count({ where: { createdAt: { gte: lastMonth } } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: lastMonth } } }),
    prisma.part.count(),
    prisma.quoteRequest.count(),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        organization: {
          select: { name: true },
        },
        orderItems: {
          select: { id: true },
        },
      },
    }),
    // Platform-wide analytics
    prisma.orderAnalytics.findMany({}),
  ])

  // Aggregate analytics
  let totalSavings = 0
  let totalManualCost = 0
  let totalPlatformCost = 0
  let totalLeadTimeDays = 0
  let onTimeCount = 0
  const completedCount = orderAnalytics.length

  for (const a of orderAnalytics) {
    totalSavings += Number(a.actualSavings)
    totalManualCost += Number(a.manualCost)
    totalPlatformCost += Number(a.platformCost)
    totalLeadTimeDays += a.totalLeadTimeDays
    if (a.onTimeDelivery) onTimeCount++
  }

  const avgLeadTime = completedCount > 0 ? totalLeadTimeDays / completedCount : 0
  const onTimeRate = completedCount > 0 ? (onTimeCount / completedCount) * 100 : 0
  const savingsPercent = totalManualCost > 0 ? (totalSavings / totalManualCost) * 100 : 0

  const userGrowth = lastMonthUsers > 0 ? Math.round((lastMonthUsers / (totalUsers - lastMonthUsers)) * 100) : 0
  const orderGrowth = lastMonthOrders > 0 ? Math.round((lastMonthOrders / (totalOrders - lastMonthOrders)) * 100) : 0

  return {
    totalUsers,
    userGrowth,
    totalOrganizations,
    activeOrganizations,
    newOrganizations: lastMonthOrganizations,
    totalOrders,
    orderGrowth,
    totalParts,
    totalQuoteRequests,
    recentOrders,
    analytics: {
      totalSavings,
      totalManualCost,
      totalPlatformCost,
      savingsPercent,
      avgLeadTime,
      onTimeRate,
      completedOrders: completedCount,
    },
  }
}

// Stats for org ADMIN (organization-specific)
async function getOrgAdminStats(organizationId: string) {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

  const [
    totalUsers,
    lastMonthUsers,
    totalOrders,
    lastMonthOrders,
    totalVehicles,
    activeVehicles,
    totalQuoteRequests,
    recentOrders,
    organization,
    orderAnalytics,
    recentCompletedOrders,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId } }),
    prisma.user.count({ where: { organizationId, createdAt: { gte: lastMonth } } }),
    prisma.order.count({ where: { organizationId } }),
    prisma.order.count({ where: { organizationId, createdAt: { gte: lastMonth } } }),
    prisma.vehicle.count({ where: { organizationId } }),
    prisma.vehicle.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.quoteRequest.count({ where: { organizationId } }),
    prisma.order.findMany({
      where: { organizationId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        orderItems: {
          select: { id: true },
        },
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    // Fetch all order analytics for this org
    prisma.orderAnalytics.findMany({
      where: { organizationId },
    }),
    // Recent completed orders with item-level price comparison
    prisma.order.findMany({
      where: { organizationId, status: "DELIVERED" },
      take: 5,
      orderBy: { completedAt: "desc" },
      include: {
        supplier: { select: { name: true } },
        orderItems: {
          include: {
            part: { select: { price: true, cost: true, partNumber: true, description: true } },
          },
        },
        orderAnalytics: true,
      },
    }),
  ])

  // Aggregate analytics
  let totalSavings = 0
  let totalManualCost = 0
  let totalPlatformCost = 0
  let totalLeadTimeDays = 0
  let onTimeCount = 0
  const completedCount = orderAnalytics.length

  for (const a of orderAnalytics) {
    totalSavings += Number(a.actualSavings)
    totalManualCost += Number(a.manualCost)
    totalPlatformCost += Number(a.platformCost)
    totalLeadTimeDays += a.totalLeadTimeDays
    if (a.onTimeDelivery) onTimeCount++
  }

  const avgLeadTime = completedCount > 0 ? totalLeadTimeDays / completedCount : 0
  const onTimeRate = completedCount > 0 ? (onTimeCount / completedCount) * 100 : 0
  const savingsPercent = totalManualCost > 0 ? (totalSavings / totalManualCost) * 100 : 0

  const userGrowth = lastMonthUsers > 0 ? Math.round((lastMonthUsers / (totalUsers - lastMonthUsers)) * 100) : 0
  const orderGrowth = lastMonthOrders > 0 ? Math.round((lastMonthOrders / (totalOrders - lastMonthOrders)) * 100) : 0

  return {
    totalUsers,
    userGrowth,
    totalOrders,
    orderGrowth,
    totalVehicles,
    activeVehicles,
    totalQuoteRequests,
    recentOrders,
    organizationName: organization?.name || "Your Organization",
    analytics: {
      totalSavings,
      totalManualCost,
      totalPlatformCost,
      savingsPercent,
      avgLeadTime,
      onTimeRate,
      completedOrders: completedCount,
    },
    recentCompletedOrders,
  }
}

export default async function AdminDashboardPage() {
  const session = await getServerSession()
  const currentUser = session?.user

  if (!currentUser) {
    redirect("/login")
  }

  if (currentUser.role !== "MASTER_ADMIN" && currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER") {
    redirect("/login")
  }

  const isMasterAdmin = currentUser.role === "MASTER_ADMIN"

  // Render different dashboards based on role
  // Managers and Admins see org-level dashboard, Master Admins see platform-wide
  if (isMasterAdmin) {
    const stats = await getMasterAdminStats()
    return <MasterAdminDashboard stats={stats} />
  } else {
    const stats = await getOrgAdminStats(currentUser.organizationId)
    return <OrgAdminDashboard stats={stats} />
  }
}

// MASTER_ADMIN Dashboard - Platform-wide view
function MasterAdminDashboard({ stats }: { stats: Awaited<ReturnType<typeof getMasterAdminStats>> }) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.userGrowth > 0 ? `+${stats.userGrowth}%` : `${stats.userGrowth}%`} from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Active Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.activeOrganizations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.newOrganizations > 0 ? `+${stats.newOrganizations}` : stats.newOrganizations} new this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.orderGrowth > 0 ? `+${stats.orderGrowth}%` : `${stats.orderGrowth}%`} from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Parts Catalog</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalParts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats.totalQuoteRequests} quote requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Overview */}
      {stats.analytics.completedOrders > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Total Cost Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${stats.analytics.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.analytics.savingsPercent > 0 ? `${stats.analytics.savingsPercent.toFixed(1)}% below list price` : 'No savings data yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">List Price Total</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                ${stats.analytics.totalManualCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Paid ${stats.analytics.totalPlatformCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} via suppliers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Avg Lead Time</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.analytics.avgLeadTime.toFixed(1)} days
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.analytics.completedOrders} orders completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">On-Time Delivery</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.analytics.onTimeRate.toFixed(0)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Delivered on or before expected date
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Orders */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest orders across all tenants</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent orders
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg bg-card"
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium text-foreground">{order.orderNumber || order.id.substring(0, 8).toUpperCase()}</p>
                        <p className="text-sm text-muted-foreground">{order.organization?.name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          ${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}
                        </p>
                        <p className="text-sm text-muted-foreground">{order.orderItems?.length || 0} parts</p>
                      </div>
                      <Badge
                        variant={
                          order.status === "DELIVERED"
                            ? "default"
                            : order.status === "PROCESSING" || order.status === "IN_TRANSIT"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-xs"
                      >
                        {(order.status === "DELIVERED" || order.status === "COMPLETED") && <CheckCircle className="h-3 w-3 mr-1" />}
                        {(order.status === "PROCESSING" || order.status === "IN_TRANSIT") && <Clock className="h-3 w-3 mr-1" />}
                        {(order.status === "PENDING" || order.status === "PENDING_QUOTE") && <AlertCircle className="h-3 w-3 mr-1" />}
                        {order.status?.toLowerCase().replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Current system status and alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">API Services</span>
              </div>
              <Badge
                variant="secondary"
                className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700"
              >
                Online
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">Database</span>
              </div>
              <Badge
                variant="secondary"
                className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700"
              >
                Healthy
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">AI Services</span>
              </div>
              <Badge
                variant="outline"
                className="border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200"
              >
                High Load
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">Storage</span>
              </div>
              <Badge
                variant="secondary"
                className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700"
              >
                85% Free
              </Badge>
            </div>

            <Button className="w-full bg-transparent" variant="outline" asChild>
              <Link href="/admin/analytics">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Detailed Analytics
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-20 flex-col bg-transparent" asChild>
              <Link href="/admin/users">
                <Users className="h-6 w-6 mb-2" />
                Manage Users
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col bg-transparent" asChild>
              <Link href="/admin/tenants">
                <Building2 className="h-6 w-6 mb-2" />
                Manage Tenants
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col bg-transparent" asChild>
              <Link href="/admin/products">
                <Package className="h-6 w-6 mb-2" />
                Manage Products
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col bg-transparent" asChild>
              <Link href="/admin/analytics">
                <TrendingUp className="h-6 w-6 mb-2" />
                View Analytics
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Org ADMIN Dashboard - Organization-specific view
function OrgAdminDashboard({ stats }: { stats: Awaited<ReturnType<typeof getOrgAdminStats>> }) {
  return (
    <div className="space-y-6">
      {/* Organization Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{stats.organizationName}</h2>
          <p className="text-muted-foreground">Organization Dashboard</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.userGrowth > 0 ? `+${stats.userGrowth}%` : `${stats.userGrowth}%`} from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              {stats.orderGrowth > 0 ? `+${stats.orderGrowth}%` : `${stats.orderGrowth}%`} from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Vehicles</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalVehicles}</div>
            <p className="text-xs text-muted-foreground">{stats.activeVehicles} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Quote Requests</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalQuoteRequests}</div>
            <p className="text-xs text-muted-foreground">Total requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Overview */}
      {stats.analytics.completedOrders > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Total Cost Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${stats.analytics.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.analytics.savingsPercent > 0 ? `${stats.analytics.savingsPercent.toFixed(1)}% below list price` : 'No savings data yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">List Price Total</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                ${stats.analytics.totalManualCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Paid ${stats.analytics.totalPlatformCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} via suppliers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Avg Lead Time</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.analytics.avgLeadTime.toFixed(1)} days
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.analytics.completedOrders} orders completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">On-Time Delivery</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {stats.analytics.onTimeRate.toFixed(0)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Delivered on or before expected date
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Orders */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Your organization&apos;s latest orders</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent orders
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg bg-card"
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium text-foreground">{order.orderNumber || order.id.substring(0, 8).toUpperCase()}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          ${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}
                        </p>
                        <p className="text-sm text-muted-foreground">{order.orderItems?.length || 0} parts</p>
                      </div>
                      <Badge
                        variant={
                          order.status === "DELIVERED"
                            ? "default"
                            : order.status === "PROCESSING" || order.status === "IN_TRANSIT"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-xs"
                      >
                        {(order.status === "DELIVERED" || order.status === "COMPLETED") && <CheckCircle className="h-3 w-3 mr-1" />}
                        {(order.status === "PROCESSING" || order.status === "IN_TRANSIT") && <Clock className="h-3 w-3 mr-1" />}
                        {(order.status === "PENDING" || order.status === "PENDING_QUOTE") && <AlertCircle className="h-3 w-3 mr-1" />}
                        {order.status?.toLowerCase().replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization Summary */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Organization Summary</CardTitle>
            <CardDescription>Quick overview of your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Team Members</span>
              </div>
              <Badge
                variant="secondary"
                className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700"
              >
                {stats.totalUsers}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <Truck className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">Active Vehicles</span>
              </div>
              <Badge
                variant="secondary"
                className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700"
              >
                {stats.activeVehicles}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-800 dark:text-purple-200">Total Orders</span>
              </div>
              <Badge
                variant="secondary"
                className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-700"
              >
                {stats.totalOrders}
              </Badge>
            </div>

            <Button className="w-full bg-transparent" variant="outline" asChild>
              <Link href="/admin/analytics">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Analytics
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Completed Orders — Price Comparison */}
      {stats.recentCompletedOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Orders — Price Comparison</CardTitle>
            <CardDescription>Supplier prices vs manufacturer list prices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {stats.recentCompletedOrders.map((order: any) => {
                const analytics = order.orderAnalytics
                const orderSavings = analytics ? Number(analytics.actualSavings) : 0
                const orderSavingsPercent = analytics ? Number(analytics.savingsPercent) : 0
                return (
                  <div key={order.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-semibold text-foreground">{order.orderNumber}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {order.supplier?.name || 'Unknown supplier'}
                        </span>
                      </div>
                      <div className="text-right">
                        {orderSavings !== 0 ? (
                          <Badge variant={orderSavings > 0 ? "default" : "destructive"} className="text-xs">
                            {orderSavings > 0 ? 'Saved' : 'Over'} ${Math.abs(orderSavings).toFixed(2)} ({Math.abs(orderSavingsPercent).toFixed(1)}%)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">No price data</Badge>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="text-left py-1 pr-4">Part</th>
                            <th className="text-right py-1 px-2">Qty</th>
                            <th className="text-right py-1 px-2">List Price</th>
                            <th className="text-right py-1 px-2">Supplier Price</th>
                            <th className="text-right py-1 pl-2">Savings</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.orderItems.map((item: any) => {
                            const listPrice = item.part ? (Number(item.part.price) > 0 ? Number(item.part.price) : (item.part.cost ? Number(item.part.cost) : null)) : null
                            const supplierUnitPrice = Number(item.unitPrice)
                            const itemSavings = listPrice !== null ? (listPrice - supplierUnitPrice) * item.quantity : null
                            return (
                              <tr key={item.id} className="border-b border-border/50">
                                <td className="py-1.5 pr-4">
                                  <span className="font-medium text-foreground">{item.partNumber}</span>
                                  {item.part?.description && (
                                    <span className="text-xs text-muted-foreground ml-1 hidden md:inline">
                                      — {item.part.description.substring(0, 40)}{item.part.description.length > 40 ? '...' : ''}
                                    </span>
                                  )}
                                </td>
                                <td className="text-right py-1.5 px-2 text-muted-foreground">{item.quantity}</td>
                                <td className="text-right py-1.5 px-2 text-muted-foreground">
                                  {listPrice !== null ? `$${listPrice.toFixed(2)}` : '—'}
                                </td>
                                <td className="text-right py-1.5 px-2 font-medium text-foreground">
                                  ${supplierUnitPrice.toFixed(2)}
                                </td>
                                <td className={`text-right py-1.5 pl-2 font-medium ${itemSavings !== null && itemSavings > 0 ? 'text-green-600 dark:text-green-400' : itemSavings !== null && itemSavings < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                                  {itemSavings !== null ? (
                                    `${itemSavings >= 0 ? '' : '-'}$${Math.abs(itemSavings).toFixed(2)}`
                                  ) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions - Limited for Org Admins */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="h-20 flex-col bg-transparent" asChild>
              <Link href="/admin/users">
                <Users className="h-6 w-6 mb-2" />
                Manage Users
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col bg-transparent" asChild>
              <Link href="/admin/vehicles">
                <Truck className="h-6 w-6 mb-2" />
                Manage Vehicles
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col bg-transparent" asChild>
              <Link href="/admin/analytics">
                <TrendingUp className="h-6 w-6 mb-2" />
                View Analytics
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
