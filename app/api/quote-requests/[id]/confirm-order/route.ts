import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, canConvertToOrder } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { generateOrderNumber } from '@/lib/utils/order-number';
import { checkIdempotency, cacheResponse, getIdempotencyKey } from '@/lib/middleware/idempotency';

// POST /api/quote-requests/[id]/confirm-order - Actually create order and send email
// EDGE CASE #1: Protected by idempotency to prevent duplicate orders from double-clicking
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

    // EDGE CASE #1: Check for duplicate request via idempotency key
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const cachedResponse = await checkIdempotency(
        idempotencyKey,
        session.user.id,
        req.nextUrl.pathname
      );
      if (cachedResponse) {
        return NextResponse.json(cachedResponse, {
          headers: { 'X-Idempotency-Replay': 'true' }
        });
      }
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

    // EDGE CASE #18: Validate conversion lock before proceeding
    const lockCheck = await prisma.quoteRequest.findUnique({
      where: { id, organizationId },
      select: {
        isConverting: true,
        convertingBy: true,
        convertingStartedAt: true,
        status: true,
      },
    });

    if (!lockCheck) {
      return NextResponse.json({ error: 'Quote request not found' }, { status: 404 });
    }

    // Check if already converted
    if (lockCheck.status === 'CONVERTED_TO_ORDER') {
      return NextResponse.json({
        error: 'This quote has already been converted to an order',
        alreadyConverted: true,
      }, { status: 409 });
    }

    // Validate conversion lock
    if (!lockCheck.isConverting || lockCheck.convertingBy !== userId) {
      return NextResponse.json({
        error: 'Invalid conversion lock. Please restart the conversion process.',
        lockStatus: {
          isConverting: lockCheck.isConverting,
          convertingBy: lockCheck.convertingBy,
          currentUser: userId,
        },
      }, { status: 409 });
    }

    // Check lock freshness (5 minute threshold)
    const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    if (lockCheck.convertingStartedAt) {
      const lockAge = Date.now() - new Date(lockCheck.convertingStartedAt).getTime();
      if (lockAge > LOCK_TIMEOUT) {
        return NextResponse.json({
          error: 'Conversion lock has expired. Please restart the conversion process.',
          lockAge: Math.round(lockAge / 1000) + ' seconds',
        }, { status: 409 });
      }
    }

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
        managerTakeover: {
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

    // CRITICAL VALIDATION: Check email credentials BEFORE creating order
    // This prevents orphaned orders when email sending fails
    try {
      await getEmailClientForUser(session.user.id);
    } catch (credentialError: any) {
      return NextResponse.json({
        error: 'Cannot convert to order: Email credentials not configured',
        details: credentialError.message || 'Please set up your email integration in Settings before converting quotes to orders.',
        needsEmailSetup: true,
      }, { status: 400 });
    }

    // Validate supplier has email address
    if (!quoteRequest.supplier?.email) {
      return NextResponse.json({
        error: 'Cannot send order: Supplier does not have an email address',
        supplierId: supplierId,
      }, { status: 400 });
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
      finalInternalNotes += `\n⚠️ Converted with expired pricing (acknowledged by user). ${expiredItems.length} item(s) had expired quotes.`;
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

      // Update quote request status and release conversion lock
      await tx.quoteRequest.update({
        where: { id: quoteRequest.id },
        data: {
          status: 'CONVERTED_TO_ORDER',
          selectedSupplierId: supplierId,
          // EDGE CASE #18: Release conversion lock
          isConverting: false,
          convertingBy: null,
          convertingStartedAt: null,
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

    // Send the email
    try {
      // Initialize email client using current user's credentials (supports Gmail and Microsoft)
      // This was pre-validated earlier, but we need the actual client instance to send
      const emailClient = await getEmailClientForUser(session.user.id);

      // Convert plain text body to HTML
      const htmlBody = emailBody
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      // Get the last message for In-Reply-To
      const lastMessage = supplierThread.emailThread.messages[0];

      // Send the email
      const { messageId, threadId: gmailThreadId } = await emailClient.sendEmail(
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

      // Update externalThreadId if Gmail assigned a different thread
      // (happens when manager sends from a different Gmail account — the original
      // threadId doesn't exist in their account, so Gmail creates a new thread)
      if (gmailThreadId && gmailThreadId !== supplierThread.emailThread.externalThreadId) {
        await prisma.emailThread.update({
          where: { id: supplierThread.emailThread.id },
          data: { externalThreadId: gmailThreadId },
        });
      }

      // Get from email - use current user if manager takeover, otherwise use technician
      const isManagerTakeover = !!quoteRequest.managerTakeover;
      const fromEmail = isManagerTakeover
        ? (session.user.email || quoteRequest.organization.billingEmail || 'noreply@example.com')
        : (quoteRequest.createdBy.email || quoteRequest.organization.billingEmail || session.user.email || 'noreply@example.com');

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
      const response = {
        success: true,
        warning: 'Order created but email failed to send',
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: order.total,
          itemCount: order.orderItems.length,
        },
      };
      
      // EDGE CASE #1: Cache for idempotency
      if (idempotencyKey) {
        await cacheResponse(idempotencyKey, userId, req.nextUrl.pathname, response);
      }
      
      return NextResponse.json(response);
    }

    const response = {
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        itemCount: order.orderItems.length,
      },
    };
    
    // EDGE CASE #1: Cache successful response for idempotency
    if (idempotencyKey) {
      await cacheResponse(idempotencyKey, userId, req.nextUrl.pathname, response);
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error confirming order:', error);
    
    // EDGE CASE #18: Release conversion lock on error
    try {
      const session = await getServerSession();
      if (session?.user?.organizationId) {
        await prisma.quoteRequest.update({
          where: { id: await params.then(p => p.id), organizationId: session.user.organizationId },
          data: {
            isConverting: false,
            convertingBy: null,
            convertingStartedAt: null,
          },
        });
      }
    } catch (lockError) {
      console.error('Error releasing conversion lock:', lockError);
    }
    
    return NextResponse.json(
      { error: 'Failed to confirm order' },
      { status: 500 }
    );
  }
}
