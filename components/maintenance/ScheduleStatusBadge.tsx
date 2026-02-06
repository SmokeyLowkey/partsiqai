'use client';

import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileSearch,
  Loader2,
  XCircle,
} from 'lucide-react';

interface Props {
  parsingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  approvalStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'NEEDS_CORRECTION';
  showDetails?: boolean;
}

const PARSING_CONFIG = {
  PENDING: {
    label: 'Pending Parse',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: Clock,
  },
  PROCESSING: {
    label: 'Parsing...',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Loader2,
    animate: true,
  },
  COMPLETED: {
    label: 'Parsed',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
  },
  FAILED: {
    label: 'Parse Failed',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
};

const APPROVAL_CONFIG = {
  PENDING_REVIEW: {
    label: 'Pending Review',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: FileSearch,
  },
  APPROVED: {
    label: 'Approved',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
  },
  REJECTED: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
  NEEDS_CORRECTION: {
    label: 'Needs Correction',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: AlertCircle,
  },
};

export function ScheduleStatusBadge({ parsingStatus, approvalStatus, showDetails = false }: Props) {
  // If parsing is not complete, show parsing status
  if (parsingStatus !== 'COMPLETED') {
    const config = PARSING_CONFIG[parsingStatus];
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={`${config.color} border`}>
        <Icon className={`h-3 w-3 mr-1 ${'animate' in config && config.animate ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    );
  }

  // If parsing is complete, show approval status
  const config = APPROVAL_CONFIG[approvalStatus];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.color} border`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

// Full status display with both statuses
export function ScheduleStatusFull({ parsingStatus, approvalStatus }: Props) {
  const parsingConfig = PARSING_CONFIG[parsingStatus];
  const ParsingIcon = parsingConfig.icon;

  const approvalConfig = APPROVAL_CONFIG[approvalStatus];
  const ApprovalIcon = approvalConfig.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`${parsingConfig.color} border`}>
        <ParsingIcon className={`h-3 w-3 mr-1 ${'animate' in parsingConfig && parsingConfig.animate ? 'animate-spin' : ''}`} />
        {parsingConfig.label}
      </Badge>
      {parsingStatus === 'COMPLETED' && (
        <Badge variant="outline" className={`${approvalConfig.color} border`}>
          <ApprovalIcon className="h-3 w-3 mr-1" />
          {approvalConfig.label}
        </Badge>
      )}
    </div>
  );
}
