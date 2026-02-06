import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bot, ShoppingCart, MessageSquare, Package, Clock, CheckCircle, AlertCircle, Sparkles, UserCheck, PiggyBank, TrendingDown, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getServerSession, canApproveQuotes } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getOrganizationCostSavings } from "@/lib/services/cost-savings"

export default async function CustomerDashboardPage() {
  const session = await getServerSession();
  
  if (!session?.user) {
    redirect('/login');
  }

  const userCanApprove = canApproveQuotes(session.user.role);

  // Calculate start of current month for filtering
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Fetch real data
  const [orders, quoteRequests, pendingApprovals, chatConversations, monthlyConversations, costSavings, quoteStats] = await Promise.all([
    prisma.order.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        supplier: true,
        orderItems: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.quoteRequest.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: { in: ['SENT', 'RECEIVED', 'UNDER_REVIEW'] },
      },
      include: {
        supplier: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // Fetch pending approvals for managers
    userCanApprove ? prisma.quoteRequest.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: 'UNDER_REVIEW',
      },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
        items: true,
        vehicle: {
          select: { make: true, model: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }) : Promise.resolve([]),
    // Recent conversations for display
    prisma.chatConversation.findMany({
      where: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 4,
    }),
    // Count conversations this month
    prisma.chatConversation.count({
      where: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        lastMessageAt: { gte: startOfMonth },
      },
    }),
    // Get organization cost savings
    getOrganizationCostSavings(session.user.organizationId, { months: 12 }),
    // Get quote stats for conversion rate calculation
    prisma.quoteRequest.groupBy({
      by: ['status'],
      where: {
        organizationId: session.user.organizationId,
      },
      _count: { status: true },
    }),
  ]);

  // Calculate stats
  const activeOrders = orders.filter(o => ['PENDING', 'PROCESSING', 'IN_TRANSIT'].includes(o.status));
  const pendingApprovalOrders = orders.filter(o => o.status === 'PENDING_QUOTE');
  const totalInteractions = monthlyConversations; // Now properly filtered to this month
  const totalParts = orders.reduce((sum, order) => sum + order.orderItems.length, 0);
  const unreadMessages = quoteRequests.filter(q => q.status === 'RECEIVED').length;

  // Calculate quote conversion rate (real metric instead of hardcoded)
  const totalQuotes = quoteStats.reduce((sum, s) => sum + s._count.status, 0);
  const convertedQuotes = quoteStats.find(s => s.status === 'CONVERTED_TO_ORDER')?._count.status || 0;
  const quoteConversionRate = totalQuotes > 0 ? ((convertedQuotes / totalQuotes) * 100).toFixed(0) : '0';
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center text-foreground">
            <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
            Welcome to PartsIQ AI
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Your intelligent machinery parts ordering assistant is ready to help you find and order the right parts
            quickly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/customer/ai-chat">
              <Button className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white">
                <Bot className="h-4 w-4 mr-2" />
                Start AI Chat
              </Button>
            </Link>
            <Link href="/customer/orders">
              <Button
                variant="outline"
                className="border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950 bg-transparent"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                View Orders
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Active Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{activeOrders.length}</div>
            <p className="text-xs text-muted-foreground">{pendingApprovalOrders.length} pending approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Interactions</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInteractions}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parts Ordered</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParts}</div>
            <p className="text-xs text-muted-foreground">Across all orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Quotes</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quoteRequests.length}</div>
            <p className="text-xs text-muted-foreground">{unreadMessages} new responses</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Savings Card */}
      {costSavings.totalSavings > 0 && (
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center text-foreground">
                  <PiggyBank className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                  Your Cost Savings
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Savings compared to OEM/List prices
                </CardDescription>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {costSavings.overallSavingsPercent.toFixed(0)}% saved
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  ${costSavings.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">Total Saved</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  ${costSavings.totalManualCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">OEM Cost (Avoided)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  ${costSavings.totalPlatformCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">Actual Cost</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {costSavings.totalOrdersProcessed}
                </p>
                <p className="text-xs text-muted-foreground">Orders Tracked</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
              <Link href="/customer/cost-savings">
                <Button variant="outline" className="w-full border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900">
                  View Detailed Savings
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Approvals Section for Managers */}
      {userCanApprove && pendingApprovals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center text-foreground">
                  <UserCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2" />
                  Pending Approvals
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Quote requests waiting for your review
                </CardDescription>
              </div>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {pendingApprovals.length} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingApprovals.map((quote) => (
                <Link key={quote.id} href={`/customer/quote-requests/${quote.id}`}>
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:bg-accent cursor-pointer transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          Quote #{quote.quoteNumber}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {quote.items.length} items
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Requested by {quote.createdBy.name || quote.createdBy.email}
                      </p>
                      {quote.vehicle && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {quote.vehicle.make} {quote.vehicle.model}
                        </p>
                      )}
                      {quote.totalAmount && (
                        <p className="text-sm font-medium text-foreground mt-2">
                          ${Number(quote.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Review
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(quote.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/customer/quote-requests?status=UNDER_REVIEW">
              <Button variant="outline" className="w-full mt-4">
                View All Pending Approvals
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent AI Interactions */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent AI Interactions</CardTitle>
            <CardDescription>Your latest conversations with the AI assistant</CardDescription>
          </CardHeader>
          <CardContent>
            {chatConversations.length > 0 ? (
              <div className="space-y-4">
                {chatConversations.map((conversation) => (
                  <Link key={conversation.id} href={`/customer/ai-chat?conversation=${conversation.id}`}>
                    <div className="flex items-start justify-between p-3 border border-border rounded-lg bg-card hover:bg-accent cursor-pointer transition-colors">
                      <div className="flex items-start space-x-3">
                        <Bot className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm text-foreground">
                            {conversation.title || `Conversation ${conversation.id.slice(0, 8)}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {conversation.messageCount} messages
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(conversation.lastMessageAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={conversation.isActive ? "default" : "outline"}
                        className="text-xs"
                      >
                        {conversation.isActive ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          'Completed'
                        )}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No AI interactions yet</p>
                <Link href="/customer/ai-chat">
                  <Button className="mt-3" size="sm">
                    Start Your First Chat
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/customer/ai-chat">
              <Button className="w-full justify-start bg-transparent" variant="outline">
                <Bot className="h-4 w-4 mr-2" />
                Ask AI Assistant
              </Button>
            </Link>

            <Link href="/customer/orders">
              <Button className="w-full justify-start bg-transparent" variant="outline">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Create New Order
              </Button>
            </Link>

            <Link href="/customer/catalog">
              <Button className="w-full justify-start bg-transparent" variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Browse Parts Catalog
              </Button>
            </Link>

            <Link href="/customer/communications">
              <Button className="w-full justify-start bg-transparent" variant="outline">
                <MessageSquare className="h-4 w-4 mr-2" />
                Check Messages
              </Button>
            </Link>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Performance Metrics</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Quote Conversion</span>
                  <span className="text-green-600 font-medium">{quoteConversionRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>AI Chats This Month</span>
                  <span className="text-green-600 font-medium">{totalInteractions}</span>
                </div>
                {costSavings.totalSavings > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Savings Rate</span>
                    <span className="text-green-600 font-medium">{costSavings.overallSavingsPercent.toFixed(0)}%</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>Orders and quotes waiting for your approval</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingApprovalOrders.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingApprovalOrders.slice(0, 3).map((order) => (
                <Card key={order.id} className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-foreground">{order.orderNumber}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {order.orderItems.length} item{order.orderItems.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-foreground">
                      <p>
                        <strong>Supplier:</strong> {order.supplier.name}
                      </p>
                      <p>
                        <strong>Amount:</strong> ${Number(order.total).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/customer/orders/${order.id}`} className="flex-1">
                        <Button size="sm" className="w-full">
                          Review
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No pending approvals</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
