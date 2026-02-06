'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Inbox, Eye, Mail, Clock, RefreshCw, Paperclip, Download, FileText, Image, File, Reply } from 'lucide-react';
import { QuoteRequestEmailThreadWithDetails } from '@/types/quote-request';
import { FollowUpDialog } from './FollowUpDialog';
import { ReplyDialog } from './ReplyDialog';

interface CommunicationHistoryProps {
  emailThreads: QuoteRequestEmailThreadWithDetails[];
  selectedSupplierId?: string;
  quoteRequestId: string;
  onRefresh?: () => void;
}

export function CommunicationHistory({
  emailThreads,
  selectedSupplierId,
  quoteRequestId,
  onRefresh,
}: CommunicationHistoryProps) {
  const [previewThread, setPreviewThread] = useState<QuoteRequestEmailThreadWithDetails | null>(null);
  const [followUpThread, setFollowUpThread] = useState<QuoteRequestEmailThreadWithDetails | null>(null);
  const [replyMessage, setReplyMessage] = useState<{
    thread: QuoteRequestEmailThreadWithDetails;
    message: typeof emailThreads[0]['emailThread']['messages'][0];
  } | null>(null);
  const [downloadingAttachment, setDownloadingAttachment] = useState<string | null>(null);

  const handleDownloadAttachment = async (attachmentId: string, filename: string) => {
    try {
      setDownloadingAttachment(attachmentId);
      const response = await fetch(`/api/attachments/${attachmentId}`);
      if (!response.ok) throw new Error('Failed to get download URL');

      const data = await response.json();

      // Open the signed URL in a new tab to download
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Failed to download attachment:', error);
    } finally {
      setDownloadingAttachment(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (contentType: string) => {
    if (contentType === 'application/pdf') return <FileText className="h-4 w-4" />;
    if (contentType.startsWith('image/')) return <Image className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  // Filter threads by selected supplier if provided
  const filteredThreads = selectedSupplierId
    ? emailThreads.filter((thread) => thread.supplierId === selectedSupplierId)
    : emailThreads;

  const getDaysSince = (date: Date | null): number => {
    if (!date) return 0;
    const diffTime = new Date().getTime() - new Date(date).getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <Badge className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
            <Send className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case 'RESPONDED':
        return (
          <Badge className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
            <Inbox className="h-3 w-3 mr-1" />
            Responded
          </Badge>
        );
      case 'ACCEPTED':
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
            Accepted
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (filteredThreads.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Communication History</h4>
        <div className="border rounded-lg p-6 text-center text-muted-foreground">
          <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No communications yet</p>
          <p className="text-xs mt-1">
            {selectedSupplierId
              ? 'No communications with this supplier yet'
              : 'Send a quote request to start the conversation'}
          </p>
        </div>
      </div>
    );
  }

  // Sort messages by date (oldest first for timeline view)
  const getSortedMessages = (messages: typeof filteredThreads[0]['emailThread']['messages']) => {
    return [...messages].sort((a, b) => {
      const dateA = new Date(a.sentAt || a.receivedAt || 0).getTime();
      const dateB = new Date(b.sentAt || b.receivedAt || 0).getTime();
      return dateA - dateB;
    });
  };

  return (
    <>
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Communication History</h4>
        <div className="space-y-4">
          {filteredThreads.map((thread) => {
            const sortedMessages = getSortedMessages(thread.emailThread.messages);
            const firstMessage = sortedMessages[0];

            return (
              <div
                key={thread.id}
                className="border rounded-lg overflow-hidden"
              >
                {/* Thread Header */}
                <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(thread.status)}
                    <span className="font-medium text-sm">
                      {thread.supplier.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      - {thread.emailThread.subject || 'Quote Request'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {sortedMessages.length} message{sortedMessages.length !== 1 ? 's' : ''}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewThread(thread)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Full View
                    </Button>
                  </div>
                </div>

                {/* Message Timeline */}
                <div className="p-3 space-y-3">
                  {sortedMessages.map((message, index) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${index !== sortedMessages.length - 1 ? 'pb-3 border-b border-dashed' : ''}`}
                    >
                      {/* Timeline indicator */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            message.direction === 'OUTBOUND'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                              : 'bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400'
                          }`}
                        >
                          {message.direction === 'OUTBOUND' ? (
                            <Send className="h-4 w-4" />
                          ) : (
                            <Inbox className="h-4 w-4" />
                          )}
                        </div>
                        {index !== sortedMessages.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border mt-2" />
                        )}
                      </div>

                      {/* Message content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">
                            {message.direction === 'OUTBOUND' ? 'Sent' : 'Received'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(message.sentAt || message.receivedAt || null)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                          {message.body.substring(0, 200)}
                          {message.body.length > 200 && '...'}
                        </div>

                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.attachments.map((attachment) => (
                              <Button
                                key={attachment.id}
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleDownloadAttachment(attachment.id, attachment.filename)}
                                disabled={downloadingAttachment === attachment.id}
                              >
                                {getFileIcon(attachment.contentType)}
                                <span className="max-w-[120px] truncate">{attachment.filename}</span>
                                <span className="text-muted-foreground">({formatFileSize(attachment.size)})</span>
                                <Download className="h-3 w-3 ml-1" />
                              </Button>
                            ))}
                          </div>
                        )}

                        {/* Reply button for inbound messages */}
                        {message.direction === 'INBOUND' && (
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setReplyMessage({ thread, message })}
                            >
                              <Reply className="h-3 w-3 mr-1" />
                              Reply
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer with quoted amount and follow-up */}
                <div className="p-3 bg-muted/30 border-t space-y-2">
                  {/* Quoted Amount if available */}
                  {thread.quotedAmount && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Quoted Amount:
                      </span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        }).format(thread.quotedAmount)}
                      </span>
                    </div>
                  )}

                  {/* Follow-up section for threads awaiting response */}
                  {thread.status === 'SENT' && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          Awaiting response ({getDaysSince(
                            firstMessage?.sentAt ||
                              firstMessage?.receivedAt ||
                              null
                          )} days)
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFollowUpThread(thread)}
                        className="h-7 text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Send Follow-Up
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Email Preview Dialog */}
      <Dialog open={!!previewThread} onOpenChange={(open) => !open && setPreviewThread(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {previewThread?.emailThread.subject || 'Quote Request'}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Thread metadata */}
              <div className="flex items-center justify-between border-b pb-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    To: {previewThread?.supplier.name}
                  </p>
                  {previewThread?.supplier.email && (
                    <p className="text-xs text-muted-foreground">
                      {previewThread.supplier.email}
                    </p>
                  )}
                </div>
                {previewThread && getStatusBadge(previewThread.status)}
              </div>

              {/* Messages */}
              <div className="space-y-4">
                {previewThread?.emailThread.messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`p-4 rounded-lg ${
                      message.direction === 'OUTBOUND'
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500'
                        : 'bg-gray-50 dark:bg-gray-800/50 border-l-2 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {message.direction === 'OUTBOUND' ? (
                          <Send className="h-3 w-3 text-blue-500" />
                        ) : (
                          <Inbox className="h-3 w-3 text-green-500" />
                        )}
                        <span className="text-xs font-medium">
                          {message.direction === 'OUTBOUND' ? 'Sent' : 'Received'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(message.sentAt || message.receivedAt || null)}
                      </span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {message.body}
                    </div>

                    {/* Attachments in preview */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-dashed">
                        <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
                          <Paperclip className="h-3 w-3" />
                          <span>{message.attachments.length} attachment{message.attachments.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {message.attachments.map((attachment) => (
                            <Button
                              key={attachment.id}
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5"
                              onClick={() => handleDownloadAttachment(attachment.id, attachment.filename)}
                              disabled={downloadingAttachment === attachment.id}
                            >
                              {getFileIcon(attachment.contentType)}
                              <span className="max-w-[150px] truncate">{attachment.filename}</span>
                              <span className="text-muted-foreground">({formatFileSize(attachment.size)})</span>
                              <Download className="h-3 w-3 ml-1" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reply button for inbound messages in preview */}
                    {message.direction === 'INBOUND' && previewThread && (
                      <div className="mt-3 pt-3 border-t border-dashed">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReplyMessage({ thread: previewThread, message });
                            setPreviewThread(null); // Close preview dialog
                          }}
                        >
                          <Reply className="h-4 w-4 mr-2" />
                          Reply to this message
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Quoted Amount if available */}
              {previewThread?.quotedAmount && (
                <div className="flex items-center gap-2 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Quoted Amount:
                  </span>
                  <span className="font-semibold text-green-600 dark:text-green-400 text-lg">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(previewThread.quotedAmount)}
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Follow-Up Dialog */}
      <FollowUpDialog
        open={!!followUpThread}
        onOpenChange={(open) => !open && setFollowUpThread(null)}
        quoteRequestId={quoteRequestId}
        supplierId={followUpThread?.supplierId || ''}
        supplierName={followUpThread?.supplier.name || ''}
        supplierEmail={followUpThread?.supplier.email || null}
        onSent={() => {
          setFollowUpThread(null);
          onRefresh?.();
        }}
      />

      {/* Reply Dialog */}
      <ReplyDialog
        open={!!replyMessage}
        onOpenChange={(open) => !open && setReplyMessage(null)}
        emailThreadId={replyMessage?.thread.emailThread.id || ''}
        messageId={replyMessage?.message.id || ''}
        supplierName={replyMessage?.thread.supplier.name || ''}
        supplierEmail={replyMessage?.thread.supplier.email || ''}
        originalSubject={replyMessage?.thread.emailThread.subject || ''}
        originalBody={replyMessage?.message.body || ''}
        quoteRequestId={quoteRequestId}
        onSent={() => {
          setReplyMessage(null);
          onRefresh?.();
        }}
      />
    </>
  );
}
