import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Plus, Eye, CheckCircle, Clock, AlertCircle, Package, Truck } from "lucide-react"
import { getServerSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { OrderStatus } from "@prisma/client"

export default async function OrdersPage() {
  const session = await getServerSession();
  
  if (!session?.user) {
    redirect('/login');
  }

  // Fetch real orders from database
  const orders = await prisma.order.findMany({
    where: {
      organizationId: session.user.organizationId,
    },
    include: {
      supplier: true,
      orderItems: {
        include: {
          part: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate summary stats
  const stats = {
    pendingQuote: orders.filter(o => o.status === 'PENDING_QUOTE').length,
    processing: orders.filter(o => o.status === 'PROCESSING').length,
    inTransit: orders.filter(o => o.status === 'IN_TRANSIT').length,
    delivered: orders.filter(o => o.status === 'DELIVERED').length,
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case "PENDING_QUOTE":
      case "PENDING":
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      case "PROCESSING":
        return <Clock className="h-4 w-4 text-blue-500" />
      case "IN_TRANSIT":
        return <Truck className="h-4 w-4 text-purple-500" />
      case "DELIVERED":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "CANCELLED":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Package className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "PENDING_QUOTE":
      case "PENDING":
        return "bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800"
      case "PROCESSING":
        return "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800"
      case "IN_TRANSIT":
        return "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800"
      case "DELIVERED":
        return "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800"
      case "CANCELLED":
        return "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const getStatusLabel = (status: OrderStatus) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage your parts orders and track deliveries</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search orders..." className="pl-10" />
              </div>
            </div>
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                <SelectItem value="agriparts">AgriParts Direct</SelectItem>
                <SelectItem value="johndeere">John Deere Parts</SelectItem>
                <SelectItem value="farmtech">FarmTech Supply</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.length > 0 ? (
          orders.map((order) => (
            <Card key={order.id} className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-foreground">{order.orderNumber}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Ordered on {new Date(order.orderDate).toLocaleDateString()} • {order.supplier.name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusIcon(order.status)}
                      <span className="ml-1">{getStatusLabel(order.status)}</span>
                    </Badge>
                    <Link href={`/customer/orders/${order.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* Parts List */}
                  <div>
                    <h4 className="font-medium mb-2 text-foreground">Parts Ordered</h4>
                    <div className="space-y-1">
                      {order.orderItems.slice(0, 3).map((item) => (
                        <div key={item.id} className="text-sm">
                          <p className="font-medium text-foreground">
                            {item.part?.description || item.partNumber}
                          </p>
                          <p className="text-muted-foreground">
                            {item.partNumber} • Qty: {item.quantity}
                          </p>
                        </div>
                      ))}
                      {order.orderItems.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{order.orderItems.length - 3} more items
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Fulfillment Info */}
                  <div>
                    <h4 className="font-medium mb-2 text-foreground">Fulfillment</h4>
                    <div className="p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-xs">
                      <p className="text-blue-800 dark:text-blue-200">
                        {order.fulfillmentMethod === 'PICKUP' ? '🏪 Store Pickup' : 
                         order.fulfillmentMethod === 'DELIVERY' ? '🚚 Delivery' : 
                         '📦 Split Fulfillment'}
                      </p>
                      {order.pickupLocation && (
                        <p className="text-blue-700 dark:text-blue-300 mt-1">
                          {order.pickupLocation}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Order Details */}
                  <div>
                    <h4 className="font-medium mb-2 text-foreground">Order Details</h4>
                    <div className="space-y-1 text-sm text-foreground">
                      <p>
                        <strong>Total:</strong> ${Number(order.total).toFixed(2)}
                      </p>
                      {order.expectedDelivery && (
                        <p>
                          <strong>Expected:</strong> {new Date(order.expectedDelivery).toLocaleDateString()}
                        </p>
                      )}
                      {order.trackingNumber && (
                        <p>
                          <strong>Tracking:</strong> {order.trackingNumber}
                        </p>
                      )}
                      {order.actualDelivery && (
                        <p>
                          <strong>Delivered:</strong> {new Date(order.actualDelivery).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {order.status === "PENDING_QUOTE" && (
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Link href={`/customer/orders/${order.id}`}>
                      <Button size="sm">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Review Quote
                      </Button>
                    </Link>
                  </div>
                )}

                {order.status === "IN_TRANSIT" && order.trackingNumber && (
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button size="sm" variant="outline">
                      <Truck className="h-4 w-4 mr-1" />
                      Track Package
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No orders yet</p>
              <Link href="/customer/quote-requests">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quote Request
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Quote</p>
                <p className="text-2xl font-bold">{stats.pendingQuote}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold">{stats.processing}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Transit</p>
                <p className="text-2xl font-bold">{stats.inTransit}</p>
              </div>
              <Truck className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold">{stats.delivered}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
