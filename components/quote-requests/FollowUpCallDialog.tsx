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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  PhoneCall,
  Loader2,
  Sparkles,
  Clock,
  AlertCircle,
  Check,
  RefreshCw,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExtractedQuote {
  partNumber?: string;
  price?: number;
  availability?: string;
  leadTimeDays?: number;
  notes?: string;
}

interface FollowUpCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteRequestId: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  previousCallOutcome?: string | null;
  previousCallNotes?: string | null;
  previousCallDate?: Date | null;
  extractedQuotes?: ExtractedQuote[] | null;
  conversationLog?: Array<{ role: string; content: string }> | null;
  onInitiated: () => void;
}

export function FollowUpCallDialog({
  open,
  onOpenChange,
  quoteRequestId,
  supplierId,
  supplierName,
  supplierPhone,
  previousCallOutcome,
  previousCallNotes,
  previousCallDate,
  extractedQuotes,
  conversationLog,
  onInitiated,
}: FollowUpCallDialogProps) {
  const [callContext, setCallContext] = useState('');
  const [agentInstructions, setAgentInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (open) {
      setSuccess(false);
      setError(null);
      setShowTranscript(false);
      generateCallSettings();
    }
  }, [open, quoteRequestId, supplierId]);

  const generateCallSettings = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/quote-requests/${quoteRequestId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch quote request details');
      }

      const data = await response.json();
      const qr = data.quoteRequest;

      // Build vehicle context
      const vehicle = qr.vehicle;
      let vehicleContext = '';
      if (vehicle) {
        vehicleContext = `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim();
        if (vehicle.serialNumber) {
          vehicleContext += ` (Serial: ${vehicle.serialNumber})`;
        }
      }

      // Build parts list
      const items = (qr.items || []).filter(
        (item: any) => item.partNumber !== 'MISC-COSTS'
      );
      let partsDetails = '';
      if (items.length > 0) {
        partsDetails = items
          .map((item: any, index: number) => {
            const qty = item.quantity > 1 ? ` (Qty: ${item.quantity})` : '';
            const desc = item.description ? ` - ${item.description}` : '';
            return `${index + 1}. ${item.partNumber}${desc}${qty}`;
          })
          .join('\n');
      }

      // Build context
      const orgName = qr.organization?.name || 'our company';
      const requestNum = qr.quoteNumber || qr.id.slice(0, 8);

      let context = `Company: ${orgName}\n`;
      context += `Quote Request: #${requestNum}\n`;
      if (vehicleContext) {
        context += `Vehicle: ${vehicleContext}\n`;
      }
      if (items.length > 0) {
        context += `\nParts Needed (${items.length} part${items.length > 1 ? 's' : ''}):\n`;
        context += partsDetails;
      }

      // Append previous call context
      if (previousCallOutcome) {
        context += `\n\nPrevious Call Notes:`;
        context += `\n- Outcome: ${previousCallOutcome}`;
        if (previousCallDate) {
          context += `\n- Date: ${new Date(previousCallDate).toLocaleDateString()}`;
        }
        if (previousCallNotes) {
          context += `\n- Notes: ${previousCallNotes}`;
        }
        if (extractedQuotes && extractedQuotes.length > 0) {
          context += `\n- Quotes already obtained:`;
          extractedQuotes.forEach((q) => {
            context += `\n  - ${q.partNumber}: $${q.price?.toFixed(2) || 'N/A'} (${q.availability || 'unknown'})`;
          });
        }
      }

      // Build agent instructions with follow-up guidance
      let instructions = `You are calling on behalf of ${orgName} to follow up on a previous quote request for parts.`;
      instructions += `\n\nKey guidance:`;
      instructions += `\n- Introduce yourself as calling from ${orgName}`;
      if (vehicleContext) {
        instructions += `\n- Reference the vehicle naturally if applicable (${vehicleContext})`;
      }
      instructions += `\n- This is a follow-up call — reference the previous attempt naturally`;

      // Outcome-specific guidance
      if (previousCallOutcome === 'VOICEMAIL') {
        instructions += `\n- Previously reached voicemail. Mention that you called earlier and left a message`;
        instructions += `\n- Ask to speak with the parts department`;
      } else if (previousCallOutcome === 'PARTIAL') {
        instructions += `\n- Previously spoke with them but didn't get complete pricing`;
        const quotedParts = extractedQuotes?.map((q) => q.partNumber).filter(Boolean) || [];
        const allParts = items.map((i: any) => i.partNumber);
        const missingParts = allParts.filter(
          (p: string) => !quotedParts.includes(p)
        );
        if (missingParts.length > 0) {
          instructions += `\n- Still need pricing for: ${missingParts.join(', ')}`;
        }
      } else if (previousCallOutcome === 'NO_QUOTE' || previousCallOutcome === 'DECLINED') {
        instructions += `\n- They previously couldn't provide a quote — ask if the situation has changed`;
        instructions += `\n- Be understanding if they still can't help`;
      } else if (previousCallOutcome === 'ERROR' || !previousCallOutcome) {
        instructions += `\n- Previous call had a technical issue — treat this as a fresh call`;
      }

      instructions += `\n- Go through parts one at a time, not all at once`;
      instructions += `\n- Ask for pricing, availability, and lead times for each part`;
      instructions += `\n- If price seems high, try negotiating — mention you're comparing suppliers`;
      instructions += `\n- Be patient if transferred or put on hold`;

      setCallContext(context);
      setAgentInstructions(instructions);
    } catch (error: any) {
      console.error('Error generating call settings:', error);
      setError(
        'Failed to generate call settings. You can enter them manually.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleInitiateCall = async () => {
    if (!callContext.trim()) {
      setError('Call context is required');
      return;
    }

    setInitiating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/quote-requests/${quoteRequestId}/initiate-call`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierIds: [supplierId],
            contactMethod: 'call',
            callContext,
            agentInstructions,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate call');
      }

      const failedJobs = data.jobs?.filter((j: any) => j.error) || [];
      if (failedJobs.length > 0) {
        throw new Error(failedJobs[0].error);
      }

      setSuccess(true);

      setTimeout(() => {
        onOpenChange(false);
        onInitiated();
      }, 2000);
    } catch (error: any) {
      console.error('Error initiating follow-up call:', error);
      setError(error.message);
    } finally {
      setInitiating(false);
    }
  };

  const getOutcomeLabel = (outcome: string) => {
    const labels: Record<string, string> = {
      SUCCESS: 'Quote Received',
      PARTIAL: 'Partial Info',
      NO_QUOTE: 'No Quote',
      VOICEMAIL: 'Voicemail',
      DECLINED: 'Declined',
      ERROR: 'Error',
    };
    return labels[outcome] || outcome;
  };

  const getOutcomeVariant = (outcome: string) => {
    if (outcome === 'SUCCESS') return 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300';
    if (outcome === 'PARTIAL') return 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300';
    if (outcome === 'VOICEMAIL') return 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300';
    return 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Follow-Up Call to {supplierName}
          </DialogTitle>
          <DialogDescription>
            Review the call context and agent instructions before initiating a
            follow-up call to {supplierPhone}.
          </DialogDescription>
        </DialogHeader>

        {/* Previous Call Summary */}
        {previousCallOutcome && (
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <h4 className="text-sm font-medium">Previous Call</h4>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={getOutcomeVariant(previousCallOutcome)}>
                {getOutcomeLabel(previousCallOutcome)}
              </Badge>
              {previousCallDate && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(previousCallDate).toLocaleDateString()}
                </Badge>
              )}
            </div>

            {/* Extracted Quotes from previous call */}
            {extractedQuotes && extractedQuotes.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  Quotes from previous call:
                </div>
                <div className="grid gap-1">
                  {extractedQuotes.map((q, i) => (
                    <div
                      key={i}
                      className="text-xs bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded"
                    >
                      {q.partNumber && (
                        <span className="font-medium">{q.partNumber}</span>
                      )}
                      {q.price && (
                        <span className="text-green-700 dark:text-green-400 ml-2">
                          ${q.price.toFixed(2)}
                        </span>
                      )}
                      {q.availability && (
                        <span className="text-muted-foreground ml-2">
                          ({q.availability})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transcript snippet */}
            {conversationLog && conversationLog.length > 0 && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => setShowTranscript(!showTranscript)}
                >
                  {showTranscript ? (
                    <ChevronUp className="h-3 w-3 mr-1" />
                  ) : (
                    <ChevronDown className="h-3 w-3 mr-1" />
                  )}
                  {showTranscript ? 'Hide' : 'Show'} transcript (
                  {conversationLog.length} turns)
                </Button>
                {showTranscript && (
                  <div className="mt-2 space-y-1 max-h-[150px] overflow-y-auto">
                    {conversationLog.slice(0, 6).map((turn, i) => (
                      <div
                        key={i}
                        className={`text-xs p-1.5 rounded ${
                          turn.role === 'assistant'
                            ? 'bg-blue-50 dark:bg-blue-950/30'
                            : 'bg-gray-50 dark:bg-gray-800/50'
                        }`}
                      >
                        <span className="font-semibold uppercase text-[10px]">
                          {turn.role === 'assistant' ? 'AI' : 'Supplier'}:{' '}
                        </span>
                        {turn.content}
                      </div>
                    ))}
                    {conversationLog.length > 6 && (
                      <p className="text-xs text-muted-foreground italic">
                        ...and {conversationLog.length - 6} more turns
                      </p>
                    )}
                  </div>
                )}
              </div>
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
              Follow-up call initiated to {supplierPhone}
            </AlertDescription>
          </Alert>
        )}

        {generating ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 inline mr-1" />
                Generating call settings...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Call Context */}
            <div className="space-y-2">
              <Label htmlFor="follow-up-call-context">
                Call Context{' '}
                <span className="text-muted-foreground font-normal">
                  (facts for the AI agent)
                </span>
              </Label>
              <Textarea
                id="follow-up-call-context"
                value={callContext}
                onChange={(e) => setCallContext(e.target.value)}
                placeholder="Company, vehicle, parts needed..."
                className="min-h-[180px] font-mono text-sm"
                disabled={initiating || success}
              />
            </div>

            {/* Agent Instructions */}
            <div className="space-y-2">
              <Label htmlFor="follow-up-agent-instructions">
                Agent Instructions{' '}
                <span className="text-muted-foreground font-normal">
                  (behavioral guidance)
                </span>
              </Label>
              <Textarea
                id="follow-up-agent-instructions"
                value={agentInstructions}
                onChange={(e) => setAgentInstructions(e.target.value)}
                placeholder="How the AI agent should behave..."
                className="min-h-[180px] font-mono text-sm"
                disabled={initiating || success}
              />
            </div>

            {/* Regenerate Button */}
            <div className="flex justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={generateCallSettings}
                disabled={generating || initiating || success}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`}
                />
                Regenerate Settings
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={initiating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInitiateCall}
            disabled={generating || initiating || success}
          >
            {initiating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Initiating...
              </>
            ) : success ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Call Queued
              </>
            ) : (
              <>
                <PhoneCall className="h-4 w-4 mr-2" />
                Initiate Follow-Up Call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
