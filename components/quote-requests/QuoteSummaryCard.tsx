'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { QuoteStatusBadge } from './QuoteStatusBadge';
import { Clock, User, Calendar, AlertCircle } from 'lucide-react';
import { QuoteStatus } from '@prisma/client';
import { SupplierSummary, UserSummary } from '@/types/quote-request';

interface SupplierResponse {
  supplier: SupplierSummary;
  responded: boolean;
}

interface QuoteSummaryCardProps {
  status: QuoteStatus;
  supplierResponses: SupplierResponse[];
  itemCount: number;
  bestPrice: number | null;
  bestPriceSupplier: string | null;
  createdBy: UserSummary;
  createdOn: Date;
}

export function QuoteSummaryCard({
  status,
  supplierResponses,
  itemCount,
  bestPrice,
  bestPriceSupplier,
  createdBy,
  createdOn,
}: QuoteSummaryCardProps) {
  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  const respondedCount = supplierResponses.filter((s) => s.responded).length;
  const isWaitingForResponse =
    status === 'SENT' && respondedCount < supplierResponses.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quote Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <QuoteStatusBadge status={status} />
        </div>

        {/* Supplier Responses */}
        {supplierResponses.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">
              Supplier Responses
            </span>
            <div className="space-y-1.5">
              {supplierResponses.map((sr) => (
                <div key={sr.supplier.id} className="flex items-center gap-2">
                  <Checkbox checked={sr.responded} disabled />
                  <span className="text-sm">{sr.supplier.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Items</span>
          <span className="font-medium">{itemCount}</span>
        </div>

        {/* Best Price */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Best Price</span>
          <div className="text-right">
            <span className="font-bold text-green-600 dark:text-green-400">
              {formatPrice(bestPrice)}
            </span>
            {bestPriceSupplier && (
              <p className="text-xs text-muted-foreground">
                {bestPriceSupplier}
              </p>
            )}
          </div>
        </div>

        {/* Created By */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3" />
            Created By
          </span>
          <span className="text-sm">{createdBy.name || createdBy.email}</span>
        </div>

        {/* Created On */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Created On
          </span>
          <span className="text-sm">{formatDate(createdOn)}</span>
        </div>

        {/* Waiting for Response Box */}
        {isWaitingForResponse && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200 text-sm">
                  Waiting for Supplier Response
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                  Quote request has been sent to the supplier.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Draft Warning */}
        {status === 'DRAFT' && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">
                  Draft Quote Request
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                  Select a supplier and send the quote request.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
