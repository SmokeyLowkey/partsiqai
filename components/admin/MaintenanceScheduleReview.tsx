'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  XCircle,
  Wrench,
  Package,
} from 'lucide-react';

interface MaintenanceSchedule {
  id: string;
  vehicleId: string;
  pdfFileName: string;
  parsingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  approvalStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION';
  oem: string | null;
  extractionConfidence: number | null;
  parsingError: string | null;
  reviewNotes: string | null;
  parsedAt: string | null;
  reviewedAt: string | null;
  reviewer: {
    id: string;
    name: string | null;
    email: string;
  } | null;
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
  vehicleName: string;
}

const PARSING_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-800', icon: Clock },
  PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-800', icon: RefreshCw },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const APPROVAL_STATUS_CONFIG = {
  PENDING_REVIEW: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  NEEDS_CORRECTION: { label: 'Needs Correction', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
};

export function MaintenanceScheduleReview({ vehicleId, vehicleName }: Props) {
  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    loadSchedule();
  }, [vehicleId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
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

  const handleApprove = async () => {
    if (!schedule) return;

    try {
      setApproving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/admin/maintenance-schedules/${schedule.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Maintenance schedule approved successfully');
        await loadSchedule();
      } else {
        setError(data.error || 'Failed to approve schedule');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (needsCorrection: boolean = false) => {
    if (!schedule || !rejectReason.trim()) {
      setError('Please provide a reason');
      return;
    }

    try {
      setRejecting(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/admin/maintenance-schedules/${schedule.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason,
          needsCorrection,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setShowRejectForm(false);
        setRejectReason('');
        await loadSchedule();
      } else {
        setError(data.error || 'Failed to reject schedule');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRejecting(false);
    }
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

  if (!schedule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance Schedule
          </CardTitle>
          <CardDescription>No maintenance PDF uploaded for {vehicleName}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            The customer needs to upload a maintenance planner PDF to enable parts recommendations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const parsingConfig = PARSING_STATUS_CONFIG[schedule.parsingStatus];
  const approvalConfig = APPROVAL_STATUS_CONFIG[schedule.approvalStatus];
  const ParsingIcon = parsingConfig.icon;
  const ApprovalIcon = approvalConfig.icon;

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
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className={parsingConfig.color}>
              <ParsingIcon className="h-3 w-3 mr-1" />
              {parsingConfig.label}
            </Badge>
            <Badge className={approvalConfig.color}>
              <ApprovalIcon className="h-3 w-3 mr-1" />
              {approvalConfig.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">OEM Detected</span>
            <p className="font-medium">{schedule.oem || 'Unknown'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Confidence</span>
            <p className="font-medium">
              {schedule.extractionConfidence !== null
                ? `${schedule.extractionConfidence}%`
                : 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Intervals</span>
            <p className="font-medium">{schedule.intervals.length}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Total Parts</span>
            <p className="font-medium">
              {schedule.intervals.reduce((sum, i) => sum + i.requiredParts.length, 0)}
            </p>
          </div>
        </div>

        {/* Parsing Error */}
        {schedule.parsingError && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded text-sm">
            <strong>Extraction Notes:</strong> {schedule.parsingError}
          </div>
        )}

        {/* Intervals */}
        {schedule.parsingStatus === 'COMPLETED' && schedule.intervals.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Maintenance Intervals</h4>
            <Accordion type="single" collapsible className="w-full">
              {schedule.intervals.map((interval) => (
                <AccordionItem key={interval.id} value={interval.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Badge variant="outline">
                        {interval.intervalHours} {interval.intervalType.toLowerCase()}
                      </Badge>
                      <span className="font-medium">{interval.serviceName}</span>
                      <span className="text-muted-foreground text-sm">
                        ({interval.requiredParts.length} parts)
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-4 space-y-2">
                      {interval.serviceDescription && (
                        <p className="text-sm text-muted-foreground">
                          {interval.serviceDescription}
                        </p>
                      )}
                      {interval.category && (
                        <Badge variant="secondary">{interval.category}</Badge>
                      )}
                      <div className="mt-2">
                        <h5 className="text-sm font-medium mb-1 flex items-center gap-1">
                          <Package className="h-4 w-4" /> Required Parts
                        </h5>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-1">Part Number</th>
                              <th className="text-left py-1">Description</th>
                              <th className="text-right py-1">Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {interval.requiredParts.map((part) => (
                              <tr key={part.id} className="border-b border-dashed">
                                <td className="py-1 font-mono">{part.partNumber}</td>
                                <td className="py-1">{part.partDescription || '-'}</td>
                                <td className="py-1 text-right">{part.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {/* Review Notes */}
        {schedule.reviewNotes && (
          <div className="bg-gray-50 border border-gray-200 p-3 rounded text-sm">
            <strong>Review History:</strong>
            <pre className="whitespace-pre-wrap mt-1 text-muted-foreground">
              {schedule.reviewNotes}
            </pre>
          </div>
        )}

        {/* Reject Form */}
        {showRejectForm && (
          <div className="border rounded p-4 space-y-3">
            <h4 className="font-medium">Rejection Reason</h4>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Please explain why this schedule is being rejected..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => handleReject(false)}
                disabled={rejecting || !rejectReason.trim()}
              >
                {rejecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reject (Re-upload Required)
              </Button>
              <Button
                variant="outline"
                onClick={() => handleReject(true)}
                disabled={rejecting || !rejectReason.trim()}
              >
                Needs Correction
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {schedule.parsingStatus === 'COMPLETED' &&
          schedule.approvalStatus === 'PENDING_REVIEW' &&
          !showRejectForm && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={handleApprove}
                disabled={approving || schedule.intervals.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {approving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Schedule
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                variant="ghost"
                onClick={loadSchedule}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          )}

        {/* Already reviewed info */}
        {schedule.approvalStatus === 'APPROVED' && schedule.reviewer && (
          <div className="text-sm text-muted-foreground border-t pt-2">
            Approved by {schedule.reviewer.name || schedule.reviewer.email} on{' '}
            {new Date(schedule.reviewedAt!).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
