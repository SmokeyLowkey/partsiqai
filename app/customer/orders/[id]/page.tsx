'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { CommunicationHistory, OrderConfirmationDialog } from '@/components/quote-requests';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Calendar,
  Package,
  Truck,
  MapPin,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  RefreshCw,
  Info,
} from 'lucide-react';
import { OrderStatus } from '@prisma/client';

interface OrderItem {
  id: string;
  partId: string | null;
  partNumber: string;
  supplierPartNumber: string | null;
  isAlternative: boolean;
  alternativeReason: string | null;
  originalPartNumber: string | null;
  quantity: number;
  unitPrice: any;
  totalPrice: any;
  availability: string | null;
  supplierNotes: string | null;
  quantityReceived: number;
  receivedDate: Date | null;
  isReceived: boolean;
  part: {
    id: string;
    partNumber: string;
    description: string;
    category: string | null;
  } | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  priority: string;
  orderDate: Date;
  expectedDelivery: Date | null;
  actualDelivery: Date | null;
  subtotal: any;
  tax: any;
  shipping: any;
  total: any;
  trackingNumber: string | null;
  shippingMethod: string | null;
  shippingCarrier: string | null;
  notes: string | null;
  internalNotes: string | null;
  fulfillmentMethod: string;
  pickupLocation: string | null;
  pickupDate: Date | null;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    contactPerson: string | null;
    phone: string | null;
    rating: number | null;
  };
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number | null;
    serialNumber: string | null;
    vehicleId: string | null;
  } | null;
  orderItems: OrderItem[];
  emailThread: {
    id: string;
    externalThreadId: string | null;
    subject: string;
    status: string;
    messages: any[];
  } | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  quoteReference: {
    id: string;
    quoteNumber: string;
    status: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const orderStatusColors: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PENDING_QUOTE: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-purple-100 text-purple-800',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-orange-100 text-orange-800',
};

