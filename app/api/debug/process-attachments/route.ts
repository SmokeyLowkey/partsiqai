import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { quoteExtractionQueue } from '@/lib/queue/queues';

/**
 * DEBUG ENDPOINT - Process attachments for existing messages
 * POST /api/debug/process-attachments
 *
 * This will find all inbound messages that have attachments in Gmail
 * but haven't been processed yet, and queue them for processing.
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const session = await getServerSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organizationId = session.user.organizationId;

    // Get email client using current user's credentials (supports Gmail and Microsoft)
    const emailClient = await getEmailClientForUser(session.user.id);

    // Get all inbound messages that might have attachments
    const inboundMessages = await prisma.emailMessage.findMany({
      where: {
        thread: {
          organizationId,
        },
        direction: 'INBOUND',
      },
      include: {
        thread: true,
        attachments: true,
      },
      orderBy: {
        receivedAt: 'desc',
      },
      take: 20, // Limit to recent messages
    });

    const results: any[] = [];

    for (const message of inboundMessages) {
      // Skip if already has attachments in our database
      if (message.attachments.length > 0) {
        results.push({
          messageId: message.id,
          externalMessageId: message.externalMessageId,
          subject: message.subject,
          action: 'already_has_attachments',
          existingAttachmentCount: message.attachments.length,
        });
        continue;
      }

      // Fetch the message from Gmail to check for attachments
      if (!message.externalMessageId) {
        results.push({
          messageId: message.id,
          subject: message.subject,
          action: 'no_external_id',
        });
        continue;
      }

      try {
        // Use fetchNewEmails logic to get message details
        // But we need to get a specific message, so let's fetch it directly
        const emails = await emailClient.fetchNewEmails();
        const gmailMessage = emails.find(e => e.id === message.externalMessageId);

        if (!gmailMessage) {
          results.push({
            messageId: message.id,
            externalMessageId: message.externalMessageId,
            subject: message.subject,
            action: 'not_found_in_gmail',
          });
          continue;
        }

        if (gmailMessage.attachments.length === 0) {
          results.push({
            messageId: message.id,
            externalMessageId: message.externalMessageId,
            subject: message.subject,
            action: 'no_attachments_in_gmail',
          });
          continue;
        }

        // Queue for quote extraction
        await (quoteExtractionQueue as any).add('extract-quote', {
          organizationId,
          emailThreadId: message.thread.id,
          emailMessageId: message.id,
          emailData: {
            id: gmailMessage.id,
            threadId: gmailMessage.threadId,
            subject: message.subject || '',
            body: message.body,
            from: message.from,
            date: gmailMessage.date,
          },
          attachments: gmailMessage.attachments.map((att) => ({
            id: `${gmailMessage.id}-${att.attachmentId}`,
            filename: att.filename,
            contentType: att.mimeType,
            size: att.size,
            gmailAttachmentId: att.attachmentId,
          })),
        });

        results.push({
          messageId: message.id,
          externalMessageId: message.externalMessageId,
          subject: message.subject,
          action: 'queued_for_extraction',
          attachmentCount: gmailMessage.attachments.length,
          attachments: gmailMessage.attachments.map(a => ({
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
          })),
        });
      } catch (error: any) {
        results.push({
          messageId: message.id,
          externalMessageId: message.externalMessageId,
          subject: message.subject,
          action: 'error',
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      messagesChecked: inboundMessages.length,
      results,
    });
  } catch (error: any) {
    console.error('Process attachments error:', error);
    return NextResponse.json({
      error: 'Failed to process attachments',
    }, { status: 500 });
  }
}
