import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { z } from 'zod';

const SendConfirmationSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
});

// POST /api/orders/[id]/send-confirmation - Send order confirmation email to supplier
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
    const validationResult = SendConfirmationSchema.safeParse(body);
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

    // Get order with email thread
    const order = await prisma.order.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
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
        supplier: true,
        emailThread: {
          include: {
            messages: {
              orderBy: { sentAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify supplierId matches
    if (order.supplierId !== supplierId) {
      return NextResponse.json(
        { error: 'Supplier ID mismatch' },
        { status: 400 }
      );
    }

    if (!order.supplier.email) {
      return NextResponse.json(
        { error: 'Supplier does not have an email address' },
        { status: 400 }
      );
    }

    if (!order.emailThread) {
      return NextResponse.json(
        { error: 'No email thread found for this order' },
        { status: 404 }
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

    // Convert plain text body to HTML
    const htmlBody = emailBody
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    // Get the last message for In-Reply-To
    const lastMessage = order.emailThread.messages[0];

    // Send the confirmation email as a reply in the existing thread
    const { messageId } = await emailClient.sendEmail(
      order.supplier.email,
      subject,
      `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
      undefined, // cc
      undefined, // bcc
      {
        // Use the same thread to maintain conversation continuity
        threadId: order.emailThread.externalThreadId || undefined,
        inReplyTo: lastMessage?.externalMessageId || undefined,
      }
    );

    // Get from email
    const fromEmail =
      order.organization.billingEmail ||
      order.createdBy.email ||
      session.user.email ||
      'noreply@example.com';

    // Create email message record for the confirmation
    await prisma.emailMessage.create({
      data: {
        threadId: order.emailThread.id,
        direction: 'OUTBOUND',
        from: fromEmail,
        to: order.supplier.email,
        subject,
        body: emailBody,
        bodyHtml: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
        externalMessageId: messageId,
        sentAt: new Date(),
      },
    });

    // Update email thread status to indicate confirmation sent
    await prisma.emailThread.update({
      where: { id: order.emailThread.id },
      data: {
        status: 'RESPONSE_RECEIVED',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      messageId,
      sentTo: order.supplier.email,
    });
  } catch (error: any) {
    console.error('Send confirmation API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to send order confirmation',
      },
      { status: 500 }
    );
  }
}
