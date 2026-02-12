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
  
  // Call settings state
  const [callContext, setCallContext] = useState<string>('');
  const [agentInstructions, setAgentInstructions] = useState<string>('');
  const [generatingCallSettings, setGeneratingCallSettings] = useState(false);

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
      
      // Reset call settings
      setCallContext('');
      setAgentInstructions('');
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

  const generateCallSettings = async () => {
    setGeneratingCallSettings(true);
    setError(null);

    try {
      // Generate default call context and agent instructions
      const response = await fetch(
        `/api/quote-requests/${quoteRequestId}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch quote request details');
      }

      const data = await response.json();
      const qr = data.quoteRequest;

      // Build detailed vehicle context
      const vehicle = qr.vehicle;
      let vehicleContext = '';
      if (vehicle) {
        vehicleContext = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim();
        if (vehicle.serialNumber) {
          vehicleContext += ` (Serial: ${vehicle.serialNumber})`;
        }
      }

      // Build detailed parts list
      const items = qr.items || [];
      let partsDetails = '';
      if (items.length > 0) {
        partsDetails = items
          .filter((item: any) => item.partNumber !== 'MISC-COSTS')
          .map((item: any, index: number) => {
            const qty = item.quantity > 1 ? ` (Qty: ${item.quantity})` : '';
            const desc = item.description ? ` - ${item.description}` : '';
            return `${index + 1}. ${item.partNumber}${desc}${qty}`;
          })
          .join('\n');
      }

      // Build structured context - provide FACTS for the AI to use naturally, NOT a script
      const orgName = qr.organization?.name || 'our company';
      const requestNum = qr.requestNumber || qr.id.slice(0, 8);
      
      let context = `Company: ${orgName}\n`;
      context += `Quote Request: #${requestNum}\n`;
      
      if (vehicleContext) {
        context += `Vehicle: ${vehicleContext}\n`;
      }
      
      if (items.length > 0) {
        const partsCount = items.filter((item: any) => item.partNumber !== 'MISC-COSTS').length;
        context += `\nParts Needed (${partsCount} part${partsCount > 1 ? 's' : ''}):\n`;
        
        if (partsDetails) {
          context += partsDetails;
        }
      }
      
      // Generate natural, conversational agent instructions
      const instructions = `You are a real person calling on behalf of ${orgName} to get quotes for parts. Be natural, friendly, and conversational.

IMPORTANT - Follow this conversation flow:
1. FIRST: Greet them naturally ("Hi, this is [your name] calling from ${orgName}") and ask if you've reached the parts department or if they can transfer you
2. WAIT for their response - they may transfer you or confirm you're speaking to the right person
3. ONLY AFTER confirming you're with the right department: Explain you're calling about parts for the vehicle listed in the context${vehicleContext ? ` (${vehicleContext})` : ''}
4. Ask if they can provide pricing and availability over the phone
5. If yes, go through the parts list conversationally - don't just read it like a robot
6. Ask for lead times and any minimum order requirements
7. If they can't help by phone, politely ask for their preferred contact method (email, fax, online portal)

Conversation tips:
- Use natural pauses and transitions like "Great, thanks" or "Perfect"
- If they ask questions, answer them naturally before continuing
- If they need you to slow down or repeat something, do so patiently
- Thank them for their time at the end
- Don't rush through the information - speak at a normal, conversational pace`;

      setCallContext(context);
      setAgentInstructions(instructions);
    } catch (error: any) {
      console.error('Error generating call settings:', error);
      setError('Failed to generate call settings. You can enter them manually.');
    } finally {
      setGeneratingCallSettings(false);
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
    // Generate appropriate content based on contact method
    if (contactMethod === 'email') {
      generateEmail();
    } else if (contactMethod === 'call') {
      generateCallSettings();
    } else if (contactMethod === 'both') {
      // Generate both email and call settings
      generateEmail();
      generateCallSettings();
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
            contactMethod: contactMethod,
            callContext: callContext || undefined,
            agentInstructions: agentInstructions || undefined,
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
      // Validate call settings
      if (!callContext.trim()) {
        setError('Call context is required');
        return;
      }
      
      await handleInitiateCalls();
      
      // If call-only, we're done
      if (contactMethod === 'call') {
        return;
      }
    }

    // Handle email sending (for 'email' or 'both' methods)
    if (contactMethod === 'email' || contactMethod === 'both') {
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
            ) : contactMethod === 'call' ? (
              <>
                <Phone className="h-5 w-5" />
                Configure Call Settings
              </>
            ) : contactMethod === 'both' ? (
              <>
                <Send className="h-5 w-5" />
                Configure Email & Call
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
              : contactMethod === 'call'
              ? 'Configure settings for AI agent calls to suppliers'
              : contactMethod === 'both'
              ? 'Set up email content and call settings for suppliers'
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
              callResults.every((c) => 'jobId' in c || 'callId' in c)
                ? 'default'
                : callResults.some((c) => 'jobId' in c || 'callId' in c)
                ? 'default' // Partial success
                : 'destructive' // Total failure
            }
            className={
              callResults.every((c) => 'jobId' in c || 'callId' in c)
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 flex-shrink-0'
                : callResults.some((c) => 'jobId' in c || 'callId' in c)
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950 flex-shrink-0' // Partial success - amber/warning
                : 'flex-shrink-0' // Total failure - red
            }
          >
            <Phone className="h-4 w-4" />
            <AlertDescription>
              {callResults.filter((c) => 'jobId' in c || 'callId' in c).length > 0 ? (
                <span>
                  Queued {callResults.filter((c) => 'jobId' in c || 'callId' in c).length} of {callResults.length} call(s) for background processing. 
                  Check the quote request details page for live call status updates.
                </span>
              ) : (
                <span>No calls were queued successfully.</span>
              )}
              {callResults.some((c) => 'error' in c) && (
                <div className="mt-2 space-y-1">
                  {callResults
                    .filter((c) => 'error' in c)
                    .map((c, idx) => (
                      <div key={idx} className="text-sm text-amber-600 dark:text-amber-400">
                        <span className="font-medium">{c.supplierName}:</span>{' '}
                        {c.error || 'Unknown error'}
                      </div>
                    ))}
                </div>
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
        {step === 'content' && (generating || generatingCallSettings) ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 inline mr-1" />
                {generating && generatingCallSettings
                  ? 'Generating email and call settings...'
                  : generating
                  ? 'Generating quote request email...'
                  : 'Generating call settings...'}
              </p>
            </div>
          </div>
        ) : step === 'content' ? (
          <>
            {/* Call Settings Section (for 'call' or 'both') */}
            {(contactMethod === 'call' || contactMethod === 'both') && (
              <div className="space-y-4 mb-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    AI Call Agent Settings
                  </h3>
                </div>

                {/* Call Context */}
                <div className="space-y-2">
                  <Label htmlFor="call-context">Call Context</Label>
                  <Textarea
                    id="call-context"
                    value={callContext}
                    onChange={(e) => setCallContext(e.target.value)}
                    placeholder="Brief context about this quote request for the AI agent..."
                    className="min-h-[80px] bg-white dark:bg-gray-900"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide context about the quote request (vehicle, parts needed, urgency, etc.)
                  </p>
                </div>

                {/* Agent Instructions */}
                <div className="space-y-2">
                  <Label htmlFor="agent-instructions">Agent Instructions</Label>
                  <Textarea
                    id="agent-instructions"
                    value={agentInstructions}
                    onChange={(e) => setAgentInstructions(e.target.value)}
                    placeholder="Special instructions for the AI agent during the call..."
                    className="min-h-[100px] bg-white dark:bg-gray-900"
                  />
                  <p className="text-xs text-muted-foreground">
                    Customize how the AI agent should conduct the call (tone, specific questions, etc.)
                  </p>
                </div>

                {/* Regenerate Call Settings */}
                <div className="flex justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateCallSettings}
                    disabled={generatingCallSettings}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Regenerate Call Settings
                  </Button>
                </div>
              </div>
            )}

            {/* Email Section (for 'email' or 'both') */}
            {(contactMethod === 'email' || contactMethod === 'both') && (
              <>
                {contactMethod === 'both' && (
                  <div className="flex items-center gap-2 mb-4 p-3 border rounded-lg bg-green-50 dark:bg-green-950">
                    <Mail className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                      Email Content
                    </h3>
                  </div>
                )}
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
                Regenerate Email with AI
              </Button>
            </div>
              </>
            )}
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
