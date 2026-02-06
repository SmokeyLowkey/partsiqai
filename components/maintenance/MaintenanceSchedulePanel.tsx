'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Clock,
  FileText,
  Loader2,
  Package,
  Wrench,
} from 'lucide-react';
import { ScheduleStatusBadge } from './ScheduleStatusBadge';

interface MaintenanceSchedule {
  id: string;
  pdfFileName: string;
  parsingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  approvalStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION';
  oem: string | null;
  extractionConfidence: number | null;
  parsingError: string | null;
  intervals: MaintenanceInterval[];
}

interface MaintenanceInterval {
  id: string;
  intervalHours: number;
  intervalType: string;
  serviceName: string;
  serviceDescription: string | null;
  category: string | null;
  requiredParts: MaintenancePart[];
}

interface MaintenancePart {
  id: string;
  partNumber: string;
  partDescription: string | null;
  quantity: number;
}

interface Props {
  vehicleId: string;
  currentOperatingHours?: number;
}

export function MaintenanceSchedulePanel({ vehicleId, currentOperatingHours = 0 }: Props) {
  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedule();
  }, [vehicleId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/vehicles/${vehicleId}/maintenance-schedule`);
      const data = await response.json();

      if (response.ok) {
        setSchedule(data.schedule);
      } else {
        setError(data.error || 'Failed to load schedule');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate next service hour for an interval based on current hours
  const getNextServiceInfo = (intervalHours: number) => {
    const completedCycles = Math.floor(currentOperatingHours / intervalHours);
    const nextServiceAt = (completedCycles + 1) * intervalHours;
    const hoursRemaining = nextServiceAt - currentOperatingHours;
    const isUpcoming = hoursRemaining <= intervalHours * 0.2 || hoursRemaining <= 100;
    const isOverdue = hoursRemaining < 0;

    return { nextServiceAt, hoursRemaining, isUpcoming, isOverdue };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading maintenance schedule...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-red-500">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!schedule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance Schedule
          </CardTitle>
          <CardDescription>
            No maintenance schedule configured. Upload a maintenance PDF to get started.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Maintenance Schedule
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <FileText className="h-4 w-4" />
              {schedule.pdfFileName}
              {schedule.oem && <Badge variant="secondary">{schedule.oem}</Badge>}
            </CardDescription>
          </div>
          <ScheduleStatusBadge
            parsingStatus={schedule.parsingStatus}
            approvalStatus={schedule.approvalStatus}
          />
        </div>
      </CardHeader>

      <CardContent>
        {/* Show message if not approved */}
        {schedule.approvalStatus !== 'APPROVED' && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            <Clock className="h-4 w-4 inline mr-2" />
            This maintenance schedule is pending admin review. Parts recommendations will be available after approval.
          </div>
        )}

        {/* Intervals */}
        {schedule.intervals.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {schedule.intervals.map((interval) => {
              const serviceInfo = getNextServiceInfo(interval.intervalHours);

              return (
                <AccordionItem key={interval.id} value={interval.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left w-full pr-4">
                      <Badge
                        variant="outline"
                        className={
                          serviceInfo.isOverdue
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : serviceInfo.isUpcoming
                            ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                            : ''
                        }
                      >
                        {interval.intervalHours} {interval.intervalType.toLowerCase()}
                      </Badge>
                      <span className="font-medium flex-1">{interval.serviceName}</span>
                      {interval.category && (
                        <Badge variant="secondary" className="text-xs">
                          {interval.category}
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {interval.requiredParts.length} parts
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-4 space-y-3">
                      {/* Service timing info */}
                      {currentOperatingHours > 0 && (
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Next service at {serviceInfo.nextServiceAt.toLocaleString()} hours
                          </span>
                          {serviceInfo.isOverdue ? (
                            <Badge variant="destructive">Overdue by {Math.abs(serviceInfo.hoursRemaining)} hours</Badge>
                          ) : serviceInfo.isUpcoming ? (
                            <Badge className="bg-yellow-500">{serviceInfo.hoursRemaining} hours remaining</Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              ({serviceInfo.hoursRemaining.toLocaleString()} hours remaining)
                            </span>
                          )}
                        </div>
                      )}

                      {interval.serviceDescription && (
                        <p className="text-sm text-muted-foreground">
                          {interval.serviceDescription}
                        </p>
                      )}

                      {/* Parts list */}
                      {interval.requiredParts.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            Required Parts
                          </h5>
                          <div className="space-y-1">
                            {interval.requiredParts.map((part) => (
                              <div
                                key={part.id}
                                className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                              >
                                <div>
                                  <span className="font-mono">{part.partNumber}</span>
                                  {part.partDescription && (
                                    <span className="text-muted-foreground ml-2">
                                      - {part.partDescription}
                                    </span>
                                  )}
                                </div>
                                <span className="text-muted-foreground">Qty: {part.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <p className="text-muted-foreground text-center py-4">
            {schedule.parsingStatus === 'COMPLETED'
              ? 'No maintenance intervals found in the uploaded PDF.'
              : 'Waiting for PDF to be parsed...'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
