'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  QuoteRequestItemWithDetails,
  SupplierSummary,
  SupplierQuoteItemWithDetails,
  QuoteRequestEmailThreadWithDetails,
} from '@/types/quote-request';
import { ItemAvailability, QuoteStatus } from '@prisma/client';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingDown,
  Package,
  Check,
  RefreshCw,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConvertToOrderDialog } from './ConvertToOrderDialog';
import { UserRole } from '@prisma/client';

interface SupplierPriceComparisonTableProps {
  items: QuoteRequestItemWithDetails[];
  suppliers: SupplierSummary[];
  onSelectSupplierItem?: (itemId: string, supplierId: string) => void;
  selectedItems?: Record<string, string>; // itemId -> supplierId
  quoteRequestId: string;
  quoteNumber: string;
  quoteStatus: QuoteStatus;
  emailThreads: QuoteRequestEmailThreadWithDetails[];
  onOrderCreated?: () => void;
  userRole?: UserRole;
  requiresApproval?: boolean;
  createdByRole?: UserRole;
  selectedSupplierId?: string | null;
}

export function SupplierPriceComparisonTable({
  items,
  suppliers,
  onSelectSupplierItem,
  selectedItems = {},
  quoteRequestId,
  quoteNumber,
  quoteStatus,
  emailThreads,
  onOrderCreated,
  userRole,
  requiresApproval,
  createdByRole,
  selectedSupplierId,
}: SupplierPriceComparisonTableProps) {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const getAvailabilityBadge = (availability: ItemAvailability) => {
    switch (availability) {
      case 'IN_STOCK':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            In Stock
          </Badge>
        );
      case 'BACKORDERED':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Backordered
          </Badge>
        );
      case 'SPECIAL_ORDER':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Package className="h-3 w-3 mr-1" />
            Special Order
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  // Get all unique suppliers that have quoted on any item
  const quotingSuppliers = suppliers.filter((supplier) =>
    items.some((item) =>
      item.supplierQuotes?.some((sq) => sq.supplierId === supplier.id)
    )
  );

  // Helper to find the lowest price for an item
  const getLowestPrice = (item: QuoteRequestItemWithDetails): number | null => {
    if (!item.supplierQuotes || item.supplierQuotes.length === 0) return null;
    return Math.min(...item.supplierQuotes.map((sq) => sq.unitPrice));
  };

  // Calculate total for each supplier (sum of their quoted prices)
  const supplierTotals = quotingSuppliers.map((supplier) => {
    let total = 0;
    let itemsQuoted = 0;
    items.forEach((item) => {
      const quote = item.supplierQuotes?.find((sq) => sq.supplierId === supplier.id);
      if (quote) {
        total += quote.totalPrice;
        itemsQuoted++;
      }
    });
    return { supplierId: supplier.id, supplierName: supplier.name, total, itemsQuoted };
  });

  // Check if supplier can accept quote
  const canAcceptQuote = (supplierId: string) => {
    // Check user role permissions FIRST
    const canConvert = userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'MASTER_ADMIN';
    
    // Check if quote was created by a technician (needs approval)
    const quoteCreatedByTechnician = createdByRole === 'TECHNICIAN';
    
    // If quote was created by technician and requires manager approval
    if (quoteCreatedByTechnician) {
      // Must be approved
      if (quoteStatus !== 'APPROVED') {
        return { 
          enabled: false, 
          reason: 'Quote requires manager approval' 
        };
      }
      
      // Must be the supplier selected by the manager during approval
      if (selectedSupplierId && supplierId !== selectedSupplierId) {
        return { 
          enabled: false, 
          reason: 'Manager approved a different supplier' 
        };
      }
      
      // If approved but no supplier selected yet, only managers can convert
      if (!selectedSupplierId && !canConvert) {
        return { 
          enabled: false, 
          reason: 'Manager must select which supplier to use' 
        };
      }
    }
    
    // Technicians cannot convert quotes at all (even if approved)
    if (userRole === 'TECHNICIAN') {
      return { 
        enabled: false, 
        reason: 'Only managers can convert quotes to orders' 
      };
    }
    
    // Check quote status
    if (!['RECEIVED', 'APPROVED'].includes(quoteStatus)) {
      return { enabled: false, reason: 'Waiting for supplier responses' };
    }

    // Check supplier responded
    const supplierThread = emailThreads.find(et => et.supplierId === supplierId);
    if (supplierThread?.status !== 'RESPONDED') {
      return { enabled: false, reason: 'Supplier has not responded yet' };
    }

    // Check has pricing data
    const supplierItems = items.flatMap(item =>
      item.supplierQuotes?.filter(sq => sq.supplierId === supplierId) || []
    );
    if (supplierItems.length === 0) {
      return { enabled: false, reason: 'No pricing received from this supplier' };
    }

    // Check coverage
    const quotedCount = supplierItems.length;
    const totalCount = items.filter(i => i.partNumber !== 'MISC-COSTS').length;
    if (quotedCount < totalCount) {
      return {
        enabled: true,
        warning: `Supplier quoted ${quotedCount} of ${totalCount} items`
      };
    }

    return { enabled: true };
  };

  // Handle accept quote
  const handleAcceptQuote = (supplier: SupplierSummary) => {
    setSelectedSupplier(supplier);
    setConvertDialogOpen(true);
  };

  // Calculate expired items for selected supplier
  const getExpiredItemsInfo = (supplierId: string) => {
    const supplierItems = items.flatMap(item =>
      item.supplierQuotes?.filter(sq => sq.supplierId === supplierId) || []
    );
    const expiredItems = supplierItems.filter(sq =>
      sq.validUntil && new Date(sq.validUntil) < new Date()
    );
    return {
      hasExpired: expiredItems.length > 0,
      count: expiredItems.length
    };
  };

  // Find supplier with lowest total (regardless of coverage)
  const lowestTotalSupplier = supplierTotals.length > 0
    ? supplierTotals.reduce((lowest, current) =>
        current.total < lowest.total ? current : lowest
      )
    : null;

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No items in this quote request
      </div>
    );
  }

  if (quotingSuppliers.length === 0) {
    return (
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Price Comparison</h4>
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No supplier quotes received yet.</p>
          <p className="text-xs mt-1">
            Quotes will appear here once suppliers respond.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Price Comparison by Supplier</h4>
        <span className="text-xs text-muted-foreground">
          {quotingSuppliers.length} supplier{quotingSuppliers.length !== 1 ? 's' : ''} quoted
        </span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-medium min-w-[150px] sticky left-0 bg-muted/50">
                Part Number
              </TableHead>
              <TableHead className="font-medium min-w-[200px]">Description</TableHead>
              <TableHead className="font-medium text-center w-[80px]">Qty</TableHead>
              {quotingSuppliers.map((supplier) => (
                <TableHead
                  key={supplier.id}
                  className="font-medium text-center min-w-[180px]"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="truncate max-w-[160px]">{supplier.name}</span>
                    {(() => {
                      const acceptCheck = canAcceptQuote(supplier.id);
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant={acceptCheck.enabled ? "default" : "secondary"}
                                disabled={!acceptCheck.enabled}
                                onClick={() => handleAcceptQuote(supplier)}
                                className="w-full"
                              >
                                {acceptCheck.enabled ? (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Accept Quote
                                  </>
                                ) : (
                                  'Not Ready'
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{acceptCheck.enabled ? (acceptCheck.warning || 'Convert to order') : acceptCheck.reason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const lowestPrice = getLowestPrice(item);
              const isMiscItem = item.partNumber === 'MISC-COSTS';

              return (
                <TableRow 
                  key={item.id}
                  className={cn(
                    isMiscItem && 'bg-amber-50/50 dark:bg-amber-950/20 border-t-2 border-amber-200 dark:border-amber-800'
                  )}
                >
                  <TableCell className={cn(
                    "font-mono text-sm sticky left-0",
                    isMiscItem ? "bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-semibold" : "bg-background"
                  )}>
                    {isMiscItem ? '💰 MISC-COSTS' : item.partNumber}
                  </TableCell>
                  <TableCell className={cn(
                    "text-sm",
                    isMiscItem && "text-amber-700 dark:text-amber-400 italic"
                  )}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate block max-w-[180px]">
                            {item.description}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{item.description}</p>
                          {isMiscItem && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Includes shipping, freight, handling fees, and other miscellaneous costs
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  {quotingSuppliers.map((supplier) => {
                    const quote = item.supplierQuotes?.find(
                      (sq) => sq.supplierId === supplier.id
                    );
                    const isLowestPrice = quote && lowestPrice !== null && quote.unitPrice === lowestPrice;
                    const isSelected = selectedItems[item.id] === supplier.id || quote?.isSelected;

                    if (!quote) {
                      return (
                        <TableCell
                          key={supplier.id}
                          className="text-center text-muted-foreground"
                        >
                          <span className="text-xs">No quote</span>
                        </TableCell>
                      );
                    }

                    return (
                      <TableCell
                        key={supplier.id}
                        className={cn(
                          'text-center p-2',
                          isLowestPrice && 'bg-green-50 dark:bg-green-950',
                          isSelected && 'ring-2 ring-primary ring-inset'
                        )}
                      >
                        <div
                          className={cn(
                            'space-y-1 rounded p-2 cursor-pointer hover:bg-muted/50 transition-colors',
                            onSelectSupplierItem && 'cursor-pointer'
                          )}
                          onClick={() =>
                            onSelectSupplierItem?.(item.id, supplier.id)
                          }
                        >
                          {/* Alternative/Aftermarket Badge */}
                          {(item.isAlternative || item.isSuperseded || (quote.supplierPartNumber && quote.supplierPartNumber !== item.partNumber)) && (
                            <div className="flex justify-center mb-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                    >
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      {item.isSuperseded ? 'Superseded' : 'Alternative'}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    <div className="space-y-1">
                                      {item.originalPartNumber && (
                                        <p><strong>Original:</strong> {item.originalPartNumber}</p>
                                      )}
                                      {quote.supplierPartNumber && quote.supplierPartNumber !== item.partNumber && (
                                        <p><strong>Supplier Part #:</strong> {quote.supplierPartNumber}</p>
                                      )}
                                      {item.isSuperseded && item.supersessionNotes && (
                                        <p className="text-xs text-muted-foreground">{item.supersessionNotes}</p>
                                      )}
                                      {item.isAlternative && item.alternativeReason && (
                                        <p className="text-xs text-muted-foreground">{item.alternativeReason}</p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}

                          {/* Price */}
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={cn(
                                'font-semibold',
                                isLowestPrice && 'text-green-700 dark:text-green-400'
                              )}
                            >
                              {formatPrice(quote.unitPrice)}
                            </span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>

                          {/* Total */}
                          <div className="text-xs text-muted-foreground">
                            Total: {formatPrice(quote.totalPrice)}
                          </div>

                          {/* Supplier Part Number (if different and not shown in badge) */}
                          {quote.supplierPartNumber && 
                           quote.supplierPartNumber !== item.partNumber && 
                           !item.isAlternative && 
                           !item.isSuperseded && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                              {quote.supplierPartNumber}
                            </div>
                          )}

                          {/* For MISC items, show notes/details if available */}
                          {isMiscItem && quote.notes && (
                            <div className="text-xs text-amber-600 dark:text-amber-400 italic mt-1 max-w-[160px] truncate">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>{quote.notes}</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    <p className="whitespace-pre-wrap">{quote.notes}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}

                          {/* Regular notes for non-MISC items */}
                          {!isMiscItem && quote.notes && (
                            <div className="text-xs text-muted-foreground italic mt-1 max-w-[160px]">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-start gap-1">
                                      <Info className="h-3 w-3 shrink-0 mt-0.5" />
                                      <span className="truncate">{quote.notes}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    <p className="whitespace-pre-wrap">{quote.notes}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}

                          {/* Availability - hide for MISC items */}
                          {!isMiscItem && (
                            <div className="flex justify-center">
                              {getAvailabilityBadge(quote.availability)}
                            </div>
                          )}

                          {/* Lead Time */}
                          {quote.leadTimeDays && (
                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3" />
                              {quote.leadTimeDays} days
                            </div>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}

            {/* Totals Row */}
            <TableRow className="bg-muted/30 font-medium">
              <TableCell colSpan={3} className="text-right sticky left-0 bg-muted/30">
                Supplier Total
              </TableCell>
              {quotingSuppliers.map((supplier) => {
                const supplierTotal = supplierTotals.find(
                  (st) => st.supplierId === supplier.id
                );
                const isLowestTotal = lowestTotalSupplier?.supplierId === supplier.id;

                return (
                  <TableCell
                    key={supplier.id}
                    className={cn(
                      'text-center',
                      isLowestTotal && 'bg-green-100 dark:bg-green-900'
                    )}
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'font-bold text-lg',
                          isLowestTotal && 'text-green-700 dark:text-green-400'
                        )}
                      >
                        {formatPrice(supplierTotal?.total || 0)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {supplierTotal?.itemsQuoted || 0}/{items.length} items quoted
                      </span>
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 border border-green-200 rounded" />
          <span>Lowest price</span>
        </div>
        {onSelectSupplierItem && (
          <div className="flex items-center gap-1">
            <Check className="h-3 w-3 text-primary" />
            <span>Selected supplier</span>
          </div>
        )}
      </div>

      {/* Convert to Order Dialog */}
      {selectedSupplier && (
        <ConvertToOrderDialog
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          quoteRequestId={quoteRequestId}
          quoteNumber={quoteNumber}
          supplier={selectedSupplier}
          items={items}
          totalAmount={supplierTotals.find(st => st.supplierId === selectedSupplier.id)?.total || 0}
          hasExpiredItems={getExpiredItemsInfo(selectedSupplier.id).hasExpired}
          expiredItemsCount={getExpiredItemsInfo(selectedSupplier.id).count}
          onSuccess={onOrderCreated}
        />
      )}
    </div>
  );
}
