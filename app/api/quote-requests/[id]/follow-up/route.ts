import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { addBusinessDays, getDaysSince } from '@/lib/utils/business-days';
import { z } from 'zod';

const FollowUpSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
});

// POST /api/quote-requests/[id]/follow-up - Send follow-up email to a supplier
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Validate request body
    const validationResult = FollowUpSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { supplierId, subject, body: emailBody } = validationResult.data;

    // Get quote request with email threads
    const whereClause: any = {
      id,
      organizationId: session.user.organizationId,
    };

    // Technicians can only follow up on their own quotes
    if (session.user.role === 'TECHNICIAN') {
      whereClause.createdById = session.user.id;
    }

    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: whereClause,
      include: {
        organization: {
          select: {
            name: true,
            billingEmail: true,
          },
        },
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    // Get the email thread for this supplier
    const quoteRequestEmailThread = await prisma.quoteRequestEmailThread.findFirst({
      where: {
        quoteRequestId: id,
        supplierId,
      },
      include: {
        emailThread: {
          include: {
            messages: {
              orderBy: { sentAt: 'asc' },
            },
          },
        },
        supplier: true,
      },
    });

    if (!quoteRequestEmailThread) {
      return NextResponse.json(
        { error: 'No email thread found for this supplier' },
        { status: 404 }
      );
    }

    if (!quoteRequestEmailThread.supplier.email) {
      return NextResponse.json(
        { error: 'Supplier does not have an email address' },
        { status: 400 }
      );
    }

    // Initialize email client using current user's credentials (supports Gmail and Microsoft)
    let emailClient;
    try {
      emailClient = await getEmailClientForUser(session.user.id);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Email not configured. Please ask an admin to set up your email integration.' },
        { status: 400 }
      );
    }

    // Calculate days since original email
    const originalMessage = quoteRequestEmailThread.emailThread.messages.find(
      (m) => m.direction === 'OUTBOUND'
    );
    const daysSinceOriginal = originalMessage?.sentAt
      ? getDaysSince(originalMessage.sentAt)
      : 0;

    // Convert plain text body to HTML
    const htmlBody = emailBody
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    // Send the follow-up email as a reply in the same thread
    const { messageId, threadId: gmailThreadId } = await emailClient.sendEmail(
      quoteRequestEmailThread.supplier.email,
      subject,
      `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
      undefined, // cc
      undefined, // bcc
      {
        // Include threadId to keep the follow-up in the same Gmail thread
        threadId: quoteRequestEmailThread.emailThread.externalThreadId || undefined,
        // Include In-Reply-To header if we have the original message ID
        inReplyTo: originalMessage?.externalMessageId || undefined,
      }
    );

    // Update externalThreadId if Gmail assigned a different thread
    // (happens when sending from a different Gmail account than the original)
    if (gmailThreadId && gmailThreadId !== quoteRequestEmailThread.emailThread.externalThreadId) {
      await prisma.emailThread.update({
        where: { id: quoteRequestEmailThread.emailThread.id },
        data: { externalThreadId: gmailThreadId },
      });
    }

    // Get from email
    const fromEmail =
      quoteRequest.organization.billingEmail ||
      quoteRequest.createdBy.email ||
      session.user.email ||
      'noreply@example.com';

    // Calculate next expected response (3 business days from now)
    const nextExpectedResponse = addBusinessDays(new Date(), 3);

    // Create email message record for the follow-up
    await prisma.emailMessage.create({
      data: {
        threadId: quoteRequestEmailThread.emailThread.id,
        direction: 'OUTBOUND',
        from: fromEmail,
        to: quoteRequestEmailThread.supplier.email,
        subject,
        body: emailBody,
        bodyHtml: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
        externalMessageId: messageId,
        sentAt: new Date(),
        followUpSentAt: new Date(),
        followUpReason: `Manual follow-up after ${daysSinceOriginal} days`,
        expectedResponseBy: nextExpectedResponse,
      },
    });

    // Update email thread status
    await prisma.emailThread.update({
      where: { id: quoteRequestEmailThread.emailThread.id },
      data: {
        status: 'FOLLOW_UP_NEEDED',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      messageId,
      sentTo: quoteRequestEmailThread.supplier.email,
      daysSinceOriginal,
    });
  } catch (error: any) {
    console.error('Follow-up API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to send follow-up',
      },
      { status: 500 }
    );
  }
}
