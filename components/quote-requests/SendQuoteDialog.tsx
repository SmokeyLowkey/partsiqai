'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Send,
  Loader2,
  Sparkles,
  Mail,
  Building2,
  Check,
  AlertCircle,
  Copy,
  Phone,
  ArrowRight,
} from 'lucide-react';
import { SupplierSummary } from '@/types/quote-request';
import { SupplierMethodSelector, ContactMethod } from './SupplierMethodSelector';

interface SupplierEmail {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
}

interface SendQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRequestId: string;
  suppliers: SupplierSummary[];
  onSent: () => void;
}

export function SendQuoteDialog({
  open,
  onOpenChange,
  quoteRequestId,
  suppliers,
  onSent,
}: SendQuoteDialogProps) {
  const [step, setStep] = useState<'method' | 'content'>('method');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('email');
  const [supplierEmails, setSupplierEmails] = useState<SupplierEmail[]>([]);
  const [activeSupplier, setActiveSupplier] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<Array<{
    supplierId: string;
    success: boolean;
    error?: string;
  }> | null>(null);
  const [callResults, setCallResults] = useState<Array<{
    supplierId: string;
    supplierName: string;
    callId?: string;
    error?: string;
  }> | null>(null);

  useEffect(() => {
    if (open && suppliers.length > 0) {
      // Reset to method selection
      setStep('method');
      setContactMethod('email');
      
      // Initialize supplier emails
      const initialEmails = suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email || '',
        subject: '',
        body: '',
      }));
      setSupplierEmails(initialEmails);
      setActiveSupplier(suppliers[0].id);
      setSendResults(null);
      setCallResults(null);
      setError(null);
    }
  }, [open, suppliers]);

  const generateEmail = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/quote-requests/${quoteRequestId}/generate-email`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to generate email');
      }

      const data = await response.json();

      // Apply generated email to all suppliers
      setSupplierEmails((prev) =>
        prev.map((se) => ({
          ...se,
          subject: data.email.subject,
          body: data.email.body,
        }))
      );
    } catch (error: any) {
      console.error('Error generating email:', error);
      setError('Failed to generate email. You can still write it manually.');
    } finally {
      setGenerating(false);
    }
  };

  const updateSupplierEmail = (
    supplierId: string,
    field: 'subject' | 'body' | 'email',
    value: string
  ) => {
    setSupplierEmails((prev) =>
      prev.map((se) =>
        se.id === supplierId ? { ...se, [field]: value } : se
      )
    );
  };

  const copyToAll = (field: 'subject' | 'body') => {
    const activeEmail = supplierEmails.find((se) => se.id === activeSupplier);
    if (activeEmail) {
      setSupplierEmails((prev) =>
        prev.map((se) => ({
          ...se,
          [field]: activeEmail[field],
        }))
      );
    }
  };

  const handleMethodContinue = () => {
    setStep('content');
    // Generate email content when moving to content step
    if (contactMethod !== 'call') {
      generateEmail();
    }
  };

  const handleInitiateCalls = async () => {
    setCalling(true);
    setError(null);

    try {
      // Get suppliers with phone numbers
      const suppliersWithPhone = suppliers.filter(
        (s) => s.phone && !(s as any).doNotCall
      );

      if (suppliersWithPhone.length === 0) {
        setError('No suppliers available to call');
        return;
      }

      const response = await fetch(
        `/api/quote-requests/${quoteRequestId}/initiate-call`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierIds: suppliersWithPhone.map((s) => s.id),
            contactMethod: contactMethod, // Pass the actual contact method
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate calls');
      }

      // Calls are now processing in the background
      setCallResults(data.jobs.map((job: any) => ({
        supplierId: job.supplierId,
        supplierName: job.supplierName,
        jobId: job.jobId,
        status: job.status,
        error: job.error,
      })));

      // Show success message for queued calls
      const successCount = data.jobs.filter((j: any) => j.jobId).length;
      if (successCount > 0) {
        setError(null);
        // Close dialog after showing results briefly if call-only mode
        if (contactMethod === 'call') {
          setTimeout(() => {
            onOpenChange(false);
            onSent();
          }, 2500);
        }
      }
    } catch (error: any) {
      console.error('Error initiating calls:', error);
      setError(error.message);
    } finally {
      setCalling(false);
    }
  };

  const handleSend = async () => {
    // Handle calling first if needed
    if (contactMethod === 'call' || contactMethod === 'both') {
      await handleInitiateCalls();
      
      // If call-only, we're done
      if (contactMethod === 'call') {
        return;
      }
    }

    // Handle email sending
    // Validate all suppliers have email addresses and content
    const missingEmails = supplierEmails.filter((se) => !se.email);
    if (missingEmails.length > 0) {
      setError(
        `Missing email addresses for: ${missingEmails.map((se) => se.name).join(', ')}`
      );
      return;
    }

    const missingContent = supplierEmails.filter(
      (se) => !se.subject || !se.body
    );
    if (missingContent.length > 0) {
      setError(
        `Missing email content for: ${missingContent.map((se) => se.name).join(', ')}`
      );
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/quote-requests/${quoteRequestId}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suppliers: supplierEmails.map((se) => ({
              id: se.id,
              email: se.email,
              subject: se.subject,
              body: se.body,
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send quote request');
      }

      setSendResults(data.results);

      // Check if all were successful
      const allSuccess = data.results.every((r: any) => r.success);
      if (allSuccess) {
        // Close dialog and refresh
        setTimeout(() => {
          onOpenChange(false);
          onSent();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error sending quote request:', error);
      setError(error.message);
    } finally {
      setSending(false);
    }
  };

  const activeEmailData = supplierEmails.find(
    (se) => se.id === activeSupplier
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {step === 'method' ? (
              <>
                <Building2 className="h-5 w-5" />
                Contact Method
              </>
            ) : (
              <>
                <Mail className="h-5 w-5" />
                Send Quote Request
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 'method'
              ? 'Choose how to contact suppliers for this quote request'
              : 'Review and customize the quote request email for each supplier'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {callResults && (
          <Alert
            variant={
              callResults.every((c) => 'jobId' in c ||'callId' in c) ? 'default' : 'destructive'
            }
            className={
              callResults.every((c) => 'jobId' in c || 'callId' in c)
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 flex-shrink-0'
                : 'flex-shrink-0'
            }
          >
            <Phone className="h-4 w-4" />
            <AlertDescription>
              {callResults.filter((c) => 'jobId' in c || 'callId' in c).length > 0 ? (
                <span>
                  Queued {callResults.filter((c) => 'jobId' in c || 'callId' in c).length} call(s) for background processing. 
                  Check the quote request details page for live call status updates.
                </span>
              ) : (
                <span>No calls were queued.</span>
              )}
              {callResults.some((c) => 'error' in c) && (
                <span className="block mt-1 text-red-500">
                  Failed:{' '}
                  {callResults
                    .filter((c) => 'error' in c)
                    .map((c) => c.supplierName)
                    .join(', ')}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {sendResults && (
          <Alert
            variant={
              sendResults.every((r) => r.success) ? 'default' : 'destructive'
            }
            className={
              sendResults.every((r) => r.success)
                ? 'border-green-500 bg-green-50 dark:bg-green-950 flex-shrink-0'
                : 'flex-shrink-0'
            }
          >
            <Check className="h-4 w-4" />
            <AlertDescription>
              Sent to {sendResults.filter((r) => r.success).length} of{' '}
              {sendResults.length} suppliers.
              {sendResults.some((r) => !r.success) && (
                <span className="block mt-1 text-red-500">
                  Failed:{' '}
                  {sendResults
                    .filter((r) => !r.success)
                    .map(
                      (r) =>
                        supplierEmails.find((se) => se.id === r.supplierId)
                          ?.name
                    )
                    .join(', ')}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Method Selection Step */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {step === 'method' && !sendResults && !callResults && (
            <SupplierMethodSelector
            suppliers={suppliers.map((s) => ({
              id: s.id,
              name: s.name,
              email: s.email,
              phone: s.phone,
              doNotCall: (s as any).doNotCall,
              callWindowStart: (s as any).callWindowStart,
              callWindowEnd: (s as any).callWindowEnd,
              timezone: (s as any).timezone,
            }))}
            defaultMethod="email"
            onChange={setContactMethod}
          />
        )}

        {/* Email Content Step */}
        {step === 'content' && generating ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 inline mr-1" />
                Generating quote request email...
              </p>
            </div>
          </div>
        ) : step === 'content' ? (
          <>
            {/* Supplier Tabs */}
            <Tabs value={activeSupplier} onValueChange={setActiveSupplier}>
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex-1 overflow-x-auto">
                  <TabsList className="w-max">
                    {supplierEmails.map((se) => (
                      <TabsTrigger
                        key={se.id}
                        value={se.id}
                        className="flex items-center gap-1"
                      >
                        <Building2 className="h-3 w-3" />
                        {se.name}
                        {sendResults?.find((r) => r.supplierId === se.id)
                          ?.success && (
                          <Check className="h-3 w-3 text-green-500" />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                <Badge variant="outline" className="flex-shrink-0">
                  {supplierEmails.length} supplier
                  {supplierEmails.length > 1 ? 's' : ''}
                </Badge>
              </div>

              {supplierEmails.map((se) => (
                <TabsContent key={se.id} value={se.id} className="space-y-4">
                  {/* To Email */}
                  <div className="space-y-2">
                    <Label htmlFor={`email-${se.id}`}>To</Label>
                    <Input
                      id={`email-${se.id}`}
                      type="email"
                      value={se.email}
                      onChange={(e) =>
                        updateSupplierEmail(se.id, 'email', e.target.value)
                      }
                      placeholder="supplier@example.com"
                    />
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`subject-${se.id}`}>Subject</Label>
                      {supplierEmails.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToAll('subject')}
                          className="h-6 text-xs"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy to all
                        </Button>
                      )}
                    </div>
                    <Input
                      id={`subject-${se.id}`}
                      value={se.subject}
                      onChange={(e) =>
                        updateSupplierEmail(se.id, 'subject', e.target.value)
                      }
                      placeholder="Quote Request..."
                    />
                  </div>

                  {/* Body */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`body-${se.id}`}>Message</Label>
                      {supplierEmails.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToAll('body')}
                          className="h-6 text-xs"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy to all
                        </Button>
                      )}
                    </div>
                    <Textarea
                      id={`body-${se.id}`}
                      value={se.body}
                      onChange={(e) =>
                        updateSupplierEmail(se.id, 'body', e.target.value)
                      }
                      placeholder="Enter your message..."
                      className="min-h-[180px] font-mono text-sm"
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Regenerate Button */}
            <div className="flex justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={generateEmail}
                disabled={generating}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate with AI
              </Button>
            </div>
          </>
        ) : null}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          {step === 'method' && (
            <Button
              onClick={handleMethodContinue}
              disabled={!contactMethod}
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          
          {step === 'content' && (
            <Button
              onClick={handleSend}
              disabled={generating || sending || calling || sendResults?.every((r) => r.success)}
            >
              {calling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calling...
                </>
              ) : sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : contactMethod === 'call' ? (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Call {suppliers.filter(s => s.phone && !(s as any).doNotCall).length} Supplier
                  {suppliers.filter(s => s.phone && !(s as any).doNotCall).length > 1 ? 's' : ''}
                </>
              ) : contactMethod === 'both' ? (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send & Call {supplierEmails.length} Supplier
                  {supplierEmails.length > 1 ? 's' : ''}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to {supplierEmails.length} Supplier
                  {supplierEmails.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
