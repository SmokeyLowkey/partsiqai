'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Package,
  ShoppingCart,
  Wrench,
} from 'lucide-react';

interface UpcomingService {
  intervalId: string;
  serviceName: string;
  serviceDescription: string | null;
  category: string | null;
  atHours: number;
  hoursRemaining: number;
  intervalHours: number;
  isUrgent: boolean;
  isOverdue: boolean;
}

interface Part {
  id: string;
  partNumber: string;
  description: string | null;
  quantity: number;
  matchedPartId: string | null;
  matchedPart: {
    id: string;
    partNumber: string;
    description: string;
    stockQuantity: number;
    price: number;
  } | null;
  bestPrice: {
    price: number;
    supplierName: string;
    supplierId: string;
    leadTime: number | null;
  } | null;
}

interface Props {
  vehicleId: string;
  onAddToQuote?: (parts: Part[]) => void;
}

export function UpcomingServiceCard({ vehicleId, onAddToQuote }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingService, setUpcomingService] = useState<UpcomingService | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [estimatedTotal, setEstimatedTotal] = useState<number>(0);
  const [currentHours, setCurrentHours] = useState<number>(0);
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadUpcomingParts();
  }, [vehicleId]);

  const loadUpcomingParts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/vehicles/${vehicleId}/upcoming-parts`);
      const data = await response.json();

      if (response.ok) {
        setUpcomingService(data.upcomingService);
        setParts(data.parts || []);
        setEstimatedTotal(data.estimatedTotal || 0);
        setCurrentHours(data.currentOperatingHours || 0);
        setMessage(data.message || null);
        setScheduleStatus(data.scheduleStatus || null);
      } else {
        setError(data.error || 'Failed to load upcoming parts');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading upcoming maintenance...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show status message if schedule is not approved
  if (scheduleStatus && scheduleStatus !== 'APPROVED') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Upcoming Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-yellow-600">
            <Clock className="h-4 w-4" />
            <span>{message || `Maintenance schedule is ${scheduleStatus.toLowerCase().replace('_', ' ')}`}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!upcomingService) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Upcoming Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{message || 'No upcoming maintenance at this time.'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={upcomingService.isOverdue ? 'border-red-300' : upcomingService.isUrgent ? 'border-yellow-300' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {upcomingService.serviceName}
            </CardTitle>
            <CardDescription>
              {upcomingService.serviceDescription || `Service every ${upcomingService.intervalHours} hours`}
            </CardDescription>
          </div>
          <div className="text-right">
            {upcomingService.isOverdue ? (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            ) : upcomingService.isUrgent ? (
              <Badge variant="default" className="bg-yellow-500">
                <Clock className="h-3 w-3 mr-1" />
                Due Soon
              </Badge>
            ) : (
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                Upcoming
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Hours Info */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Current Hours</p>
            <p className="text-xl font-bold">{currentHours.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Service At</p>
            <p className="text-xl font-bold">{upcomingService.atHours.toLocaleString()}</p>
          </div>
          <div className={`p-3 rounded-lg ${upcomingService.isOverdue ? 'bg-red-100' : upcomingService.isUrgent ? 'bg-yellow-100' : 'bg-green-100'}`}>
            <p className="text-sm text-muted-foreground">
              {upcomingService.isOverdue ? 'Overdue By' : 'Hours Remaining'}
            </p>
            <p className="text-xl font-bold">
              {Math.abs(upcomingService.hoursRemaining).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Parts Table */}
        {parts.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Parts Needed ({parts.length})
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Est. Price</TableHead>
                  <TableHead>Supplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell className="font-mono">{part.partNumber}</TableCell>
                    <TableCell>{part.description || part.matchedPart?.description || '-'}</TableCell>
                    <TableCell className="text-center">{part.quantity}</TableCell>
                    <TableCell className="text-right">
                      {part.bestPrice
                        ? `$${(part.bestPrice.price * part.quantity).toFixed(2)}`
                        : part.matchedPart
                        ? `$${(part.matchedPart.price * part.quantity).toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {part.bestPrice ? (
                        <span className="text-sm">
                          {part.bestPrice.supplierName}
                          {part.bestPrice.leadTime && (
                            <span className="text-muted-foreground"> ({part.bestPrice.leadTime}d)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Total and Action */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground">Estimated Total</p>
            <p className="text-2xl font-bold">${estimatedTotal.toFixed(2)}</p>
          </div>
          {onAddToQuote && parts.length > 0 && (
            <Button onClick={() => onAddToQuote(parts)}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add to Quote Request
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