const orderStatusIcons: Record<OrderStatus, any> = {
  PENDING: Clock,
  PENDING_QUOTE: CheckCircle2,
  PROCESSING: Package,
  IN_TRANSIT: Truck,
  DELIVERED: CheckCircle2,
  CANCELLED: AlertCircle,
  RETURNED: AlertCircle,
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
      } else if (response.status === 404) {
        router.push('/customer/orders');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  const formatCurrency = (value: any) => {
    if (!value) return '$0.00';
    return `$${Number(value).toFixed(2)}`;
  };

  const handleItemReceivedToggle = async (itemId: string, currentQuantity: number, orderedQuantity: number) => {
    try {
      setUpdatingItem(itemId);
      
      // Toggle: if already received, mark as not received (0), otherwise mark as fully received
      const newQuantityReceived = currentQuantity > 0 ? 0 : orderedQuantity;
      
      const response = await fetch(`/api/orders/${order?.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityReceived: newQuantityReceived,
          receivedDate: newQuantityReceived > 0 ? new Date().toISOString() : null,
          isReceived: newQuantityReceived >= orderedQuantity,
        }),
      });

      if (response.ok) {
        // Refresh order data
        await fetchOrder();
      }
    } catch (error) {
      console.error('Error updating item received status:', error);
    } finally {
      setUpdatingItem(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          Loading order...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/customer/orders')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          Order not found
        </div>
      </div>
    );
  }

  const StatusIcon = orderStatusIcons[order.status];
  const totalReceived = order.orderItems.reduce(
    (sum, item) => sum + item.quantityReceived,
    0
  );
  const totalOrdered = order.orderItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/customer/orders')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Created on {formatDate(order.orderDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={orderStatusColors[order.status]}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {order.status.replace(/_/g, ' ')}
          </Badge>
          {order.priority !== 'MEDIUM' && (
            <Badge variant={order.priority === 'HIGH' ? 'destructive' : 'secondary'}>
              {order.priority} Priority
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {order.status === 'PENDING' && (() => {
        // Check if confirmation email was sent
        const confirmationSent = order.emailThread && order.emailThread.messages && 
          order.emailThread.messages.some(m => m.direction === 'OUTBOUND');
        
        // Check if any items need shipping (not IN_STOCK for pickup)
        const needsTracking = order.orderItems.some(
          item => item.availability !== 'IN_STOCK' || order.fulfillmentMethod === 'DELIVERY'
        );
        
        if (!needsTracking) {
          return (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">All Items Available for Pickup</p>
                    <p className="text-sm text-muted-foreground">
                      No tracking needed - items are available in-store at {order.supplier.name}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
        
        if (confirmationSent) {
          const lastEmail = order.emailThread?.messages?.find(m => m.direction === 'OUTBOUND');
          return (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Confirmation Sent</p>
                      <p className="text-sm text-muted-foreground">
                        Order confirmation sent to {order.supplier.name}
                        {lastEmail?.sentAt && ` on ${new Date(lastEmail.sentAt).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline"
                    onClick={() => setShowConfirmationDialog(true)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Resend
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        }
        
        return (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Send Order Confirmation</p>
                  <p className="text-sm text-muted-foreground">
                    Notify {order.supplier.name} about this order and request tracking information
                  </p>
                </div>
                <Button onClick={() => setShowConfirmationDialog(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Confirmation
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Supplier Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Supplier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium">{order.supplier.name}</p>
              {order.supplier.contactPerson && (
                <p className="text-sm text-muted-foreground">
                  {order.supplier.contactPerson}
                </p>
              )}
            </div>
            {order.supplier.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`mailto:${order.supplier.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {order.supplier.email}
                </a>
              </div>
            )}
            {order.supplier.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`tel:${order.supplier.phone}`}
                  className="text-blue-600 hover:underline"
                >
                  {order.supplier.phone}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Method</p>
              <p className="font-medium">
                {order.fulfillmentMethod === 'PICKUP' ? 'Pickup' : 'Delivery'}
              </p>
            </div>
            {order.fulfillmentMethod === 'PICKUP' && order.pickupLocation && (
              <div>
                <p className="text-sm text-muted-foreground">Pickup Location</p>
                <p className="font-medium">{order.pickupLocation}</p>
              </div>
            )}
            {order.expectedDelivery && (
              <div>
                <p className="text-sm text-muted-foreground">Expected</p>
                <p className="font-medium">{formatDate(order.expectedDelivery)}</p>
              </div>
            )}
            {order.actualDelivery && (
              <div>
                <p className="text-sm text-muted-foreground">Delivered</p>
                <p className="font-medium">{formatDate(order.actualDelivery)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tracking Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.trackingNumber ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Tracking Number</p>
                  <p className="font-medium font-mono">{order.trackingNumber}</p>
                </div>
                {order.shippingCarrier && (
                  <div>
                    <p className="text-sm text-muted-foreground">Carrier</p>
                    <p className="font-medium">{order.shippingCarrier}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                No tracking information available yet
              </div>
            )}
            {order.shippingMethod && (
              <div>
                <p className="text-sm text-muted-foreground">Shipping Method</p>
                <p className="font-medium">{order.shippingMethod}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quote Reference */}
      {order.quoteReference && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Related Quote</p>
                  <p className="text-sm text-muted-foreground">
                    This order was created from Quote #{order.quoteReference.quoteNumber}
                  </p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/customer/quote-requests/${order.quoteReference.id}`}>
                  View Quote
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicle Information */}
      {order.vehicle && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Vehicle</p>
                <p className="font-medium">
                  {order.vehicle.year} {order.vehicle.make} {order.vehicle.model}
                </p>
              </div>
              {order.vehicle.serialNumber && (
                <div>
                  <p className="text-sm text-muted-foreground">Serial Number</p>
                  <p className="font-medium font-mono">{order.vehicle.serialNumber}</p>
                </div>
              )}
              {order.vehicle.vehicleId && (
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle ID</p>
                  <p className="font-medium">{order.vehicle.vehicleId}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Order Items</CardTitle>
            <Badge variant="outline">
              {totalReceived} / {totalOrdered} Received
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Received</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Ordered</TableHead>
                <TableHead className="text-center">Received</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Availability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.orderItems.map((item) => {
                const isFullyReceived = item.quantityReceived >= item.quantity;
                
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={isFullyReceived}
                        onCheckedChange={() => handleItemReceivedToggle(item.id, item.quantityReceived, item.quantity)}
                        disabled={updatingItem === item.id}
                      />
                    </TableCell>
                    <TableCell className="font-mono">
                      <div className="flex items-center gap-2">
                        <span>{item.partNumber}</span>
                        {item.isAlternative && (
                          <Badge 
                            variant="outline" 
                            className="text-xs bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1"
                            title={`Alternative part - Original: ${item.originalPartNumber}`}
                          >
                            <RefreshCw className="h-3 w-3" />
                            Alt
                          </Badge>
                        )}
                      </div>
                      {item.isAlternative && item.originalPartNumber && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Original: {item.originalPartNumber}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{item.part?.description || '-'}</p>
                        {item.isAlternative && item.alternativeReason && (
                          <div className="flex items-start gap-1 mt-1">
                            <Info className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-blue-600">
                              {item.alternativeReason}
                            </p>
                          </div>
                        )}
                        {item.supplierNotes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.supplierNotes}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-center">
                    {item.quantityReceived > 0 ? (
                      <span className="text-green-600 font-medium">
                        {item.quantityReceived}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.totalPrice)}
                  </TableCell>
                  <TableCell>
                    {item.availability ? (
                      <Badge variant="outline" className="text-xs">
                        {item.availability}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          {/* Order Totals */}
          <div className="flex justify-end">
            <div className="space-y-2 min-w-[300px]">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.shipping && Number(order.shipping) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping:</span>
                  <span>{formatCurrency(order.shipping)}</span>
                </div>
              )}
              {order.tax && Number(order.tax) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(order.notes || order.internalNotes) && (
        <div className="grid gap-6 md:grid-cols-2">
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}
          {order.internalNotes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {order.internalNotes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Communication History */}
      {order.emailThread && (
        <Card>
          <CardHeader>
            <CardTitle>Communication History</CardTitle>
            <CardDescription>
              Email correspondence with {order.supplier.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CommunicationHistory
              emailThreads={[{
                id: 'order-thread',
                supplierId: order.supplier.id,
                supplier: order.supplier,
                emailThread: order.emailThread,
                status: 'RESPONDED',
                responseDate: new Date(),
                quotedAmount: null,
                isPrimary: true,
              }]}
              quoteRequestId={order.quoteReference?.id || ''}
              onRefresh={fetchOrder}
            />
          </CardContent>
        </Card>
      )}

      {/* Order Confirmation Dialog */}
      {showConfirmationDialog && (
        <OrderConfirmationDialog
          open={showConfirmationDialog}
          onOpenChange={setShowConfirmationDialog}
          orderId={order.id}
          orderNumber={order.orderNumber}
          supplierId={order.supplier.id}
          supplierName={order.supplier.name}
          supplierEmail={order.supplier.email}
          onSent={() => {
            fetchOrder();
          }}
        />
      )}
    </div>
  );
}
