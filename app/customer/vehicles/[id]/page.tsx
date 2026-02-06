'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Truck,
  Clock,
  Activity,
  FileText,
  Wrench,
  Package,
  AlertTriangle,
  CheckCircle,
  ShoppingCart,
  RefreshCw,
} from 'lucide-react';

interface Vehicle {
  id: string;
  vehicleId: string;
  serialNumber: string;
  make: string;
  model: string;
  year: number;
  type: string;
  industryCategory: string;
  status: string;
  currentLocation?: string;
  operatingHours: number;
  healthScore: number;
  engineModel?: string;
  maintenancePdfFileName?: string;
  maintenancePdfUrl?: string;
}

interface MaintenanceSchedule {
  id: string;
  parsingStatus: string;
  approvalStatus: string;
  oem?: string;
  extractionConfidence?: number;
  parsedAt?: string;
  intervals: MaintenanceInterval[];
}

interface MaintenanceInterval {
  id: string;
  intervalHours: number;
  intervalType: string;
  serviceName: string;
  serviceDescription?: string;
  category?: string;
  requiredParts: MaintenancePart[];
}

interface MaintenancePart {
  id: string;
  partNumber: string;
  partDescription?: string;
  quantity: number;
  matchedPartId?: string;
}

interface UpcomingService {
  intervalId: string;
  serviceName: string;
  serviceDescription?: string;
  category?: string;
  atHours: number;
  hoursRemaining: number;
  intervalHours: number;
  isUrgent: boolean;
  isOverdue: boolean;
}

interface UpcomingPart {
  id: string;
  partNumber: string;
  description?: string;
  quantity: number;
  matchedPartId?: string;
  matchedPart?: {
    id: string;
    partNumber: string;
    description: string;
    stockQuantity: number;
    price: number;
  };
  bestPrice?: {
    price: number;
    supplierName: string;
    supplierId: string;
    leadTime?: string;
  };
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: vehicleId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [upcomingService, setUpcomingService] = useState<UpcomingService | null>(null);
  const [upcomingParts, setUpcomingParts] = useState<UpcomingPart[]>([]);
  const [estimatedTotal, setEstimatedTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleMessage, setScheduleMessage] = useState<string>('');

  // Update hours modal
  const [isUpdateHoursOpen, setIsUpdateHoursOpen] = useState(false);
  const [newHours, setNewHours] = useState<number>(0);
  const [isUpdatingHours, setIsUpdatingHours] = useState(false);

