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
} from 'lucide-react';
import { SupplierSummary } from '@/types/quote-request';

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
  const [supplierEmails, setSupplierEmails] = useState<SupplierEmail[]>([]);
  const [activeSupplier, setActiveSupplier] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<Array<{
    supplierId: string;
    success: boolean;
    error?: string;
  }> | null>(null);

  useEffect(() => {
    if (open && suppliers.length > 0) {
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
      setError(null);

      // Generate email content
      generateEmail();
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

  const handleSend = async () => {
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Quote Request
          </DialogTitle>
          <DialogDescription>
            Review and customize the quote request email for each supplier before
            sending.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {sendResults && (
          <Alert
            variant={
              sendResults.every((r) => r.success) ? 'default' : 'destructive'
            }
            className={
              sendResults.every((r) => r.success)
                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                : ''
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

        {generating ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 inline mr-1" />
                Generating quote request email...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Supplier Tabs */}
            <Tabs value={activeSupplier} onValueChange={setActiveSupplier}>
              <div className="flex items-center justify-between mb-2">
                <TabsList>
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
                <Badge variant="outline">
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
                      className="min-h-[300px] font-mono text-sm"
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
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={generating || sending || sendResults?.every((r) => r.success)}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {supplierEmails.length} Supplier
                {supplierEmails.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
