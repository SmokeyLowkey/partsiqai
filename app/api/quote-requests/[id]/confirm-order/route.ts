import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, canConvertToOrder } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { recordOrderCostSavings } from '@/lib/services/cost-savings';
import { generateOrderNumber } from '@/lib/utils/order-number';

// POST /api/quote-requests/[id]/confirm-order - Actually create order and send email
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canConvertToOrder(session.user.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to convert quotes to orders.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const {
      supplierId,
      fulfillmentMethod,
      orderNotes,
      internalNotes,
      acknowledgeExpiry,
      itemSelections,
      includeSuggested,
      includeRequested,
      emailSubject,
      emailBody,
    } = await req.json();

    if (!supplierId || !emailSubject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const organizationId = session.user.organizationId;
    const userId = session.user.id;

    // Fetch quote with all necessary relations
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: {
        id,
        organizationId,
      },
      include: {
        emailThreads: {
          where: { supplierId },
          include: {
            emailThread: {
              include: {
                messages: {
                  orderBy: { sentAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        items: {
          include: {
            supplierQuotes: {
              where: { supplierId },
            },
          },
        },
        supplier: true,
        vehicle: true,
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
      return NextResponse.json({ error: 'Quote request not found' }, { status: 404 });
    }

    // Validation: Check approval requirement for technicians
    // Managers/admins can convert regardless of approval status (they ARE the approvers)
    const isManagerOrAdmin = ['ADMIN', 'MASTER_ADMIN', 'MANAGER'].includes(session.user.role);
    if (quoteRequest.requiresApproval && quoteRequest.status !== 'APPROVED' && !isManagerOrAdmin) {
      return NextResponse.json({
        error: 'This quote requires manager approval before it can be converted to an order',
        currentStatus: quoteRequest.status,
        requiresApproval: true,
      }, { status: 400 });
    }

    // Get supplier thread
    const supplierThread = quoteRequest.emailThreads[0];
    if (!supplierThread) {
      return NextResponse.json({ error: 'Email thread not found' }, { status: 404 });
    }

    // Filter supplier items
    const supplierItems = quoteRequest.items.filter(item =>
      item.supplierQuotes && item.supplierQuotes.length > 0
    );

    // Filter selected items
    const selectedItems = supplierItems.filter(item => {
      const isSupplierSuggested = item.isAlternative && !item.originalPartNumber;
      const isRequestedItem = !isSupplierSuggested;
      
      if (isSupplierSuggested) {
        return includeSuggested?.[item.id] === true;
      }
      
      if (isRequestedItem) {
        return includeRequested?.[item.id] !== false;
      }
      
      return true;
    });

    // Check for expired items
    const expiredItems = selectedItems.filter(item =>
      item.supplierQuotes.some(sq =>
        sq.validUntil && new Date(sq.validUntil) < new Date()
      )
    );

    // Calculate totals
    const subtotal = selectedItems.reduce((sum, item) => {
      const quote = item.supplierQuotes[0];
      return sum + Number(quote.totalPrice);
    }, 0);

    // Order number will be generated inside the transaction to prevent duplicates
    let orderNumber: string;

    // Build internal notes
    let finalInternalNotes = internalNotes || '';
    if (expiredItems.length > 0) {
      finalInternalNotes += `\n\n⚠️ Converted with expired pricing (acknowledged by user). ${expiredItems.length} item(s) had expired quotes.`;
    }
    
    // Track rejected alternatives
    const rejectedAlternatives = selectedItems.filter(item => {
      const selection = itemSelections?.[item.id];
      const quote = item.supplierQuotes[0];
      const hasAlternative = item.isAlternative || item.isSuperseded || 
                            (quote?.supplierPartNumber && quote.supplierPartNumber !== item.partNumber);
      return selection === 'ORIGINAL' && hasAlternative;
    });
    
    if (rejectedAlternatives.length > 0) {
      finalInternalNotes += `\n\n📋 FOLLOW-UP REQUIRED: Customer rejected alternative parts for ${rejectedAlternatives.length} item(s):`;
      rejectedAlternatives.forEach(item => {
        const quote = item.supplierQuotes[0];
        finalInternalNotes += `\n  • ${item.partNumber} (supplier offered: ${quote.supplierPartNumber || 'alternative'})`;
        if (item.alternativeReason) {
          finalInternalNotes += ` - ${item.alternativeReason}`;
        }
      });
      finalInternalNotes += `\n  Action: Contact supplier to confirm availability and pricing of original parts.`;
    }
    
    finalInternalNotes += `\n\nConverted from Quote Request: ${quoteRequest.quoteNumber}`;

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Generate order number atomically inside the transaction
      orderNumber = await generateOrderNumber(organizationId, tx);

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          organizationId,
          status: 'PENDING',
          priority: expiredItems.length > 0 ? 'HIGH' : 'MEDIUM',
          orderDate: new Date(),
          subtotal,
          total: subtotal,
          supplierId,
          vehicleId: quoteRequest.vehicleId,
          createdById: userId,
          emailThreadId: supplierThread.emailThread.id,
          quoteReference: quoteRequest.id,
          fulfillmentMethod: fulfillmentMethod || 'DELIVERY',
          notes: orderNotes || null,
          internalNotes: finalInternalNotes || null,
          orderItems: {
            create: selectedItems.map(item => {
              const quote = item.supplierQuotes[0];
              const selection = itemSelections?.[item.id] || 'ALTERNATIVE';
              const hasAlternative = item.isAlternative || item.isSuperseded || 
                                    (quote?.supplierPartNumber && quote.supplierPartNumber !== item.partNumber);
              
              const useAlternative = selection === 'ALTERNATIVE' && hasAlternative;
              const actualPartNumber = useAlternative && quote.supplierPartNumber 
                ? quote.supplierPartNumber 
                : item.partNumber;
              
              return {
                partNumber: actualPartNumber,
                supplierPartNumber: hasAlternative ? (quote.supplierPartNumber || null) : null,
                isAlternative: useAlternative ? true : false,
                alternativeReason: useAlternative ? (item.alternativeReason || null) : null,
                originalPartNumber: useAlternative ? item.partNumber : null,
                ...(item.partId && {
                  part: {
                    connect: { id: item.partId },
                  },
                }),
                quantity: item.quantity,
                unitPrice: quote.unitPrice,
                totalPrice: quote.totalPrice,
                availability: quote.availability,
                supplierNotes: quote.notes,
              };
            }),
          },
        },
        include: {
          orderItems: {
            include: {
              part: true,
            },
          },
          supplier: true,
          vehicle: true,
        },
      });

      // Update quote request status
      await tx.quoteRequest.update({
        where: { id: quoteRequest.id },
        data: {
          status: 'CONVERTED_TO_ORDER',
          selectedSupplierId: supplierId,
        },
      });

      // Unlock manager threads - make them visible to the technician
      await tx.quoteRequestEmailThread.updateMany({
        where: { 
          quoteRequestId: quoteRequest.id, 
          threadRole: 'MANAGER' 
        },
        data: { visibleToCreator: true },
      });

      // Update supplier quote items to mark as selected
      await tx.supplierQuoteItem.updateMany({
        where: {
          supplierId,
          quoteRequestItemId: {
            in: selectedItems.map(item => item.id),
          },
        },
        data: {
          isSelected: true,
        },
      });

      // Update email thread status
      await tx.emailThread.update({
        where: { id: supplierThread.emailThread.id },
        data: {
          status: 'CONVERTED_TO_ORDER',
        },
      });

      // Update quote request email thread
      await tx.quoteRequestEmailThread.update({
        where: { id: supplierThread.id },
        data: {
          status: 'ACCEPTED',
        },
      });

      return newOrder;
    });

    // Record cost savings for this order (async, non-blocking)
    recordOrderCostSavings(order.id).catch(err => {
      console.error('Failed to record cost savings:', err);
    });

    // Send the email
    try {
      // Initialize email client using current user's credentials (supports Gmail and Microsoft)
      const emailClient = await getEmailClientForUser(session.user.id);
      
      if (!quoteRequest.supplier?.email) {
        return NextResponse.json({
          success: true,
          warning: 'Order created but supplier has no email address',
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            total: order.total,
            itemCount: order.orderItems.length,
          },
        });
      }

      // Convert plain text body to HTML
      const htmlBody = emailBody
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      // Get the last message for In-Reply-To
      const lastMessage = supplierThread.emailThread.messages[0];

      // Send the email
      const { messageId } = await emailClient.sendEmail(
        quoteRequest.supplier.email,
        emailSubject,
        `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
        undefined,
        undefined,
        {
          threadId: supplierThread.emailThread.externalThreadId || undefined,
          inReplyTo: lastMessage?.externalMessageId || undefined,
        }
      );

      // Get from email
      const fromEmail =
        quoteRequest.organization.billingEmail ||
        quoteRequest.createdBy.email ||
        session.user.email ||
        'noreply@example.com';

      // Create email message record
      await prisma.emailMessage.create({
        data: {
          threadId: supplierThread.emailThread.id,
          direction: 'OUTBOUND',
          from: fromEmail,
          to: quoteRequest.supplier.email,
          subject: emailSubject,
          body: emailBody,
          bodyHtml: htmlBody,
          sentAt: new Date(),
          externalMessageId: messageId,
        },
      });
    } catch (emailError: any) {
      console.error('Error sending order confirmation email:', emailError);
      // Order is created, but email failed - don't rollback
      return NextResponse.json({
        success: true,
        warning: 'Order created but email failed to send',
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: order.total,
          itemCount: order.orderItems.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        itemCount: order.orderItems.length,
      },
    });
  } catch (error: any) {
    console.error('Error confirming order:', error);
    return NextResponse.json(
      { error: 'Failed to confirm order' },
      { status: 500 }
    );
  }
}
