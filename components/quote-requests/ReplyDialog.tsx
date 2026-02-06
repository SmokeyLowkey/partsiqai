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
  AlertCircle,
  Check,
  RefreshCw,
  DollarSign,
  Package,
  MessageSquare,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailThreadId: string;
  messageId: string; // The inbound message we're replying to
  supplierName: string;
  supplierEmail: string;
  originalSubject: string;
  originalBody: string;
  quoteRequestId: string;
  onSent: () => void;
}

type ReplyScenario = 'general' | 'price_negotiation' | 'add_parts' | 'availability';

export function ReplyDialog({
  open,
  onOpenChange,
  emailThreadId,
  messageId,
  supplierName,
  supplierEmail,
  originalSubject,
  originalBody,
  quoteRequestId,
  onSent,
}: ReplyDialogProps) {
  const [scenario, setScenario] = useState<ReplyScenario>('general');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setSuccess(false);
      setError(null);
      setBody(''); // Clear body on open
      setAdditionalContext(''); // Clear context
      // Set default subject with Re: prefix
      const replySubject = originalSubject.startsWith('Re:')
        ? originalSubject
        : `Re: ${originalSubject}`;
      setSubject(replySubject);
      
      // Don't auto-generate - let user fill out info first
    }
  }, [open, messageId]);

  const generateReply = async (replyScenario?: ReplyScenario) => {
    const targetScenario = replyScenario || scenario;
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/email-threads/${emailThreadId}/generate-reply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            scenario: targetScenario,
            additionalContext: additionalContext.trim() || undefined,
            quoteRequestId,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate reply');
      }

      const data = await response.json();
      setSubject(data.email.subject);
      setBody(data.email.body);
    } catch (error: any) {
      console.error('Error generating reply:', error);
      setError(error.message || 'Failed to generate reply. You can still write it manually.');
    } finally {
      setGenerating(false);
    }
  };

  const handleScenarioChange = (newScenario: ReplyScenario) => {
    setScenario(newScenario);
    // Don't auto-generate - let user click Generate button
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Please enter both subject and message');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/email-threads/${emailThreadId}/reply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            subject,
            body,
            quoteRequestId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Check if authentication expired
        if (data.code === 'AUTH_EXPIRED' || data.requiresReauth) {
          throw new Error('Gmail authentication expired. Please go to Settings → Integrations to reconnect your Gmail account.');
        }
        throw new Error(data.error || 'Failed to send reply');
      }

      setSuccess(true);

      // Close dialog and refresh after short delay
      setTimeout(() => {
        onOpenChange(false);
        onSent();
      }, 2000);
    } catch (error: any) {
      console.error('Error sending reply:', error);
      setError(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Reply to {supplierName}
          </DialogTitle>
          <DialogDescription>
            Respond to the supplier's message. Choose a reply type or write a custom response.
          </DialogDescription>
        </DialogHeader>

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
              Reply sent successfully to {supplierEmail}
            </AlertDescription>
          </Alert>
        )}

        {/* Original Message Preview */}
        <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Original Message from {supplierName}
          </div>
          <div className="text-sm text-muted-foreground border-l-2 pl-3 max-h-32 overflow-y-auto">
            {originalBody.slice(0, 300)}
            {originalBody.length > 300 && '...'}
          </div>
        </div>

        {generating ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 inline mr-1" />
                Generating reply...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Reply Scenario Selector */}
            <div className="space-y-2">
              <Label>Reply Type</Label>
              <Select
                value={scenario}
                onValueChange={(value) => handleScenarioChange(value as ReplyScenario)}
                disabled={sending || success}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      General Response
                    </div>
                  </SelectItem>
                  <SelectItem value="price_negotiation">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Price Negotiation
                    </div>
                  </SelectItem>
                  <SelectItem value="add_parts">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Add Parts to Quote
                    </div>
                  </SelectItem>
                  <SelectItem value="availability">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Request Availability Update
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {scenario === 'price_negotiation' && 'Request a better price or discuss payment terms'}
                {scenario === 'add_parts' && 'Ask the supplier to add more parts to their quote'}
                {scenario === 'availability' && 'Request updated lead time or stock availability'}
                {scenario === 'general' && 'Respond to their message or ask questions'}
              </p>
            </div>

            {/* Additional Context (conditional) */}
            {(scenario === 'price_negotiation' || scenario === 'add_parts') && (
              <div className="space-y-2">
                <Label htmlFor="additional-context">
                  {scenario === 'price_negotiation' ? 'Target Price or Details' : 'Part Numbers to Add'}
                </Label>
                <Input
                  id="additional-context"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder={
                    scenario === 'price_negotiation'
                      ? 'e.g., Can you match $50/unit? Or: Looking for better terms'
                      : 'e.g., 4630526, 4630527, 4630528'
                  }
                  disabled={sending || success}
                />
              </div>
            )}

            {/* Generate Reply Button - Prominent placement */}
            <div className="flex justify-center py-2">
              <Button
                onClick={() => generateReply()}
                disabled={generating || sending || success}
                size="lg"
                className="w-full max-w-md"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating Reply...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate AI Reply
                  </>
                )}
              </Button>
            </div>

            {/* Show form only after generation or allow manual entry */}
            {(body || !generating) && (
              <>

            {/* To Email (read-only) */}
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                value={supplierEmail}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="reply-subject">Subject</Label>
              <Input
                id="reply-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Re: Quote Response..."
                disabled={sending || success}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="reply-body">Message</Label>
              <Textarea
                id="reply-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Click 'Generate AI Reply' above or write your message manually..."
                className="min-h-[300px] font-mono text-sm"
                disabled={sending || success}
              />
            </div>

            {/* Regenerate Button - Only show if body exists */}
            {body && (
              <div className="flex justify-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateReply()}
                  disabled={generating || sending || success}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
                  Regenerate with AI
                </Button>
              </div>
            )}
              </>
            )}
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
            disabled={generating || sending || success}
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
                Send Reply
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
