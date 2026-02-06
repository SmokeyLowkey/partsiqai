'use client';

import { Badge } from '@/components/ui/badge';
import {
  FileEdit,
  Send,
  Inbox,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ShoppingCart,
} from 'lucide-react';
import { QuoteStatus } from '@prisma/client';

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
  className?: string;
}

const statusConfig: Record<
  QuoteStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  DRAFT: {
    label: 'Draft',
    icon: FileEdit,
    className:
      'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  },
  SENT: {
    label: 'Sent',
    icon: Send,
    className:
      'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  RECEIVED: {
    label: 'Received',
    icon: Inbox,
    className:
      'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    icon: Search,
    className:
      'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  },
  APPROVED: {
    label: 'Approved',
    icon: CheckCircle,
    className:
      'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircle,
    className:
      'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  },
  EXPIRED: {
    label: 'Expired',
    icon: Clock,
    className:
      'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  },
  CONVERTED_TO_ORDER: {
    label: 'Converted',
    icon: ShoppingCart,
    className:
      'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
};

export function QuoteStatusBadge({ status, className }: QuoteStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.className} ${className || ''}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
