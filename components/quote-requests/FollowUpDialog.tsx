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
  Clock,
  AlertCircle,
  Check,
  RefreshCw,
} from 'lucide-react';

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRequestId: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string | null;
  onSent: () => void;
}

export function FollowUpDialog({
  open,
  onOpenChange,
  quoteRequestId,
  supplierId,
  supplierName,
  supplierEmail,
  onSent,
}: FollowUpDialogProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [context, setContext] = useState<{
    daysSinceOriginal: number;
    previousFollowUps: number;
    originalSubject: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setSuccess(false);
      setError(null);
      generateFollowUp();
    }
  }, [open, quoteRequestId, supplierId]);

  const generateFollowUp = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/quote-requests/${quoteRequestId}/generate-follow-up`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplierId }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate follow-up');
      }

      const data = await response.json();
      setSubject(data.email.subject);
      setBody(data.email.body);
      setContext(data.context);
    } catch (error: any) {
      console.error('Error generating follow-up:', error);
      setError(error.message || 'Failed to generate follow-up. You can still write it manually.');
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
        `/api/quote-requests/${quoteRequestId}/follow-up`,
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
        throw new Error(data.error || 'Failed to send follow-up');
      }

      setSuccess(true);

      // Close dialog and refresh after short delay
      setTimeout(() => {
        onOpenChange(false);
        onSent();
      }, 2000);
    } catch (error: any) {
      console.error('Error sending follow-up:', error);
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
            <Mail className="h-5 w-5" />
            Send Follow-Up to {supplierName}
          </DialogTitle>
          <DialogDescription>
            Review and customize the follow-up email before sending.
          </DialogDescription>
        </DialogHeader>

        {/* Context Info */}
        {context && (
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {context.daysSinceOriginal} days since original
            </Badge>
            {context.previousFollowUps > 0 && (
              <Badge variant="secondary">
                {context.previousFollowUps} previous follow-up
                {context.previousFollowUps > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              Follow-up sent successfully to {supplierEmail}
            </AlertDescription>
          </Alert>
        )}

        {generating ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 inline mr-1" />
                Generating follow-up email...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* To Email (read-only) */}
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                value={supplierEmail || 'No email address'}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="follow-up-subject">Subject</Label>
              <Input
                id="follow-up-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Re: Quote Request..."
                disabled={sending || success}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="follow-up-body">Message</Label>
              <Textarea
                id="follow-up-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter your follow-up message..."
                className="min-h-[250px] font-mono text-sm"
                disabled={sending || success}
              />
            </div>

            {/* Regenerate Button */}
            <div className="flex justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={generateFollowUp}
                disabled={generating || sending || success}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
                Regenerate with AI
              </Button>
            </div>
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
            disabled={generating || sending || success || !supplierEmail}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : success ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Sent
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Follow-Up
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
