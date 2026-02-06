'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Package,
  DollarSign,
  Truck,
  Clock,
  Building2,
  Star,
  CheckCircle,
  AlertTriangle,
  Plus,
  Minus,
  FileText,
  RefreshCw,
  MapPin,
  Wrench,
  Info,
} from 'lucide-react';

interface Supplier {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierType: string;
  supplierPartNumber: string | null;
  price: number;
  leadTime: number | null;
  minOrderQuantity: number;
  isPreferred: boolean;
  rating: number | null;
  deliveryRating: number | null;
  qualityRating: number | null;
  avgDeliveryTime: number | null;
  email: string | null;
  phone: string | null;
}

interface RelatedVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  vehicleId: string;
}

interface MaintenanceInterval {
  id: string;
  intervalHours: number;
  intervalType: string;
  serviceName: string;
  category: string | null;
  quantity: number;
}

interface Part {
  id: string;
  partNumber: string;
  description: string;
  category: string | null;
  subcategory: string | null;
  price: number;
  cost: number | null;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel: number | null;
  availability: string;
  weight: number | null;
  dimensions: any;
  location: string | null;
  compatibility: any;
  specifications: any;
  isObsolete: boolean;
  supersededBy: string | null;
  supersedes: string | null;
  supersessionDate: string | null;
  supersessionNotes: string | null;
  supplierPartNumber: string | null;
  bestPrice: {
    price: number;
    supplierId: string;
    supplierName: string;
    leadTime: number | null;
    minOrderQuantity: number;
  } | null;
  suppliers: Supplier[];
  relatedVehicles: RelatedVehicle[];
  maintenanceIntervals: MaintenanceInterval[];
  createdAt: string;
  updatedAt: string;
}

