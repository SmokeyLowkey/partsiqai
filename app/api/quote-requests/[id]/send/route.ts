import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { addBusinessDays } from '@/lib/utils/business-days';
import { z } from 'zod';

const SendQuoteRequestSchema = z.object({
  suppliers: z.array(
    z.object({
      id: z.string(),
      email: z.string().email(),
      subject: z.string(),
      body: z.string(),
    })
  ).min(1, 'At least one supplier is required'),
});

// POST /api/quote-requests/[id]/send - Send quote request to suppliers
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
    const validationResult = SendQuoteRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { suppliers } = validationResult.data;

    // Get quote request
    const whereClause: any = {
      id,
      organizationId: session.user.organizationId,
    };

    // Technicians can only send their own quotes
    if (session.user.role === 'TECHNICIAN') {
      whereClause.createdById = session.user.id;
    }

    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: whereClause,
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    // Allow sending DRAFT or SENT quotes (for 'both' method where calls already updated status)
    // Don't allow if already converted to order or expired
    if (['CONVERTED_TO_ORDER', 'EXPIRED'].includes(quoteRequest.status)) {
      return NextResponse.json(
        { error: `Cannot send quote requests with status: ${quoteRequest.status}` },
        { status: 400 }
      );
    }

    // Verify all suppliers exist
    const supplierIds = suppliers.map((s) => s.id);
    const existingSuppliers = await prisma.supplier.findMany({
      where: {
        id: { in: supplierIds },
        organizationId: session.user.organizationId,
      },
    });

    if (existingSuppliers.length !== supplierIds.length) {
      return NextResponse.json(
        { error: 'One or more suppliers not found' },
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

    // Send emails to each supplier and track results
    const results: Array<{
      supplierId: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    const primarySupplierId = suppliers[0].id;
    const additionalSupplierIds = suppliers.slice(1).map((s) => s.id);

    // Calculate expected response date (3 business days from now)
    const expectedResponseBy = addBusinessDays(new Date(), 3);

    // Get organization email for "from" field
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { billingEmail: true, name: true },
    });
    const fromEmail = organization?.billingEmail || session.user.email || 'noreply@example.com';

    for (const supplier of suppliers) {
      try {
        // Convert plain text body to HTML (preserve line breaks)
        const htmlBody = supplier.body
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');

        // Send email - returns both messageId and threadId from Gmail
        const { messageId, threadId } = await emailClient.sendEmail(
          supplier.email,
          supplier.subject,
          `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`
        );

        // Create email thread record with WAITING_RESPONSE status
        // Use Gmail's threadId so we can match replies later
        const emailThread = await prisma.emailThread.create({
          data: {
            externalThreadId: threadId,
            subject: supplier.subject,
            status: 'WAITING_RESPONSE',
            supplierId: supplier.id,
            organizationId: session.user.organizationId,
            createdById: session.user.id,
          },
        });

        // Create the initial email message record with expectedResponseBy
        await prisma.emailMessage.create({
          data: {
            threadId: emailThread.id,
            direction: 'OUTBOUND',
            from: fromEmail,
            to: supplier.email,
            subject: supplier.subject,
            body: supplier.body,
            bodyHtml: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
            externalMessageId: messageId,
            sentAt: new Date(),
            expectedResponseBy,
          },
        });

        // Create quote request email thread link
        await prisma.quoteRequestEmailThread.create({
          data: {
            quoteRequestId: quoteRequest.id,
            emailThreadId: emailThread.id,
            supplierId: supplier.id,
            isPrimary: supplier.id === primarySupplierId,
            status: 'SENT',
          },
        });

        // Store the edited email content
        await prisma.editedEmail.create({
          data: {
            quoteRequestId: quoteRequest.id,
            supplierId: supplier.id,
            emailType: 'QUOTE_REQUEST',
            subject: supplier.subject,
            body: supplier.body,
            bodyHtml: htmlBody,
          },
        });

        results.push({
          supplierId: supplier.id,
          success: true,
          messageId,
        });
      } catch (error: any) {
        console.error(`Failed to send email to supplier ${supplier.id}:`, error);
        results.push({
          supplierId: supplier.id,
          success: false,
          error: error.message,
        });
      }
    }

    // Check if at least one email was sent successfully
    const successfulSends = results.filter((r) => r.success);
    if (successfulSends.length === 0) {
      return NextResponse.json(
        {
          error: 'Failed to send emails to any suppliers',
          details: results,
        },
        { status: 500 }
      );
    }

    // Update quote request — only advance status forward, never regress
    const noRegressStatuses = ['RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED_TO_ORDER'];
    const updateData: any = {};
    if (!noRegressStatuses.includes(quoteRequest.status)) {
      updateData.status = 'SENT';
    }

    // Only update supplier IDs if not already set (i.e., if this is the first contact)
    if (!quoteRequest.supplierId) {
      updateData.supplierId = primarySupplierId;
      updateData.additionalSupplierIds =
        additionalSupplierIds.length > 0
          ? additionalSupplierIds.join(',')
          : null;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.quoteRequest.update({
        where: { id },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      sentCount: successfulSends.length,
      totalCount: suppliers.length,
      results,
    });
  } catch (error: any) {
    console.error('Send quote request API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to send quote request',
      },
      { status: 500 }
    );
  }
}
