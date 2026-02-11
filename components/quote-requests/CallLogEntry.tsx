'use client';

import { useState } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Clock,
  MessageSquare,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';

type CallStatus =
  | 'INITIATED'
  | 'RINGING'
  | 'ANSWERED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'NO_ANSWER';

type CallDirection = 'OUTBOUND' | 'INBOUND';

type CallOutcome =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'NO_QUOTE'
  | 'VOICEMAIL'
  | 'DECLINED'
  | 'ERROR';

interface ConversationTurn {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

interface ExtractedQuote {
  partNumber?: string;
  price?: number;
  availability?: string;
  leadTime?: string;
  condition?: string;
  notes?: string;
}

interface CallLogEntryProps {
  callId: string;
  supplierName: string;
  phoneNumber: string;
  status: CallStatus;
  direction: CallDirection;
  outcome?: CallOutcome | null;
  duration?: number | null; // seconds
  conversationLog?: ConversationTurn[] | null;
  extractedQuotes?: ExtractedQuote[] | null;
  recordingUrl?: string | null;
  vapiCallId?: string | null;
  createdAt: Date;
  endedAt?: Date | null;
}

export function CallLogEntry({
  callId,
  supplierName,
  phoneNumber,
  status,
  direction,
  outcome,
  duration,
  conversationLog,
  extractedQuotes,
  recordingUrl,
  vapiCallId,
  createdAt,
  endedAt,
}: CallLogEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Format duration as MM:SS
  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date/time
  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date));
  };

  // Get status badge
  const getStatusBadge = () => {
    switch (status) {
      case 'COMPLETED':
        return (
          <Badge className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            In Progress
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'NO_ANSWER':
        return (
          <Badge variant="outline" className="border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-400">
            <PhoneOff className="h-3 w-3 mr-1" />
            No Answer
          </Badge>
        );
      case 'ANSWERED':
      case 'RINGING':
      case 'INITIATED':
        return (
          <Badge variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400">
            <Phone className="h-3 w-3 mr-1" />
            {status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  // Get outcome badge
  const getOutcomeBadge = () => {
    if (!outcome) return null;

    switch (outcome) {
      case 'SUCCESS':
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Quote Received
          </Badge>
        );
      case 'PARTIAL':
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300">
            <AlertCircle className="h-3 w-3 mr-1" />
            Partial Info
          </Badge>
        );
      case 'NO_QUOTE':
        return (
          <Badge variant="outline" className="border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-400">
            No Quote
          </Badge>
        );
      case 'VOICEMAIL':
        return (
          <Badge variant="outline" className="border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-400">
            Voicemail
          </Badge>
        );
      case 'DECLINED':
        return (
          <Badge variant="outline" className="border-red-200 text-red-700 dark:border-red-800 dark:text-red-400">
            Declined
          </Badge>
        );
      case 'ERROR':
        return (
          <Badge className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
    }
  };

  return (
    <Card className="border-l-4 border-l-indigo-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Call direction icon */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                direction === 'OUTBOUND'
                  ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                  : 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400'
              }`}
            >
              {direction === 'OUTBOUND' ? (
                <PhoneCall className="h-5 w-5" />
              ) : (
                <PhoneIncoming className="h-5 w-5" />
              )}
            </div>

            {/* Call info */}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{supplierName}</h4>
                {getStatusBadge()}
                {getOutcomeBadge()}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {phoneNumber}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(duration)}
                </span>
                <span>{formatDateTime(createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {recordingUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(recordingUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Recording
              </Button>
            )}
            {(conversationLog || extractedQuotes) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Details
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Collapsible details */}
      {(conversationLog || extractedQuotes) && (
        <Collapsible open={isExpanded}>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Extracted Quotes */}
                {extractedQuotes && extractedQuotes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Extracted Quotes ({extractedQuotes.length})
                    </div>
                    <div className="space-y-2">
                      {extractedQuotes.map((quote, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-3 bg-green-50/50 dark:bg-green-950/20"
                        >
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {quote.partNumber && (
                              <div>
                                <span className="text-muted-foreground">Part #:</span>{' '}
                                <span className="font-medium">{quote.partNumber}</span>
                              </div>
                            )}
                            {quote.price && (
                              <div>
                                <span className="text-muted-foreground">Price:</span>{' '}
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                  ${quote.price.toFixed(2)}
                                </span>
                              </div>
                            )}
                            {quote.availability && (
                              <div>
                                <span className="text-muted-foreground">Availability:</span>{' '}
                                <span className="font-medium">{quote.availability}</span>
                              </div>
                            )}
                            {quote.leadTime && (
                              <div>
                                <span className="text-muted-foreground">Lead Time:</span>{' '}
                                <span className="font-medium">{quote.leadTime}</span>
                              </div>
                            )}
                            {quote.condition && (
                              <div>
                                <span className="text-muted-foreground">Condition:</span>{' '}
                                <span className="font-medium">{quote.condition}</span>
                              </div>
                            )}
                          </div>
                          {quote.notes && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              <span className="font-medium">Notes:</span> {quote.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation Transcript */}
                {conversationLog && conversationLog.length > 0 && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="w-full"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {showTranscript ? 'Hide' : 'Show'} Transcript ({conversationLog.length} turns)
                    </Button>

                    {showTranscript && (
                      <ScrollArea className="h-[300px] border rounded-lg p-3">
                        <div className="space-y-3">
                          {conversationLog.map((turn, index) => (
                            <div
                              key={index}
                              className={`p-3 rounded-lg ${
                                turn.role === 'assistant'
                                  ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500'
                                  : 'bg-gray-50 dark:bg-gray-800/50 border-l-2 border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold uppercase">
                                  {turn.role === 'assistant' ? 'AI Agent' : 'Supplier'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(turn.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}

                {/* Vapi Call ID */}
                {vapiCallId && (
                  <div className="text-xs text-muted-foreground border-t pt-3">
                    Call ID: <code className="bg-muted px-1 py-0.5 rounded">{vapiCallId}</code>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
