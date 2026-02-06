'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, AlertTriangle, CheckCircle2, Package, RefreshCw, Info, Plus, Mail, Sparkles, Send } from 'lucide-react';
import { QuoteRequestItemWithDetails, SupplierSummary } from '@/types/quote-request';

interface ConvertToOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRequestId: string;
  quoteNumber: string;
  supplier: SupplierSummary;
  items: QuoteRequestItemWithDetails[];
  totalAmount: number;
  hasExpiredItems: boolean;
  expiredItemsCount: number;
  onSuccess?: () => void;
}

export function ConvertToOrderDialog({
  open,
  onOpenChange,
  quoteRequestId,
  quoteNumber,
  supplier,
  items,
  totalAmount,
  hasExpiredItems,
  expiredItemsCount,
  onSuccess,
}: ConvertToOrderDialogProps) {
  const router = useRouter();
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [orderNotes, setOrderNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [acknowledgeExpiry, setAcknowledgeExpiry] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Email preview state
  const [step, setStep] = useState<'order-details' | 'email-preview'>('order-details');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [sendingOrder, setSendingOrder] = useState(false);
  
  // Track part selection: 'ALTERNATIVE' = accept supplier's part, 'ORIGINAL' = request original part
  const [itemSelections, setItemSelections] = useState<Record<string, 'ALTERNATIVE' | 'ORIGINAL'>>({});
  // Track which supplier-suggested items to include in order
  const [includeSuggested, setIncludeSuggested] = useState<Record<string, boolean>>({});
  // Track which requested items to include in order
  const [includeRequested, setIncludeRequested] = useState<Record<string, boolean>>({});

  // Early return if required props are missing
  if (!supplier || !items) {
    return null;
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const supplierItems = (items || []).filter(item =>
    item.supplierQuotes?.some(sq => sq.supplierId === supplier?.id)
  );

  // Split into requested items and supplier-suggested alternatives
  const requestedItems = supplierItems.filter(item => !item.isAlternative || item.originalPartNumber);
  const supplierSuggestedItems = supplierItems.filter(item => item.isAlternative && !item.originalPartNumber);

  // Initialize all requested items as checked by default (only once)
  useEffect(() => {
    if (open) {
      // Reset state when dialog opens
      setStep('order-details');
      setEmailSubject('');
      setEmailBody('');
      setError(null);
      setShowSuccess(false);
    }
    
    const initialChecked: Record<string, boolean> = {};
    requestedItems.forEach(item => {
      if (!(item.id in includeRequested)) {
        initialChecked[item.id] = true;
      }
    });
    if (Object.keys(initialChecked).length > 0) {
      setIncludeRequested(prev => ({ ...prev, ...initialChecked }));
    }
  }, []); // Only run once on mount

  // Check if item has alternative part
  const hasAlternative = (item: QuoteRequestItemWithDetails) => {
    const quote = item.supplierQuotes?.find(sq => sq.supplierId === supplier.id);
    return item.isAlternative || item.isSuperseded || 
           (quote?.supplierPartNumber && quote.supplierPartNumber !== item.partNumber);
  };

  // Calculate dynamic total based on selections
  const calculateTotal = () => {
    let total = requestedItems.reduce((sum, item) => {
      // Skip if item is not checked (explicitly false or not in object means unchecked)
      if (includeRequested[item.id] === false) return sum;
      
      const quote = item.supplierQuotes?.find(sq => sq.supplierId === supplier.id);
      const selection = itemSelections[item.id];
      
      // If user rejected alternative and no original available, don't include in total
      if (selection === 'ORIGINAL' && hasAlternative(item)) {
        return sum; // Will need follow-up
      }
      
      return sum + Number(quote?.totalPrice || 0);
    }, 0);

    // Add supplier-suggested items that are included
    total += supplierSuggestedItems.reduce((sum, item) => {
      if (includeSuggested[item.id]) {
        const quote = item.supplierQuotes?.find(sq => sq.supplierId === supplier.id);
        return sum + Number(quote?.totalPrice || 0);
      }
      return sum;
    }, 0);

    return total;
  };

  const dynamicTotal = calculateTotal();
  const hasRejectedAlternatives = requestedItems.some(
    item => itemSelections[item.id] === 'ORIGINAL' && hasAlternative(item)
  );

  const handleConvert = async () => {
    if (hasExpiredItems && !acknowledgeExpiry) {
      setError('Please acknowledge the expired pricing to continue.');
      return;
    }

    setGeneratingEmail(true);
    setError(null);

    try {
      const response = await fetch(`/api/quote-requests/${quoteRequestId}/convert-to-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          fulfillmentMethod,
          orderNotes,
          internalNotes,
          acknowledgeExpiry,
          itemSelections,
          includeSuggested,
          includeRequested,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate email preview');
      }

      // Set email preview and move to next step
      setEmailSubject(data.emailPreview.subject);
      setEmailBody(data.emailPreview.body);
      setStep('email-preview');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingEmail(false);
    }
  };

  const handleSendOrder = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      setError('Please enter both subject and email body');
      return;
    }

    setSendingOrder(true);
    setError(null);

    try {
      const response = await fetch(`/api/quote-requests/${quoteRequestId}/confirm-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplier.id,
          fulfillmentMethod,
          orderNotes,
          internalNotes,
          acknowledgeExpiry,
          itemSelections,
          includeSuggested,
          includeRequested,
          emailSubject,
          emailBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      setShowSuccess(true);

      // Wait 2 seconds then redirect to order page
      setTimeout(() => {
        onSuccess?.();
        router.push(`/customer/orders/${data.order.id}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setSendingOrder(false);
    }
  };

  const handleRegenerateEmail = async () => {
    await handleConvert();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Convert Quote to Order
          </DialogTitle>
          <DialogDescription>
            Create an order from quote {quoteNumber} with {supplier.name}
          </DialogDescription>
        </DialogHeader>

        {showSuccess ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Order Created Successfully!</h3>
            <p className="text-muted-foreground">
              Redirecting to order details...
            </p>
          </div>
        ) : step === 'order-details' ? (
          <>
            {/* Expiry Warning */}
            {hasExpiredItems && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">
                      {expiredItemsCount} item{expiredItemsCount !== 1 ? 's' : ''} {expiredItemsCount !== 1 ? 'have' : 'has'} expired pricing
                    </p>
                    <p className="text-sm">
                      The supplier's quoted prices may have changed. We recommend contacting them
                      to reconfirm pricing before proceeding.
                    </p>
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledgeExpiry}
                        onChange={(e) => setAcknowledgeExpiry(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">
                        I acknowledge the expired pricing and wish to proceed
                      </span>
                    </label>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Order Summary */}
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supplier:</span>
                    <span className="font-medium">{supplier.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span className="font-medium">
                      {Object.values(includeRequested).filter(Boolean).length}
                      {Object.values(includeSuggested).filter(Boolean).length > 0 && (
                        <span className="text-xs text-blue-600 ml-1">
                          +{Object.values(includeSuggested).filter(Boolean).length} suggested
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="font-semibold text-lg">{formatPrice(dynamicTotal)}</span>
                  </div>
                  {hasRejectedAlternatives && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      * Items with rejected alternatives excluded from total
                    </div>
                  )}
                </div>
              </div>

              {/* Items with Part Selection */}
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto space-y-4">
                {/* Requested Items */}
                <div>
                  <h3 className="font-semibold mb-3">Requested Parts</h3>
                  <div className="space-y-4">
                    {requestedItems.map((item) => {
                      const quote = item.supplierQuotes?.find(sq => sq.supplierId === supplier.id);
                      const hasAlt = hasAlternative(item);
                      const selection = itemSelections[item.id] || 'ALTERNATIVE';
                      const isExpired = quote?.validUntil && new Date(quote.validUntil) < new Date();
                      const isIncluded = includeRequested[item.id] !== false; // Default to true
                    
                    return (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2">
                        {/* Checkbox and Part Header */}
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`req-${item.id}`}
                            checked={isIncluded}
                            onCheckedChange={(checked) =>
                              setIncludeRequested(prev => ({ ...prev, [item.id]: checked === true }))
                            }
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label htmlFor={`req-${item.id}`} className="cursor-pointer">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-medium">{item.partNumber}</span>
                                    {hasAlt && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Alternative
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <div className="space-y-1 text-xs">
                                        {item.isSuperseded && <p><strong>Superseded Part</strong></p>}
                                        {item.alternativeReason && <p>{item.alternativeReason}</p>}
                                        {quote?.supplierPartNumber && (
                                          <p>Supplier Part: {quote.supplierPartNumber}</p>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {isExpired && (
                                <Badge variant="destructive" className="text-xs">Expired</Badge>
                              )}
                            </div>
                                    {item.description && (
                                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <span className="text-sm text-muted-foreground">×{item.quantity}</span>
                                  </div>
                                </div>
                              </Label>
                            </div>
                          </div>

                        {/* Part Selection Radio Group - Only show if item is checked */}
                        {isIncluded && hasAlt ? (
                          <RadioGroup
                            value={selection}
                            onValueChange={(value: 'ALTERNATIVE' | 'ORIGINAL') => 
                              setItemSelections(prev => ({ ...prev, [item.id]: value }))
                            }
                            className="space-y-2 pl-2"
                          >
                            {/* Accept Alternative */}
                            <div className="flex items-center space-x-2 p-2 rounded hover:bg-accent">
                              <RadioGroupItem value="ALTERNATIVE" id={`${item.id}-alt`} />
                              <Label htmlFor={`${item.id}-alt`} className="flex-1 cursor-pointer">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="text-sm font-medium">Accept Alternative</span>
                                    {quote?.supplierPartNumber && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({quote.supplierPartNumber})
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-sm font-semibold">
                                    {formatPrice(quote?.totalPrice || 0)}
                                  </span>
                                </div>
                              </Label>
                            </div>

                            {/* Request Original */}
                            <div className="flex items-center space-x-2 p-2 rounded hover:bg-accent">
                              <RadioGroupItem value="ORIGINAL" id={`${item.id}-orig`} />
                              <Label htmlFor={`${item.id}-orig`} className="flex-1 cursor-pointer">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="text-sm font-medium">Request Original</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({item.partNumber})
                                    </span>
                                  </div>
                                  <span className="text-xs text-amber-600">Requires follow-up</span>
                                </div>
                              </Label>
                            </div>
                          </RadioGroup>
                        ) : isIncluded ? (
                          <div className="flex justify-between items-center pl-2 py-1">
                            <span className="text-sm text-muted-foreground">Standard part</span>
                            <span className="text-sm font-semibold">
                              {formatPrice(quote?.totalPrice || 0)}
                            </span>
                          </div>
                        ) : null}

                        {/* Show warning for rejected alternatives - Only if item is checked */}
                        {isIncluded && selection === 'ORIGINAL' && hasAlt && (
                          <Alert className="mt-2">
                            <Info className="h-3 w-3" />
                            <AlertDescription className="text-xs">
                              This item will be flagged for follow-up with the supplier to check availability of the original part.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>

                {/* Supplier Suggested Items */}
                {supplierSuggestedItems.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <Plus className="h-3 w-3 mr-1" />
                        Optional
                      </Badge>
                      Supplier Suggested Alternatives
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      The supplier is offering these additional or alternative parts. Check the boxes to include them in your order.
                    </p>
                    <div className="space-y-3">
                      {supplierSuggestedItems.map((item) => {
                        const quote = item.supplierQuotes?.find(sq => sq.supplierId === supplier.id);
                        const isIncluded = includeSuggested[item.id] || false;
                        const isExpired = quote?.validUntil && new Date(quote.validUntil) < new Date();

                        return (
                          <div key={item.id} className="border border-blue-200 rounded-lg p-3 bg-blue-50/50">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                id={`suggest-${item.id}`}
                                checked={isIncluded}
                                onCheckedChange={(checked) =>
                                  setIncludeSuggested(prev => ({ ...prev, [item.id]: checked === true }))
                                }
                                className="mt-1"
                              />
                              <Label htmlFor={`suggest-${item.id}`} className="flex-1 cursor-pointer">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-medium">{item.partNumber}</span>
                                    {isExpired && (
                                      <Badge variant="destructive" className="text-xs">Expired</Badge>
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className="text-sm text-foreground">{item.description}</p>
                                  )}
                                  {item.alternativeReason && (
                                    <p className="text-xs text-blue-700 italic">{item.alternativeReason}</p>
                                  )}
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-white">Qty: {item.quantity}</span>
                                    <span className="text-sm font-semibold text-blue-700">
                                      {formatPrice(quote?.totalPrice || 0)}
                                    </span>
                                  </div>
                                </div>
                              </Label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Fulfillment Method */}
              <div className="space-y-2">
                <Label htmlFor="fulfillmentMethod">Fulfillment Method</Label>
                <Select value={fulfillmentMethod} onValueChange={(value: any) => setFulfillmentMethod(value)}>
                  <SelectTrigger id="fulfillmentMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DELIVERY">Delivery</SelectItem>
                    <SelectItem value="PICKUP">Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Order Notes */}
              <div className="space-y-2">
                <Label htmlFor="orderNotes">
                  Order Notes <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="orderNotes"
                  placeholder="Add any special instructions or notes for this order..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Internal Notes */}
              <div className="space-y-2">
                <Label htmlFor="internalNotes">
                  Internal Notes <span className="text-muted-foreground">(optional, not shared with supplier)</span>
                </Label>
                <Textarea
                  id="internalNotes"
                  placeholder="Add internal notes for your team..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={generatingEmail}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConvert}
                disabled={generatingEmail || (hasExpiredItems && !acknowledgeExpiry)}
              >
                {generatingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {generatingEmail ? 'Generating Email...' : 'Preview Email'}
              </Button>
            </DialogFooter>
          </>
        ) : step === 'email-preview' ? (
          <>
            {/* Email Preview Step */}
            <div className="space-y-4">
              {generatingEmail && (
                <Alert>
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  <AlertDescription>
                    Generating order confirmation email...
                  </AlertDescription>
                </Alert>
              )}

              {/* Email Info Box */}
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>
                    To: {supplier.email || 'No email on file'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  <span className="font-medium">Quote #{quoteNumber}</span>
                </div>
              </div>

              {/* Email Subject */}
              <div className="space-y-2">
                <Label htmlFor="emailSubject">Subject</Label>
                <Input
                  id="emailSubject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Order Confirmation - [Order Number]"
                  disabled={generatingEmail || sendingOrder}
                />
              </div>

              {/* Email Body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailBody">Message</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerateEmail}
                    disabled={generatingEmail || sendingOrder}
                    className="h-8"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${generatingEmail ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                </div>
                <Textarea
                  id="emailBody"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Your order confirmation message..."
                  disabled={generatingEmail || sendingOrder}
                  rows={14}
                  className="font-mono text-sm"
                />
              </div>

              {/* Info Alert */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This email will be sent to {supplier.name} to confirm the order. Review and edit if needed before sending.
                </AlertDescription>
              </Alert>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep('order-details')}
                disabled={sendingOrder}
              >
                Back
              </Button>
              <Button
                onClick={handleSendOrder}
                disabled={sendingOrder || !emailSubject.trim() || !emailBody.trim()}
              >
                {sendingOrder ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send & Create Order
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Success step remains the same */}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
