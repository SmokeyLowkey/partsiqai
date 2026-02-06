import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { z } from 'zod';

const GenerateConfirmationSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
});

// POST /api/orders/[id]/generate-confirmation - Generate order confirmation email content
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
    const validationResult = GenerateConfirmationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { supplierId } = validationResult.data;

    // Get order with all necessary data
    const order = await prisma.order.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        orderItems: true,
        supplier: true,
        vehicle: {
          select: {
            make: true,
            model: true,
            year: true,
            serialNumber: true,
          },
        },
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

    // Get quote reference if exists
    let quoteNumber: string | null = null;
    if (order.quoteReference) {
      const quoteRef = await prisma.quoteRequest.findUnique({
        where: { id: order.quoteReference },
        select: { quoteNumber: true },
      });
      quoteNumber = quoteRef?.quoteNumber || null;
    }

    // Build parts list for reference
    const partsList = order.orderItems
      .map(
        (item, index) => {
          let line = `${index + 1}. Part Number: ${item.partNumber} (Qty: ${item.quantity}, Unit Price: $${Number(item.unitPrice).toFixed(2)}, Total: $${Number(item.totalPrice).toFixed(2)})`;
          
          // Add alternative part information
          // @ts-ignore - New fields added in schema migration
          if (item.isAlternative && item.originalPartNumber) {
            // @ts-ignore
            line += `\n   ⚠️ ALTERNATIVE PART: Originally requested ${item.originalPartNumber}`;
            // @ts-ignore
            if (item.alternativeReason) {
              // @ts-ignore
              line += ` (${item.alternativeReason})`;
            }
          }
          
          return line;
        }
      )
      .join('\n');

    // Build vehicle info
    const vehicleInfo = order.vehicle
      ? `${order.vehicle.year || ''} ${order.vehicle.make} ${order.vehicle.model}${order.vehicle.serialNumber ? ` (Serial: ${order.vehicle.serialNumber})` : ''}`
      : 'Not specified';

    // Calculate order totals
    const subtotalValue = Number(order.subtotal);
    const taxValue = order.tax ? Number(order.tax) : 0;
    const shippingValue = order.shipping ? Number(order.shipping) : 0;
    const totalValue = Number(order.total);

    // Generate email using AI
    let emailContent: { subject: string; body: string };

    try {
      const llmClient = await OpenRouterClient.fromOrganization(
        session.user.organizationId
      );

      const prompt = `Generate a professional order confirmation email to send to a supplier.

CONTEXT:
- Company: ${order.organization.name}
- Contact: ${order.createdBy.name || order.createdBy.email}
- Order Number: ${order.orderNumber}
- Supplier: ${order.supplier.name}
- Quote Reference: ${quoteNumber || 'N/A'}
- Vehicle: ${vehicleInfo}
- Fulfillment Method: ${order.fulfillmentMethod}
- Expected Date: ${order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : 'TBD'}

ORDER ITEMS:
${partsList}

ORDER TOTALS:
- Subtotal: $${subtotalValue.toFixed(2)}
${order.shipping ? `- Shipping: $${shippingValue.toFixed(2)}` : ''}
${order.tax ? `- Tax: $${taxValue.toFixed(2)}` : ''}
- Total: $${totalValue.toFixed(2)}

${order.notes ? `NOTES:\n${order.notes}` : ''}

REQUIREMENTS:
1. Generate a subject line that includes the order number
2. Generate a professional order confirmation email that:
   - Confirms the order has been placed
   - References the quote if applicable (Quote #${quoteNumber || ''})
   - Lists all ordered items with quantities and prices
   - IMPORTANT: For items marked as "ALTERNATIVE PART", clearly note this is an alternative/aftermarket part and confirm we accept it
   - Includes the order total
   - Mentions the preferred fulfillment method (${order.fulfillmentMethod})${order.fulfillmentMethod === 'PICKUP' || order.fulfillmentMethod === 'DELIVERY' || order.fulfillmentMethod === 'SPLIT' ? '\n   - Confirms the pickup location and availability date' : '\n   - Requests tracking information (tracking number, carrier, estimated delivery date)\n   - Requests shipment confirmation when items are dispatched'}
   - Asks for any relevant documentation (packing slip, invoices, etc.)
   - Maintains a professional, appreciative tone
   - Is well-structured and easy to read
   - Includes a professional signature

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
      console.error('AI confirmation generation failed:', error);

      // Fallback to template-based email
      const isPickup = order.fulfillmentMethod === 'PICKUP';
      
      emailContent = {
        subject: `Order Confirmation - ${order.orderNumber}`,
        body: `Dear ${order.supplier.name},

We are pleased to confirm our purchase order for the following items:

Order Number: ${order.orderNumber}
${quoteNumber ? `Quote Reference: ${quoteNumber}` : ''}
Order Date: ${new Date(order.orderDate).toLocaleDateString()}
Vehicle: ${vehicleInfo}

ITEMS ORDERED:
${partsList}

ORDER TOTAL: $${totalValue.toFixed(2)}

${isPickup ? `Fulfillment Method: Store Pickup
Please confirm when the items are ready for pickup and provide the pickup location details.` : `Please provide the following information at your earliest convenience:
- Tracking number and carrier information
- Estimated delivery date
- Shipment confirmation when dispatched`}

Please include any relevant documentation (packing slip, invoice, etc.)

${order.notes ? `Additional Notes:\n${order.notes}\n\n` : ''}Thank you for your prompt attention to this order. We look forward to receiving the parts.

Best regards,
${order.createdBy.name || order.organization.name}
${order.createdBy.email}`,
      };
    }

    return NextResponse.json({
      email: emailContent,
    });
  } catch (error: any) {
    console.error('Error generating order confirmation:', error);
    return NextResponse.json(
      { error: 'Failed to generate order confirmation' },
      { status: 500 }
    );
  }
}
