'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { SupplierComparison } from '@/types/quote-request';

interface SupplierComparisonCardProps {
  suppliers: SupplierComparison[];
}

export function SupplierComparisonCard({
  suppliers,
}: SupplierComparisonCardProps) {
  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const respondedSuppliers = suppliers.filter((s) => s.responded);
  const respondedCount = respondedSuppliers.length;
  const totalCount = suppliers.length;
  const responseRate =
    totalCount > 0 ? Math.round((respondedCount / totalCount) * 100) : 0;

  // Calculate price stats from responded suppliers
  const prices = respondedSuppliers
    .map((s) => s.quotedAmount)
    .filter((p): p is number => p !== null);

  const bestPrice = prices.length > 0 ? Math.min(...prices) : null;
  const highestPrice = prices.length > 0 ? Math.max(...prices) : null;
  const averagePrice =
    prices.length > 0
      ? prices.reduce((a, b) => a + b, 0) / prices.length
      : null;

  const bestPriceSupplier = respondedSuppliers.find(
    (s) => s.quotedAmount === bestPrice
  );
  const highestPriceSupplier = respondedSuppliers.find(
    (s) => s.quotedAmount === highestPrice
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Supplier Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Response Rate */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Supplier Response Rate
          </span>
          <span className="font-medium">
            {respondedCount}/{totalCount} ({responseRate}%)
          </span>
        </div>

        {/* Price Comparison */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Price Comparison</span>

          {/* Best Price */}
          <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  Best Price
                </span>
              </div>
              <div className="text-right">
                <span className="font-bold text-green-700 dark:text-green-300">
                  {formatPrice(bestPrice)}
                </span>
                {bestPriceSupplier && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {bestPriceSupplier.supplierName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Highest Price */}
          <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  Highest
                </span>
              </div>
              <div className="text-right">
                <span className="font-bold text-red-700 dark:text-red-300">
                  {formatPrice(highestPrice)}
                </span>
                {highestPriceSupplier && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {highestPriceSupplier.supplierName}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Average Quote */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Average Quote
          </span>
          <span className="font-medium">{formatPrice(averagePrice)}</span>
        </div>

        {/* No Responses Message */}
        {respondedCount === 0 && totalCount > 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <p>No price quotes received yet.</p>
            <p className="text-xs mt-1">
              Suppliers haven&apos;t responded with pricing information.
            </p>
          </div>
        )}

        {/* No Suppliers Message */}
        {totalCount === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <p>No suppliers selected.</p>
            <p className="text-xs mt-1">
              Add suppliers to compare pricing.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
