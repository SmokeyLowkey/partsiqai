import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';

// POST /api/email-threads/[threadId]/reply - Reply to a supplier message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { threadId } = await params;
    const { messageId, subject, body, quoteRequestId } = await req.json();

    if (!messageId || !subject || !body) {
      return NextResponse.json(
        { error: 'messageId, subject, and body are required' },
        { status: 400 }
      );
    }

    const organizationId = session.user.organizationId;
    const userId = session.user.id;

    // Get the email thread with the original message
    const emailThread = await prisma.emailThread.findFirst({
      where: {
        id: threadId,
        organizationId,
      },
      include: {
        messages: {
          where: { id: messageId },
        },
        supplier: true,
      },
    });

    console.log('EmailThread externalThreadId:', emailThread?.externalThreadId);

    if (!emailThread) {
      return NextResponse.json(
        { error: 'Email thread not found' },
        { status: 404 }
      );
    }

    if (!emailThread.supplier) {
      return NextResponse.json(
        { error: 'No supplier associated with this thread' },
        { status: 400 }
      );
    }

    if (!emailThread.supplier.email) {
      return NextResponse.json(
        { error: 'Supplier does not have an email address' },
        { status: 400 }
      );
    }

    const originalMessage = emailThread.messages[0];
    if (!originalMessage) {
      return NextResponse.json(
        { error: 'Original message not found' },
        { status: 404 }
      );
    }

    // Initialize email client with user's credentials (supports Gmail and Microsoft)
    const emailClient = await getEmailClientForUser(userId);

    // Convert plain text body to HTML (preserve line breaks)
    const htmlBody = body
      .split('\n')
      .map((line: string) => `<p>${line || '&nbsp;'}</p>`)
      .join('');

    // Build References header for proper threading
    // References should include the Message-ID being replied to
    const references = originalMessage.externalMessageId || undefined;

    console.log('Sending reply with threading:', {
      threadId: emailThread.externalThreadId,
      inReplyTo: originalMessage.externalMessageId,
      references
    });

    console.log('==================== MESSAGE DETAILS ====================');
    console.log('Original Message ID (externalMessageId):', originalMessage.externalMessageId);
    console.log('Original Message Full Details:', {
      id: originalMessage.id,
      from: originalMessage.from,
      subject: originalMessage.subject,
      inReplyTo: originalMessage.inReplyTo
    });
    console.log('========================================================');

    // Send reply with threading headers
    const { messageId: newMessageId, threadId: returnedThreadId } = await emailClient.sendEmail(
      emailThread.supplier.email,
      subject,
      `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
      undefined, // cc
      undefined, // bcc
      {
        threadId: emailThread.externalThreadId || undefined,
        inReplyTo: originalMessage.externalMessageId || undefined,
        references,
      }
    );

    console.log('==================== THREAD ID COMPARISON ====================');
    console.log('Quote Request Thread (externalThreadId from DB):', emailThread.externalThreadId);
    console.log('Gmail API Response Thread ID:', returnedThreadId);
    console.log('Match:', emailThread.externalThreadId === returnedThreadId);
    console.log('Supplier:', emailThread.supplier.name, '(' + emailThread.supplier.email + ')');
    console.log('=============================================================');

    // Create new EmailMessage record for the reply
    const newMessage = await prisma.emailMessage.create({
      data: {
        threadId: emailThread.id,
        direction: 'OUTBOUND',
        from: session.user.email!,
        to: emailThread.supplier.email,
        cc: [],
        bcc: [],
        subject,
        body,
        bodyHtml: htmlBody,
        externalMessageId: newMessageId,
        sentAt: new Date(),
        inReplyTo: originalMessage.externalMessageId || undefined,
      },
    });

    // Update thread status
    await prisma.emailThread.update({
      where: { id: emailThread.id },
      data: {
        status: 'WAITING_RESPONSE',
        updatedAt: new Date(),
      },
    });

    // Update QuoteRequestEmailThread if this is linked to a quote request
    if (quoteRequestId) {
      const quoteRequestThread = await prisma.quoteRequestEmailThread.findFirst({
        where: {
          emailThreadId: emailThread.id,
          quoteRequestId,
        },
      });

      if (quoteRequestThread) {
        await prisma.quoteRequestEmailThread.update({
          where: { id: quoteRequestThread.id },
          data: {
            status: 'SENT', // Reset to SENT since we're awaiting new response
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully',
      messageId: newMessage.id,
    });
  } catch (error: any) {
    console.error('Error sending reply:', error);
    
    // Check if it's an authentication error
    if (error.message?.includes('re-authenticate') || error.message?.includes('invalid_grant') || error.message?.includes('token')) {
      return NextResponse.json(
        {
          error: 'Email authentication expired. Please ask an admin to re-authorize your email account.',
          code: 'AUTH_EXPIRED',
          requiresReauth: true
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to send reply' },
      { status: 500 }
    );
  }
}
