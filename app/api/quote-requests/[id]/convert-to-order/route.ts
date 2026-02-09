import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, canConvertToOrder } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { generateOrderNumber } from '@/lib/utils/order-number';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';

// POST /api/quote-requests/[id]/convert-to-order - Generate email preview for order conversion
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to convert to order
    if (!canConvertToOrder(session.user.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to convert quotes to orders. Please request approval from a manager.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { supplierId, fulfillmentMethod, orderNotes, internalNotes, acknowledgeExpiry, itemSelections, includeSuggested, includeRequested } = await req.json();

    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
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
            emailThread: true,
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

    // CRITICAL VALIDATION: Check email credentials BEFORE generating preview
    // This provides immediate feedback to users who need to configure email
    try {
      await getEmailClientForUser(session.user.id);
    } catch (credentialError: any) {
      return NextResponse.json({
        error: 'Cannot convert to order: Email credentials not configured',
        details: credentialError.message || 'Please set up your email integration in Settings before converting quotes to orders.',
        needsEmailSetup: true,
      }, { status: 400 });
    }

    // Validation 0: Check approval requirement for technicians
    // Managers/admins can convert regardless of approval status (they ARE the approvers)
    const isManagerOrAdmin = ['ADMIN', 'MASTER_ADMIN', 'MANAGER'].includes(session.user.role);
    if (quoteRequest.requiresApproval && quoteRequest.status !== 'APPROVED' && !isManagerOrAdmin) {
      return NextResponse.json({
        error: 'This quote requires manager approval before it can be converted to an order',
        currentStatus: quoteRequest.status,
        requiresApproval: true,
      }, { status: 400 });
    }

    // Validation 1: Status check
    if (!['RECEIVED', 'APPROVED'].includes(quoteRequest.status)) {
      return NextResponse.json({
        error: 'Quote must be in RECEIVED or APPROVED status',
        currentStatus: quoteRequest.status,
      }, { status: 400 });
    }

    // Validation 2: Supplier responded
    const supplierThread = quoteRequest.emailThreads[0];
    if (!supplierThread || supplierThread.status !== 'RESPONDED') {
      return NextResponse.json({
        error: 'Supplier has not responded to this quote',
        supplierStatus: supplierThread?.status || 'NO_THREAD',
      }, { status: 400 });
    }

    // Validation 3: Has pricing data
    const supplierItems = quoteRequest.items.filter(item =>
      item.supplierQuotes && item.supplierQuotes.length > 0
    );

    if (supplierItems.length === 0) {
      return NextResponse.json({
        error: 'No pricing data from this supplier',
      }, { status: 400 });
    }

    // Validation 4: Check for expired quotes
    const expiredItems = supplierItems.filter(item =>
      item.supplierQuotes.some(sq =>
        sq.validUntil && new Date(sq.validUntil) < new Date()
      )
    );

    if (expiredItems.length > 0 && !acknowledgeExpiry) {
      return NextResponse.json({
        error: 'Quote has expired',
        expiredItems: expiredItems.map(i => ({
          partNumber: i.partNumber,
          validUntil: i.supplierQuotes[0].validUntil,
        })),
        requiresAcknowledgement: true,
      }, { status: 400 });
    }

    // Get supplier details
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Validate supplier has email address
    if (!supplier.email) {
      return NextResponse.json({
        error: 'Cannot send order: Supplier does not have an email address',
        supplierId: supplierId,
      }, { status: 400 });
    }

    // Filter items based on user selections
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

    // Calculate totals based on selected items
    const subtotal = selectedItems.reduce((sum, item) => {
      const quote = item.supplierQuotes[0];
      return sum + Number(quote.totalPrice);
    }, 0);

    // Preview order number (this is for preview only — the actual order number
    // is generated atomically inside the transaction in confirm-order)
    const orderCount = await prisma.order.count({
      where: { organizationId },
    });
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')} (preview)`;

    // Build parts list for email with selections applied
    const partsList = selectedItems
      .map((item, index) => {
        const quote = item.supplierQuotes[0];
        const selection = itemSelections?.[item.id] || 'ALTERNATIVE';
        const hasAlternative = item.isAlternative || item.isSuperseded || 
                              (quote?.supplierPartNumber && quote.supplierPartNumber !== item.partNumber);
        const useAlternative = selection === 'ALTERNATIVE' && hasAlternative;
        const actualPartNumber = useAlternative && quote.supplierPartNumber 
          ? quote.supplierPartNumber 
          : item.partNumber;
        
        let line = `${index + 1}. Part Number: ${actualPartNumber} (Qty: ${item.quantity}, Unit Price: $${Number(quote.unitPrice).toFixed(2)}, Total: $${Number(quote.totalPrice).toFixed(2)})`;
        
        if (useAlternative) {
          line += `\n   ⚠️ ALTERNATIVE PART: Originally requested ${item.partNumber}`;
          if (item.alternativeReason) {
            line += ` (${item.alternativeReason})`;
          }
        }
        
        if (selection === 'ORIGINAL' && hasAlternative) {
          line += `\n   📋 REQUESTING ORIGINAL PART: ${item.partNumber} (customer rejected alternative)`;
        }
        
        return line;
      })
      .join('\n');

    // Build vehicle info
    const vehicleInfo = quoteRequest.vehicle
      ? `${quoteRequest.vehicle.year || ''} ${quoteRequest.vehicle.make} ${quoteRequest.vehicle.model}${quoteRequest.vehicle.serialNumber ? ` (Serial: ${quoteRequest.vehicle.serialNumber})` : ''}`
      : 'Not specified';

    // Track rejected alternatives for notes
    const rejectedAlternatives = selectedItems.filter(item => {
      const selection = itemSelections?.[item.id];
      const quote = item.supplierQuotes[0];
      const hasAlternative = item.isAlternative || item.isSuperseded || 
                            (quote?.supplierPartNumber && quote.supplierPartNumber !== item.partNumber);
      return selection === 'ORIGINAL' && hasAlternative;
    });

    // Determine contact person (use current user if manager takeover, otherwise technician)
    const isManagerTakeover = !!quoteRequest.managerTakeover;
    const contactPerson = isManagerTakeover 
      ? { name: session.user.name, email: session.user.email }
      : quoteRequest.createdBy;
    
    // Generate email using AI with comprehensive context
    let emailContent: { subject: string; body: string };

    try {
      const llmClient = await OpenRouterClient.fromOrganization(organizationId);

      const prompt = `Generate a professional order confirmation email to send to a supplier.

CONTEXT:
- Company: ${quoteRequest.organization.name}
- Contact: ${contactPerson.name || contactPerson.email}
- Order Number: ${orderNumber} (Pending)
- Supplier: ${supplier.name}
- Quote Reference: ${quoteRequest.quoteNumber}
- Vehicle: ${vehicleInfo}
- Fulfillment Method: ${fulfillmentMethod || 'DELIVERY'}
${isManagerTakeover ? `- IMPORTANT: This order is being placed by ${contactPerson.name || 'a manager'} in regards to previous conversations between ${quoteRequest.createdBy.name || 'technician'} and ${supplier.name}
` : ''}

ORDER ITEMS (${selectedItems.length} items):
${partsList}

ORDER TOTALS:
- Subtotal: $${subtotal.toFixed(2)}
- Total: $${subtotal.toFixed(2)}

${orderNotes ? `SPECIAL INSTRUCTIONS:\n${orderNotes}\n\n` : ''}${rejectedAlternatives.length > 0 ? `⚠️ FOLLOW-UP REQUIRED: Customer rejected alternative parts for ${rejectedAlternatives.length} item(s) and requests original parts. Please confirm availability and pricing of original parts.\n\n` : ''}${expiredItems.length > 0 ? `⚠️ Note: Some items had expired quotes. Please confirm current pricing.\n\n` : ''}REQUIREMENTS:
1. Generate a subject line that includes the order number
2. Generate a professional order confirmation email that:
   - Confirms the order has been placed
   ${isManagerTakeover ? `- Mentions this is in regards to previous communications with ${quoteRequest.createdBy.name || 'the technician'}
   ` : ''}- References the quote (Quote #${quoteRequest.quoteNumber})
   - Lists all ordered items with quantities and prices
   - IMPORTANT: For items marked as "ALTERNATIVE PART", clearly note this is an alternative/aftermarket part and confirm we accept it
   - IMPORTANT: For items marked as "REQUESTING ORIGINAL PART", ask supplier to confirm availability and pricing of the original part number
   - Includes the order total
   - Mentions the preferred fulfillment method (${fulfillmentMethod || 'DELIVERY'})
   ${(fulfillmentMethod || 'DELIVERY') === 'PICKUP' ? '- Confirms the pickup location and asks for availability date' : '- Requests tracking information (tracking number, carrier, estimated delivery date)\n   - Requests shipment confirmation when items are dispatched'}
   ${orderNotes ? `- Includes the special instructions: "${orderNotes}"` : ''}
   - Asks for any relevant documentation (packing slip, invoices, etc.)
   - Maintains a professional, appreciative tone
   - Is well-structured and easy to read

Output your response as JSON with the following structure:
{
  "subject": "Order Confirmation - [order number]",
  "body": "the email body (use \\n for line breaks)"
}`;

      const response = await llmClient.generateStructuredOutput<{
        subject: string;
        body: string;
      }>(prompt, {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['subject', 'body'],
      });

      emailContent = response;
    } catch (error: any) {
      console.error('AI email generation failed:', error);

      // Fallback to template-based email
      const isPickup = (fulfillmentMethod || 'DELIVERY') === 'PICKUP';
      
      emailContent = {
        subject: `Order Confirmation - ${orderNumber}`,
        body: `Dear ${supplier.name},\n\n${isManagerTakeover ? `I am reaching out regarding your previous conversations with ${quoteRequest.createdBy.name || 'our technician'}.\n\n` : ''}We are pleased to confirm our order based on your quote ${quoteRequest.quoteNumber}.\n\nOrder Details:\n${partsList}\n\nTotal: $${subtotal.toFixed(2)}\n\nFulfillment Method: ${fulfillmentMethod || 'DELIVERY'}\n${isPickup ? 'Please let us know when the order is ready for pickup.' : 'Please provide tracking information once the order ships.'}\n\n${orderNotes ? `Special Instructions:\n${orderNotes}\n\n` : ''}Best regards,\n${contactPerson.name || 'The Team'}\n${quoteRequest.organization.name}`,
      };
    }

    // Return email preview and order data for confirmation
    return NextResponse.json({
      success: true,
      emailPreview: emailContent,
      orderPreview: {
        orderNumber,
        supplierId,
        supplierName: supplier.name,
        supplierEmail: supplier.email,
        itemCount: selectedItems.length,
        subtotal,
        total: subtotal,
        fulfillmentMethod: fulfillmentMethod || 'DELIVERY',
        hasExpiredItems: expiredItems.length > 0,
        hasRejectedAlternatives: rejectedAlternatives.length > 0,
      },
      // Pass through data needed for actual order creation
      orderData: {
        supplierId,
        fulfillmentMethod,
        orderNotes,
        internalNotes,
        acknowledgeExpiry,
        itemSelections,
        includeSuggested,
        includeRequested,
      },
    });
  } catch (error: any) {
    console.error('Error converting quote to order:', error);
    return NextResponse.json(
      { error: 'Failed to convert quote to order' },
      { status: 500 }
    );
  }
}