  // Quote creation
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);

  useEffect(() => {
    loadVehicleData();
  }, [vehicleId]);

  const loadVehicleData = async () => {
    setIsLoading(true);
    try {
      // Load vehicle details
      const vehicleRes = await fetch(`/api/vehicles/${vehicleId}`);
      if (!vehicleRes.ok) {
        toast({ variant: 'destructive', title: 'Error', description: 'Vehicle not found' });
        router.push('/customer/vehicles');
        return;
      }
      const vehicleData = await vehicleRes.json();
      setVehicle(vehicleData.vehicle);
      setNewHours(vehicleData.vehicle.operatingHours);

      // Load maintenance schedule
      const scheduleRes = await fetch(`/api/vehicles/${vehicleId}/maintenance-schedule`);
      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json();
        setSchedule(scheduleData.schedule);
        if (scheduleData.message) {
          setScheduleMessage(scheduleData.message);
        }
      }

      // Load upcoming parts
      const partsRes = await fetch(`/api/vehicles/${vehicleId}/upcoming-parts`);
      if (partsRes.ok) {
        const partsData = await partsRes.json();
        setUpcomingService(partsData.upcomingService);
        setUpcomingParts(partsData.parts || []);
        setEstimatedTotal(partsData.estimatedTotal || 0);
        if (partsData.message && !scheduleMessage) {
          setScheduleMessage(partsData.message);
        }
      }
    } catch (error) {
      console.error('Error loading vehicle data:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load vehicle data' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateHours = async () => {
    if (!vehicle) return;

    setIsUpdatingHours(true);
    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatingHours: newHours }),
      });

      if (response.ok) {
        setVehicle({ ...vehicle, operatingHours: newHours });
        toast({
          title: 'Hours Updated',
          description: `Operating hours updated to ${newHours.toLocaleString()}`,
        });
        setIsUpdateHoursOpen(false);
        // Reload upcoming parts with new hours
        loadVehicleData();
      } else {
        const errorData = await response.json();
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: errorData.error || 'Failed to update hours',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update operating hours',
      });
    } finally {
      setIsUpdatingHours(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!vehicle) return;
    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}/pdf-url`);
      if (response.ok) {
        const data = await response.json();
        window.open(data.url, '_blank');
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to get PDF' });
    }
  };

  const handleCreateQuote = async () => {
    if (!vehicle || !upcomingService || upcomingParts.length === 0) return;

    setIsCreatingQuote(true);
    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}/create-maintenance-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervalId: upcomingService.intervalId,
          serviceName: upcomingService.serviceName,
          parts: upcomingParts.map((part) => ({
            partNumber: part.partNumber,
            description: part.description || part.matchedPart?.description,
            quantity: part.quantity,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Quote Created',
          description: `Quote ${data.quoteRequest.quoteNumber} created with ${upcomingParts.length} parts`,
        });
        // Navigate to the quote requests page
        router.push(`/customer/quote-requests`);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-600 text-white">Approved</Badge>;
      case 'PENDING_REVIEW':
        return <Badge className="bg-yellow-600 text-white">Pending Review</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-600 text-white">Rejected</Badge>;
      case 'NEEDS_CORRECTION':
        return <Badge className="bg-orange-600 text-white">Needs Correction</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vehicle) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/customer/vehicles')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Vehicles
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h1>
          <p className="text-muted-foreground">
            {vehicle.vehicleId} • {vehicle.serialNumber}
          </p>
        </div>
        <Badge variant={vehicle.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {vehicle.status}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operating Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicle.operatingHours.toLocaleString()}</div>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs"
              onClick={() => setIsUpdateHoursOpen(true)}
            >
              Update Hours
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              vehicle.healthScore >= 90 ? 'text-green-600' :
              vehicle.healthScore >= 70 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {vehicle.healthScore}%
            </div>
            <p className="text-xs text-muted-foreground">
              {vehicle.healthScore >= 90 ? 'Excellent' :
               vehicle.healthScore >= 70 ? 'Good' : 'Needs Attention'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schedule Status</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {schedule ? (
              <>
                {getStatusBadge(schedule.approvalStatus)}
                <p className="text-xs text-muted-foreground mt-1">
                  {schedule.intervals?.length || 0} intervals
                </p>
              </>
            ) : (
              <>
                <Badge variant="outline">Not Set Up</Badge>
                <p className="text-xs text-muted-foreground mt-1">Upload PDF</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Service</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingService ? (
              <>
                <div className={`text-2xl font-bold ${
                  upcomingService.isOverdue ? 'text-red-600' :
                  upcomingService.isUrgent ? 'text-yellow-600' : 'text-foreground'
                }`}>
                  {upcomingService.isOverdue ? 'OVERDUE' :
                   `${upcomingService.hoursRemaining.toLocaleString()} hrs`}
                </div>
                <p className="text-xs text-muted-foreground">
                  @ {upcomingService.atHours.toLocaleString()} hrs
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">--</div>
                <p className="text-xs text-muted-foreground">No schedule</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Service & Parts */}
      {upcomingService && schedule?.approvalStatus === 'APPROVED' && (
        <Card className={upcomingService.isOverdue ? 'border-red-500 bg-red-950/50' :
                        upcomingService.isUrgent ? 'border-yellow-500 bg-yellow-950/50' : 'border-green-500/50'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  {upcomingService.isOverdue ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : upcomingService.isUrgent ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Wrench className="h-5 w-5 text-green-500" />
                  )}
                  {upcomingService.serviceName}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {upcomingService.serviceDescription || `Service due at ${upcomingService.atHours.toLocaleString()} hours`}
                </CardDescription>
              </div>
              {upcomingService.category && (
                <Badge variant="secondary" className="bg-secondary text-secondary-foreground">{upcomingService.category}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Service Interval</span>
                <span className="font-medium text-foreground">Every {upcomingService.intervalHours.toLocaleString()} hours</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Hours</span>
                <span className="font-medium text-foreground">{vehicle.operatingHours.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Due At</span>
                <span className="font-medium text-foreground">{upcomingService.atHours.toLocaleString()} hours</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Hours Remaining</span>
                <span className={`font-bold ${
                  upcomingService.isOverdue ? 'text-red-500' :
                  upcomingService.isUrgent ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {upcomingService.isOverdue
                    ? `${Math.abs(upcomingService.hoursRemaining).toLocaleString()} OVERDUE`
                    : upcomingService.hoursRemaining.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parts Needed */}
      {upcomingParts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Parts Needed for Service
            </CardTitle>
            <CardDescription>
              {upcomingParts.length} part{upcomingParts.length !== 1 ? 's' : ''} required for upcoming maintenance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingParts.map((part) => (
                <div
                  key={part.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{part.partNumber}</div>
                    <div className="text-sm text-muted-foreground">
                      {part.description || part.matchedPart?.description || 'No description'}
                    </div>
                    <div className="text-xs text-muted-foreground">Qty: {part.quantity}</div>
                  </div>
                  <div className="text-right">
                    {part.bestPrice ? (
                      <>
                        <div className="font-bold text-green-600">
                          ${(part.bestPrice.price * part.quantity).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {part.bestPrice.supplierName}
                        </div>
                      </>
                    ) : part.matchedPart ? (
                      <>
                        <div className="font-bold">
                          ${(part.matchedPart.price * part.quantity).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          In stock: {part.matchedPart.stockQuantity}
                        </div>
                      </>
                    ) : (
                      <Badge variant="outline">Not in catalog</Badge>
                    )}
                  </div>
                </div>
              ))}

              {estimatedTotal > 0 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="font-medium">Estimated Total</span>
                  <span className="text-xl font-bold text-green-600">
                    ${estimatedTotal.toFixed(2)}
                  </span>
                </div>
              )}

              <Button
                className="w-full mt-4 bg-green-600 hover:bg-green-700"
                onClick={handleCreateQuote}
                disabled={isCreatingQuote || upcomingParts.length === 0}
              >
                {isCreatingQuote ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating Quote...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Create Quote Request ({upcomingParts.length} parts)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Info Message */}
      {scheduleMessage && !upcomingService && (
        <Card>
          <CardContent className="py-8 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Maintenance Schedule</h3>
            <p className="text-muted-foreground mb-4">{scheduleMessage}</p>
            {!vehicle.maintenancePdfFileName && (
              <Button
                variant="outline"
                onClick={() => router.push('/customer/vehicles')}
              >
                Upload Maintenance PDF
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Full Schedule View */}
      {schedule?.approvalStatus === 'APPROVED' && schedule.intervals && schedule.intervals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Full Maintenance Schedule</CardTitle>
            <CardDescription>
              {schedule.oem && `OEM: ${schedule.oem} • `}
              {schedule.intervals.length} service interval{schedule.intervals.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {schedule.intervals.map((interval) => {
                // Handle "As Required" intervals where intervalHours is 0
                const isAsRequired = interval.intervalHours === 0;
                const completedCycles = isAsRequired ? 0 : Math.floor(vehicle.operatingHours / interval.intervalHours);
                const nextServiceAt = isAsRequired ? null : (completedCycles + 1) * interval.intervalHours;
                const hoursUntil = isAsRequired || nextServiceAt === null ? null : nextServiceAt - vehicle.operatingHours;
                const isUpcoming = !isAsRequired && hoursUntil !== null && (hoursUntil <= interval.intervalHours * 0.2 || hoursUntil <= 100);

                return (
                  <div
                    key={interval.id}
                    className={`p-4 border rounded-lg ${isUpcoming ? 'border-yellow-500 bg-yellow-950/50' : 'bg-card'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-foreground">{interval.serviceName}</div>
                        <div className="text-sm text-muted-foreground">
                          {isAsRequired
                            ? 'As required / condition-based'
                            : `Every ${interval.intervalHours.toLocaleString()} ${interval.intervalType.toLowerCase()}`}
                        </div>
                        {interval.serviceDescription && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {interval.serviceDescription}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {interval.category && (
                          <Badge variant="outline" className="mb-1">{interval.category}</Badge>
                        )}
                        <div className="text-sm">
                          {isAsRequired ? (
                            <span className="text-muted-foreground">Check as needed</span>
                          ) : (
                            <>
                              <span className="text-muted-foreground">Next: </span>
                              <span className={`text-foreground ${isUpcoming ? 'font-bold text-yellow-500' : ''}`}>
                                {nextServiceAt?.toLocaleString()} hrs
                              </span>
                            </>
                          )}
                        </div>
                        {interval.requiredParts.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {interval.requiredParts.length} part{interval.requiredParts.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicle Info */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Type</Label>
              <p className="font-medium">{vehicle.type}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Industry</Label>
              <p className="font-medium">{vehicle.industryCategory}</p>
            </div>
            {vehicle.engineModel && (
              <div>
                <Label className="text-muted-foreground">Engine</Label>
                <p className="font-medium">{vehicle.engineModel}</p>
              </div>
            )}
            {vehicle.currentLocation && (
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p className="font-medium">{vehicle.currentLocation}</p>
              </div>
            )}
          </div>
          {vehicle.maintenancePdfFileName && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={handleDownloadPdf}
            >
              <FileText className="h-4 w-4 mr-2" />
              View Maintenance PDF
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Update Hours Dialog */}
      <Dialog open={isUpdateHoursOpen} onOpenChange={setIsUpdateHoursOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Operating Hours</DialogTitle>
            <DialogDescription>
              Enter the current operating hours for this vehicle
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newHours">Current Operating Hours</Label>
              <Input
                id="newHours"
                type="number"
                min="0"
                value={newHours}
                onChange={(e) => setNewHours(parseInt(e.target.value) || 0)}
              />
              {newHours > vehicle.operatingHours && (
                <p className="text-xs text-muted-foreground">
                  +{(newHours - vehicle.operatingHours).toLocaleString()} hours since last update
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateHoursOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateHours}
              disabled={isUpdatingHours}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUpdatingHours ? 'Updating...' : 'Update Hours'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
