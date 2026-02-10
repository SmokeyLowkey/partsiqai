'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  QuoteStatusBadge,
  QuoteItemsTable,
  QuoteSummaryCard,
  SupplierComparisonCard,
  SupplierPriceComparisonTable,
  CommunicationHistory,
  SupplierSelect,
  SendQuoteDialog,
  EditQuoteDialog,
  RequestApprovalDialog,
  ApprovalActionsDialog,
} from '@/components/quote-requests';
import {
  ArrowLeft,
  Edit,
  ShoppingCart,
  RefreshCw,
  Building2,
  Mail,
  Phone,
  Star,
  Truck,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
} from 'lucide-react';
import { QuoteStatus } from '@prisma/client';
import {
  QuoteRequestWithDetails,
  SupplierSummary,
  SupplierComparison,
} from '@/types/quote-request';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  contactPerson: string | null;
  phone: string | null;
  rating: number | null;
}

export default function QuoteRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequestWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showAdditionalSuppliers, setShowAdditionalSuppliers] = useState(false);
  const [selectedSupplierTab, setSelectedSupplierTab] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<SupplierSummary[]>([]);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRequestApprovalDialog, setShowRequestApprovalDialog] = useState(false);
  const [showApprovalActionsDialog, setShowApprovalActionsDialog] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  
  const userRole = session?.user?.role;
  const canApprove = userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'MASTER_ADMIN';
  const canConvert = userRole === 'MANAGER' || userRole === 'ADMIN' || userRole === 'MASTER_ADMIN';
  const requiresApproval = userRole === 'TECHNICIAN';

  useEffect(() => {
    fetchQuoteRequest();
    fetchSuppliers();
  }, [params.id]);

  const fetchQuoteRequest = async () => {
    try {
      const response = await fetch(`/api/quote-requests/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setQuoteRequest(data.quoteRequest);
        // Set initial tab to primary supplier if exists, or first additional supplier
        if (data.quoteRequest.supplier?.id) {
          setSelectedSupplierTab(data.quoteRequest.supplier.id);
        } else if (data.quoteRequest.additionalSuppliers?.length > 0) {
          setSelectedSupplierTab(data.quoteRequest.additionalSuppliers[0].id);
        }
      } else if (response.status === 404) {
        router.push('/customer/quote-requests');
      }
    } catch (error) {
      console.error('Error fetching quote request:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const extractPrices = async () => {
    setExtracting(true);
    setExtractionMessage(null);
    try {
      const response = await fetch(`/api/quote-requests/${params.id}/extract-prices`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        setExtractionMessage(data.message);
        // Refresh the quote request data to show updated prices
        await fetchQuoteRequest();
      } else {
        setExtractionMessage(data.error || 'Failed to extract prices');
      }
    } catch (error) {
      console.error('Error extracting prices:', error);
      setExtractionMessage('Error extracting prices from emails');
    } finally {
      setExtracting(false);
      // Clear message after 5 seconds
      setTimeout(() => setExtractionMessage(null), 5000);
    }
  };

  const updateQuoteRequest = async (updates: Partial<QuoteRequestWithDetails>) => {
    if (!quoteRequest) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/quote-requests/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        fetchQuoteRequest();
      }
    } catch (error) {
      console.error('Error updating quote request:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleSupplierSelect = (supplierId: string) => {
    updateQuoteRequest({ supplierId } as any);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          Loading quote request...
        </div>
      </div>
    );
  }

  if (!quoteRequest) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/customer/quote-requests')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          Quote request not found
        </div>
      </div>
    );
  }

  // Build supplier comparison data
  const supplierComparisons: SupplierComparison[] = [];
  if (quoteRequest.supplier) {
    const thread = quoteRequest.emailThreads.find(
      (t) => t.supplierId === quoteRequest.supplier?.id
    );
    supplierComparisons.push({
      supplierId: quoteRequest.supplier.id,
      supplierName: quoteRequest.supplier.name,
      responded: thread?.status === 'RESPONDED' || thread?.status === 'ACCEPTED',
      quotedAmount: thread?.quotedAmount || null,
      responseDate: thread?.responseDate || null,
      leadTime: null,
    });
  }
  quoteRequest.additionalSuppliers.forEach((s) => {
    const thread = quoteRequest.emailThreads.find(
      (t) => t.supplierId === s.id
    );
    supplierComparisons.push({
      supplierId: s.id,
      supplierName: s.name,
      responded: thread?.status === 'RESPONDED' || thread?.status === 'ACCEPTED',
      quotedAmount: thread?.quotedAmount || null,
      responseDate: thread?.responseDate || null,
      leadTime: null,
    });
  });

  // Build supplier responses for summary card
  const supplierResponses = supplierComparisons.map((sc) => ({
    supplier: {
      id: sc.supplierId,
      name: sc.supplierName,
      email: null,
      contactPerson: null,
      phone: null,
      rating: null,
    },
    responded: sc.responded,
  }));

  // Calculate best price
  const respondedWithPrices = supplierComparisons.filter(
    (sc) => sc.quotedAmount !== null
  );
  const bestPrice =
    respondedWithPrices.length > 0
      ? Math.min(...respondedWithPrices.map((sc) => sc.quotedAmount!))
      : null;
  const bestPriceSupplier =
    respondedWithPrices.find((sc) => sc.quotedAmount === bestPrice)
      ?.supplierName || null;

  // All suppliers for tabs
  const allSuppliers = [
    quoteRequest.supplier,
    ...quoteRequest.additionalSuppliers,
  ].filter(Boolean) as SupplierSummary[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/customer/quote-requests')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              Quote Request {quoteRequest.quoteNumber}
            </h1>
            <p className="text-muted-foreground">
              View and manage quote request details
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quoteRequest.status === 'DRAFT' && (
            <Button
              onClick={() => setShowSendDialog(true)}
              disabled={selectedSuppliers.length === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              Send to Suppliers
              {selectedSuppliers.length > 0 && ` (${selectedSuppliers.length})`}
            </Button>
          )}
          
          {/* Edit button - disabled for technicians when under review */}
          <Button 
            variant="outline" 
            onClick={() => setShowEditDialog(true)} 
            disabled={
              updating || 
              (userRole === 'TECHNICIAN' && quoteRequest.status === 'UNDER_REVIEW')
            }
            title={
              userRole === 'TECHNICIAN' && quoteRequest.status === 'UNDER_REVIEW' 
                ? 'Cannot edit quote while under review' 
                : 'Edit quote'
            }
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Quote
          </Button>
          
          {/* Approval Actions for Managers */}
          {canApprove && quoteRequest.status === 'UNDER_REVIEW' && (
            <Button onClick={() => setShowApprovalActionsDialog(true)}>
              <UserCheck className="h-4 w-4 mr-2" />
              Review Approval
            </Button>
          )}
          
          {/* Request Approval for Technicians */}
          {requiresApproval && 
           quoteRequest.status === 'RECEIVED' && 
           !quoteRequest.requiresApproval && (
            <Button onClick={() => setShowRequestApprovalDialog(true)}>
              <Clock className="h-4 w-4 mr-2" />
              Request Approval
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Approval Status Alert */}
          {quoteRequest.status === 'UNDER_REVIEW' && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                This quote is pending manager approval.
                {quoteRequest.approvalNotes && (
                  <span className="block mt-1 text-sm">
                    Note: {quoteRequest.approvalNotes}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {quoteRequest.status === 'APPROVED' && quoteRequest.approvedBy && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                Approved by {quoteRequest.approvedBy.name} on{' '}
                {formatDate(quoteRequest.approvedAt!)}
                {quoteRequest.approvalNotes && (
                  <span className="block mt-1 text-sm">
                    Note: {quoteRequest.approvalNotes}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {quoteRequest.status === 'REJECTED' && quoteRequest.approvedBy && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-900">
                Rejected by {quoteRequest.approvedBy.name} on{' '}
                {formatDate(quoteRequest.approvedAt!)}
                {quoteRequest.approvalNotes && (
                  <span className="block mt-1 text-sm font-medium">
                    Reason: {quoteRequest.approvalNotes}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Quote Request - {quoteRequest.items.length} Items
                    <QuoteStatusBadge status={quoteRequest.status} />
                  </CardTitle>
                  <CardDescription>
                    Quote Request #{quoteRequest.quoteNumber}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Suppliers & Dates */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">
                    {quoteRequest.status === 'DRAFT' ? 'Select Suppliers' : 'Suppliers'}
                  </h4>
                  {quoteRequest.status === 'DRAFT' ? (
                    <SupplierSelect
                      selectedSuppliers={selectedSuppliers}
                      onSuppliersChange={setSelectedSuppliers}
                    />
                  ) : quoteRequest.supplier ? (
                    <div className="p-3 border rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {quoteRequest.supplier.name}
                          </span>
                        </div>
                        {quoteRequest.supplier.rating && (
                          <div className="flex items-center gap-1 text-yellow-500">
                            <Star className="h-3 w-3 fill-current" />
                            <span className="text-xs">
                              {quoteRequest.supplier.rating}
                            </span>
                          </div>
                        )}
                      </div>
                      {quoteRequest.supplier.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {quoteRequest.supplier.email}
                        </div>
                      )}
                      {quoteRequest.supplier.contactPerson && (
                        <p className="text-sm text-muted-foreground">
                          Contact: {quoteRequest.supplier.contactPerson}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 border rounded-lg border-dashed">
                      <p className="text-sm text-muted-foreground">
                        No supplier assigned
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Dates</h4>
                  <div className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Requested:</span>
                      <span>{formatDate(quoteRequest.requestDate)}</span>
                    </div>
                    {quoteRequest.expiryDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Expires:</span>
                        <span>{formatDate(quoteRequest.expiryDate)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional Suppliers */}
              {quoteRequest.additionalSuppliers.length > 0 && (
                <div className="space-y-2">
                  <button
                    className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                    onClick={() =>
                      setShowAdditionalSuppliers(!showAdditionalSuppliers)
                    }
                  >
                    Additional Suppliers ({quoteRequest.additionalSuppliers.length})
                    {showAdditionalSuppliers ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {showAdditionalSuppliers && (
                    <div className="grid gap-2 md:grid-cols-2">
                      {quoteRequest.additionalSuppliers.map((s) => (
                        <div
                          key={s.id}
                          className="p-2 border rounded-lg text-sm"
                        >
                          <p className="font-medium">{s.name}</p>
                          {s.email && (
                            <p className="text-muted-foreground text-xs">
                              {s.email}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Vehicle */}
              {quoteRequest.vehicle && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Vehicle</h4>
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {quoteRequest.vehicle.make} {quoteRequest.vehicle.model}
                        {quoteRequest.vehicle.year &&
                          ` (${quoteRequest.vehicle.year})`}
                      </span>
                    </div>
                    {quoteRequest.vehicle.vehicleId && (
                      <p className="text-sm text-muted-foreground mt-1">
                        ID: {quoteRequest.vehicle.vehicleId}
                      </p>
                    )}
                    {quoteRequest.vehicle.serialNumber && (
                      <p className="text-sm text-muted-foreground">
                        Serial: {quoteRequest.vehicle.serialNumber}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Extract Prices Button */}
              {quoteRequest.status !== 'DRAFT' && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={extractPrices}
                    disabled={extracting || loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${extracting ? 'animate-spin' : ''}`} />
                    {extracting ? 'Extracting Prices...' : 'Extract Prices from Emails'}
                  </Button>
                  {extractionMessage && (
                    <p className={`text-sm ${extractionMessage.includes('Error') || extractionMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                      {extractionMessage}
                    </p>
                  )}
                </div>
              )}

              {/* Quote Items - Show comparison table if quotes received, otherwise simple table */}
              {quoteRequest.status === 'DRAFT' ? (
                <QuoteItemsTable
                  items={quoteRequest.items}
                  showPrices={false}
                  editable={true}
                  quoteRequestId={quoteRequest.id}
                  onItemsUpdated={fetchQuoteRequest}
                />
              ) : (
                <>
                  {/* Supplier Price Comparison Table */}
                  <SupplierPriceComparisonTable
                    items={quoteRequest.items}
                    suppliers={allSuppliers}
                    quoteRequestId={quoteRequest.id}
                    quoteNumber={quoteRequest.quoteNumber}
                    quoteStatus={quoteRequest.status}
                    emailThreads={quoteRequest.emailThreads}
                    userRole={userRole}
                    requiresApproval={quoteRequest.requiresApproval}
                    createdByRole={quoteRequest.createdBy?.role}
                    selectedSupplierId={quoteRequest.selectedSupplierId}
                    onOrderCreated={() => {
                      fetchQuoteRequest();
                      router.refresh();
                    }}
                  />

                  {/* Also show simple items table for reference */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 group-open:rotate-180 transition-transform" />
                      View Simple Items List
                    </summary>
                    <div className="mt-4">
                      <QuoteItemsTable
                        items={quoteRequest.items}
                        showPrices={true}
                      />
                    </div>
                  </details>
                </>
              )}

              {/* Supplier Tabs & Communication History */}
              {allSuppliers.length > 0 && quoteRequest.status !== 'DRAFT' && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Supplier Communication</h4>
                  <Tabs
                    value={selectedSupplierTab || allSuppliers[0]?.id}
                    onValueChange={setSelectedSupplierTab}
                  >
                    <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
                      {allSuppliers.map((s) => {
                        const thread = quoteRequest.emailThreads.find(
                          (t) => t.supplierId === s.id
                        );
                        const hasResponse = thread?.status === 'RESPONDED' || thread?.status === 'ACCEPTED';
                        return (
                          <TabsTrigger
                            key={s.id}
                            value={s.id}
                            className="flex items-center gap-2"
                          >
                            {s.name}
                            {hasResponse && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                Responded
                              </Badge>
                            )}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                    {allSuppliers.map((s) => {
                      const thread = quoteRequest.emailThreads.find(
                        (t) => t.supplierId === s.id
                      );
                      return (
                        <TabsContent key={s.id} value={s.id} className="space-y-4">
                          {/* Supplier Info Card */}
                          <div className="p-3 border rounded-lg space-y-2 bg-muted/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{s.name}</span>
                              </div>
                              {s.rating && (
                                <div className="flex items-center gap-1 text-yellow-500">
                                  <Star className="h-3 w-3 fill-current" />
                                  <span className="text-xs">{s.rating}</span>
                                </div>
                              )}
                            </div>
                            {s.email && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {s.email}
                              </div>
                            )}
                            {s.contactPerson && (
                              <p className="text-sm text-muted-foreground">
                                Contact: {s.contactPerson}
                              </p>
                            )}
                            {thread?.quotedAmount && (
                              <div className="pt-2 border-t">
                                <span className="text-sm text-muted-foreground">Quoted Amount: </span>
                                <span className="font-semibold text-green-700">
                                  {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                  }).format(thread.quotedAmount)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Communication History for this supplier */}
                          <CommunicationHistory
                            emailThreads={quoteRequest.emailThreads.filter(
                              (t) => t.supplierId === s.id
                            )}
                            selectedSupplierId={s.id}
                            quoteRequestId={quoteRequest.id}
                            currentUserId={session?.user?.id || ''}
                            currentUserRole={session?.user?.role || 'USER'}
                            quoteCreatedById={quoteRequest.createdBy.id}
                            quoteStatus={quoteRequest.status}
                            onRefresh={fetchQuoteRequest}
                          />
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </div>
              )}

              {/* Show communication without tabs for DRAFT status */}
              {quoteRequest.status === 'DRAFT' && quoteRequest.emailThreads.length > 0 && (
                <CommunicationHistory
                  emailThreads={quoteRequest.emailThreads}
                  selectedSupplierId={selectedSupplierTab || undefined}
                  quoteRequestId={quoteRequest.id}
                  currentUserId={session?.user?.id || ''}
                  currentUserRole={session?.user?.role || 'USER'}
                  quoteCreatedById={quoteRequest.createdBy.id}
                  quoteStatus={quoteRequest.status}
                  onRefresh={fetchQuoteRequest}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary & Comparison */}
        <div className="space-y-6">
          <QuoteSummaryCard
            status={quoteRequest.status}
            supplierResponses={supplierResponses}
            itemCount={quoteRequest.items.length}
            bestPrice={bestPrice}
            bestPriceSupplier={bestPriceSupplier}
            createdBy={quoteRequest.createdBy}
            createdOn={quoteRequest.createdAt}
          />

          <SupplierComparisonCard suppliers={supplierComparisons} />
        </div>
      </div>

      {/* Send Quote Dialog */}
      <SendQuoteDialog
        open={showSendDialog}
        onOpenChange={setShowSendDialog}
        quoteRequestId={quoteRequest.id}
        suppliers={selectedSuppliers}
        onSent={() => {
          fetchQuoteRequest();
          setSelectedSuppliers([]);
        }}
      />

      {/* Edit Quote Dialog */}
      <EditQuoteDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        quoteRequestId={quoteRequest.id}
        currentItems={quoteRequest.items}
        status={quoteRequest.status}
        onSaved={() => {
          fetchQuoteRequest();
        }}
      />
      
      {/* Request Approval Dialog */}
      <RequestApprovalDialog
        open={showRequestApprovalDialog}
        onOpenChange={setShowRequestApprovalDialog}
        quoteRequestId={quoteRequest.id}
        quoteNumber={quoteRequest.quoteNumber}
        onSuccess={fetchQuoteRequest}
      />
      
      {/* Approval Actions Dialog */}
      <ApprovalActionsDialog
        open={showApprovalActionsDialog}
        onOpenChange={setShowApprovalActionsDialog}
        quoteRequestId={quoteRequest.id}
        quoteNumber={quoteRequest.quoteNumber}
        requestedBy={quoteRequest.createdBy.name || quoteRequest.createdBy.email || 'Unknown'}
        totalAmount={quoteRequest.totalAmount ? Number(quoteRequest.totalAmount) : undefined}
        suppliers={allSuppliers
          .map(supplier => {
            const thread = quoteRequest.emailThreads.find(
              t => t.supplierId === supplier.id && (t.status === 'RESPONDED' || t.status === 'ACCEPTED')
            );
            if (!thread) return null;
            
            return {
              id: supplier.id,
              name: supplier.name,
              totalAmount: thread.quotedAmount ? Number(thread.quotedAmount) : undefined,
            };
          })
          .filter(Boolean) as { id: string; name: string; totalAmount?: number }[]
        }
        onSuccess={fetchQuoteRequest}
      />
    </div>
  );
}
