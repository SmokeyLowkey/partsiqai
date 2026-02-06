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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Loader2,
  Sparkles,
  Mail,
  Package,
  AlertCircle,
  Check,
  RefreshCw,
  Truck,
} from 'lucide-react';

interface OrderConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string | null;
  onSent: () => void;
}

export function OrderConfirmationDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  supplierId,
  supplierName,
  supplierEmail,
  onSent,
}: OrderConfirmationDialogProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setSuccess(false);
      setError(null);
      generateConfirmation();
    }
  }, [open, orderId, supplierId]);

  const generateConfirmation = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/orders/${orderId}/generate-confirmation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplierId }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate confirmation email');
      }

      const data = await response.json();
      setSubject(data.email.subject);
      setBody(data.email.body);
    } catch (error: any) {
      console.error('Error generating confirmation:', error);
      setError(error.message || 'Failed to generate email. You can still write it manually.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Please enter both subject and message');
      return;
    }

    if (!supplierEmail) {
      setError('Supplier does not have an email address');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/orders/${orderId}/send-confirmation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId,
            subject,
            body,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send confirmation');
      }

      setSuccess(true);

      // Close dialog and refresh after short delay
      setTimeout(() => {
        onOpenChange(false);
        onSent();
      }, 2000);
    } catch (error: any) {
      console.error('Error sending confirmation:', error);
      setError(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Send Order Confirmation
          </DialogTitle>
          <DialogDescription>
            Send an order confirmation email to <strong>{supplierName}</strong> requesting
            shipment tracking information and logistics details.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <Alert className="bg-green-50 text-green-900 border-green-200">
            <Check className="h-4 w-4" />
            <AlertDescription>
              Order confirmation sent successfully! The supplier has been notified.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Email Preview */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>
                  To: {supplierEmail || 'No email on file'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4" />
                <span className="font-medium">Order #{orderNumber}</span>
              </div>
            </div>

            {generating && (
              <Alert>
                <Sparkles className="h-4 w-4 animate-pulse" />
                <AlertDescription>
                  Generating order confirmation email...
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Order Confirmation - Tracking Information Needed"
                disabled={generating || sending}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Message</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateConfirmation}
                  disabled={generating || sending}
                  className="h-8"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${generating ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
              </div>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Your order confirmation message..."
                disabled={generating || sending}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            {/* Info Box */}
            <Alert>
              <Truck className="h-4 w-4" />
              <AlertDescription>
                This email will be sent via the existing email thread. The supplier will be asked
                to provide tracking numbers, estimated delivery dates, and any shipping details.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={generating || sending || success || !subject.trim() || !body.trim()}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Confirmation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