export default function PartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: partId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [part, setPart] = useState<Part | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);

  useEffect(() => {
    loadPartData();
  }, [partId]);

  const loadPartData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/catalog/parts/${partId}`);
      if (response.ok) {
        const data = await response.json();
        setPart(data.part);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Part not found',
        });
        router.push('/customer/catalog');
      }
    } catch (error) {
      console.error('Error loading part:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load part details',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateQuote = async () => {
    if (!part) return;

    setIsCreatingQuote(true);
    try {
      const response = await fetch('/api/catalog/picklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              partId: part.id,
              quantity,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Quote Created',
          description: `Quote ${data.quoteRequest.quoteNumber} created`,
        });
        router.push(`/customer/quote-requests/${data.quoteRequest.id}`);
      } else {
        const errorData = await response.json();
        toast({
          variant: 'destructive',
          title: 'Failed to Create Quote',
          description: errorData.error || 'Failed to create quote request',
        });
      }
    } catch (error) {
      console.error('Error creating quote:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create quote request',
      });
    } finally {
      setIsCreatingQuote(false);
    }
  };

  const getAvailabilityBadge = (availability: string) => {
    switch (availability) {
      case 'In Stock':
        return <Badge className="bg-green-600 text-white">{availability}</Badge>;
      case 'Limited Stock':
        return <Badge className="bg-yellow-600 text-white">{availability}</Badge>;
      default:
        return <Badge variant="secondary">{availability}</Badge>;
    }
  };

  const getSupplierTypeBadge = (type: string) => {
    switch (type) {
      case 'OEM_DIRECT':
        return <Badge variant="default">OEM Direct</Badge>;
      case 'DISTRIBUTOR':
        return <Badge variant="secondary">Distributor</Badge>;
      case 'AFTERMARKET':
        return <Badge variant="outline">Aftermarket</Badge>;
      case 'LOCAL_DEALER':
        return <Badge variant="secondary">Local Dealer</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!part) {
    return null;
  }

  const totalPrice = (part.bestPrice?.price || part.price) * quantity;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/customer/catalog')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Catalog
        </Button>
      </div>

      {/* Part Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{part.partNumber}</h1>
          <p className="text-lg text-muted-foreground">{part.description}</p>
          {part.category && (
            <p className="text-sm text-muted-foreground mt-1">
              {part.category}
              {part.subcategory && ` > ${part.subcategory}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {getAvailabilityBadge(part.availability)}
          {part.isObsolete && (
            <Badge variant="destructive">Obsolete</Badge>
          )}
        </div>
      </div>

      {/* Supersession Warning */}
      {part.supersededBy && (
        <Card className="border-yellow-500 bg-yellow-950/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-medium text-yellow-500">Part Superseded</p>
                <p className="text-sm text-muted-foreground">
                  This part has been replaced by <strong>{part.supersededBy}</strong>
                  {part.supersessionNotes && ` - ${part.supersessionNotes}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Price & Order Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing & Order
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  {part.bestPrice ? (
                    <>
                      <p className="text-3xl font-bold text-green-600">
                        ${part.bestPrice.price.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Best price via {part.bestPrice.supplierName}
                      </p>
                      {part.bestPrice.leadTime && (
                        <p className="text-sm text-muted-foreground">
                          Lead time: {part.bestPrice.leadTime} days
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-3xl font-bold text-foreground">
                      ${part.price.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Stock Quantity</p>
                  <p className="text-2xl font-bold">{part.stockQuantity}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="quantity">Quantity:</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold text-green-600">
                    ${totalPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
                onClick={handleCreateQuote}
                disabled={isCreatingQuote}
              >
                {isCreatingQuote ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating Quote...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Create Quote Request
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Suppliers */}
          {part.suppliers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Available Suppliers ({part.suppliers.length})
                </CardTitle>
                <CardDescription>
                  Compare prices and lead times across suppliers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Lead Time</TableHead>
                      <TableHead className="text-right">Min Order</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {part.suppliers.map((supplier, index) => (
                      <TableRow key={supplier.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{supplier.supplierName}</span>
                            {supplier.isPreferred && (
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            )}
                            {index === 0 && (
                              <Badge className="bg-green-600 text-white text-xs">Best</Badge>
                            )}
                          </div>
                          {supplier.supplierPartNumber && (
                            <p className="text-xs text-muted-foreground">
                              #{supplier.supplierPartNumber}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{getSupplierTypeBadge(supplier.supplierType)}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${supplier.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {supplier.leadTime ? `${supplier.leadTime} days` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {supplier.minOrderQuantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {supplier.rating ? (
                            <div className="flex items-center justify-end gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              <span>{Number(supplier.rating).toFixed(1)}</span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Specifications */}
          {(part.specifications || part.dimensions || part.weight) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Specifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {part.weight && (
                    <div>
                      <Label className="text-muted-foreground">Weight</Label>
                      <p className="font-medium">{part.weight} lbs</p>
                    </div>
                  )}
                  {part.dimensions && (
                    <div>
                      <Label className="text-muted-foreground">Dimensions</Label>
                      <p className="font-medium">
                        {typeof part.dimensions === 'string'
                          ? part.dimensions
                          : JSON.stringify(part.dimensions)}
                      </p>
                    </div>
                  )}
                  {part.location && (
                    <div>
                      <Label className="text-muted-foreground">Warehouse Location</Label>
                      <p className="font-medium flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {part.location}
                      </p>
                    </div>
                  )}
                  {part.specifications &&
                    typeof part.specifications === 'object' &&
                    Object.entries(part.specifications).map(([key, value]) => (
                      <div key={key}>
                        <Label className="text-muted-foreground capitalize">
                          {key.replace(/_/g, ' ')}
                        </Label>
                        <p className="font-medium">{String(value)}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stock Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Stock</span>
                <span className="font-medium">{part.stockQuantity}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Min Stock Level</span>
                <span className="font-medium">{part.minStockLevel}</span>
              </div>
              {part.maxStockLevel && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Max Stock Level</span>
                  <span className="font-medium">{part.maxStockLevel}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {getAvailabilityBadge(part.availability)}
              </div>
            </CardContent>
          </Card>

          {/* Related Vehicles */}
          {part.relatedVehicles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Compatible Vehicles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {part.relatedVehicles.map((vehicle) => (
                    <Button
                      key={vehicle.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => router.push(`/customer/vehicles/${vehicle.id}`)}
                    >
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Maintenance Intervals */}
          {part.maintenanceIntervals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Used In Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  {part.maintenanceIntervals.map((interval) => (
                    <AccordionItem key={interval.id} value={interval.id}>
                      <AccordionTrigger className="text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {interval.intervalHours > 0
                            ? `${interval.intervalHours} ${interval.intervalType.toLowerCase()}`
                            : 'As Required'}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">{interval.serviceName}</p>
                          {interval.category && (
                            <p className="text-muted-foreground">
                              Category: {interval.category}
                            </p>
                          )}
                          <p className="text-muted-foreground">
                            Quantity needed: {interval.quantity}
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* Compatibility Info */}
          {part.compatibility && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Compatibility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {typeof part.compatibility === 'string'
                    ? part.compatibility
                    : JSON.stringify(part.compatibility, null, 2)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
