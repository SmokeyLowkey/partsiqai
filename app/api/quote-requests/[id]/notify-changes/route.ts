import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { z } from 'zod';

const ChangeNotificationSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { changes } = body;

    if (!changes || !Array.isArray(changes)) {
      return NextResponse.json(
        { error: 'Changes array is required' },
        { status: 400 }
      );
    }

    // Get quote request with all details
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            supplierQuotes: {
              include: {
                supplier: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        vehicle: true,
        emailThreads: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    if (quoteRequest.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Categorize changes
    const addedItems = changes.filter((c: any) => c.changeType === 'added');
    const removedItems = changes.filter((c: any) => c.changeType === 'removed');
    const modifiedItems = changes.filter((c: any) => c.changeType === 'modified');

    // Send notifications to suppliers who have been contacted (SENT or RESPONDED status)
    const suppliersToNotify = quoteRequest.emailThreads.filter(
      (et) => et.status === 'SENT' || et.status === 'RESPONDED'
    );

    if (suppliersToNotify.length === 0) {
      return NextResponse.json({
        message: 'No suppliers to notify (no active threads)',
        notified: 0,
      });
    }

    const notifications: any[] = [];
    const organizationId = session.user.organizationId;

    // Calculate pricing context for intelligent suggestions
    const pricingContext = calculatePricingContext(quoteRequest);

    // Initialize email client using current user's credentials (supports Gmail and Microsoft)
    const emailClient = await getEmailClientForUser(session.user.id);

    for (const emailThread of suppliersToNotify) {
      if (!emailThread.supplier?.email) continue;

      try {
        // Get supplier-specific pricing context
        const supplierPricing = pricingContext.supplierPrices.get(emailThread.supplier.id);
        
        // Generate change notification email
        const notification = await generateChangeNotification(
          quoteRequest,
          emailThread.supplier,
          addedItems,
          removedItems,
          modifiedItems,
          organizationId,
          supplierPricing,
          pricingContext
        );

        // Send email
        const latestMessage = emailThread.emailThread.messages[0];
        const threadId = emailThread.emailThread.externalThreadId || undefined;
        const inReplyTo = latestMessage?.externalMessageId || undefined;

        const sentMessage = await emailClient.sendEmail(
          emailThread.supplier.email,
          notification.subject,
          notification.body,
          undefined,
          undefined,
          { threadId, inReplyTo }
        );

        // Create email message record
        await prisma.emailMessage.create({
          data: {
            threadId: emailThread.emailThread.id,
            externalMessageId: sentMessage.messageId,
            subject: notification.subject,
            body: notification.body,
            bodyHtml: notification.body,
            from: session.user.email!,
            to: emailThread.supplier.email,
            direction: 'OUTBOUND',
            sentAt: new Date(),
            inReplyTo: inReplyTo || null,
          },
        });

        // Update thread status and externalThreadId (may differ if sent from different account)
        await prisma.emailThread.update({
          where: { id: emailThread.emailThread.id },
          data: {
            status: 'WAITING_RESPONSE',
            externalThreadId: sentMessage.threadId || emailThread.emailThread.externalThreadId,
          },
        });

        notifications.push({
          supplierId: emailThread.supplier.id,
          supplierName: emailThread.supplier.name,
          supplierEmail: emailThread.supplier.email,
          success: true,
        });
      } catch (error) {
        console.error(
          `Failed to notify supplier ${emailThread.supplier.id}:`,
          error
        );
        notifications.push({
          supplierId: emailThread.supplier.id,
          supplierName: emailThread.supplier.name,
          supplierEmail: emailThread.supplier.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Notifications sent',
      notified: notifications.filter((n) => n.success).length,
      failed: notifications.filter((n) => !n.success).length,
      details: notifications,
    });
  } catch (error) {
    console.error('Error notifying suppliers of changes:', error);
    return NextResponse.json(
      { error: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}

async function generateChangeNotification(
  quoteRequest: any,
  supplier: any,
  addedItems: any[],
  removedItems: any[],
  modifiedItems: any[],
  organizationId: string,
  supplierPricing?: SupplierPricingContext,
  pricingContext?: PricingContext
): Promise<{ subject: string; body: string }> {
  // Build change summary text
  const changeSummary = buildChangeSummary(addedItems, removedItems, modifiedItems);

  // Build pricing intelligence summary
  const pricingSummary = buildPricingSummary(supplierPricing, pricingContext);

  // Try AI generation first
  try {
    // Initialize OpenRouter client using fromOrganization
    const llmClient = await OpenRouterClient.fromOrganization(organizationId);

    const prompt = `Generate a professional email to notify a supplier about changes to a quote request.

Quote Request Details:
- Quote ID: ${quoteRequest.id}
- Vehicle: ${quoteRequest.vehicle?.year} ${quoteRequest.vehicle?.make} ${quoteRequest.vehicle?.model}
- VIN: ${quoteRequest.vehicle?.vin || 'Not provided'}

Changes Made:
${changeSummary}

Current Items in Quote:
${quoteRequest.items.map((item: any, idx: number) => `${idx + 1}. Part: ${item.partNumber} - ${item.description} (Qty: ${item.quantity})`).join('\n')}

Supplier Information:
- Supplier: ${supplier.name}

${pricingSummary}

Requirements:
1. Professional and courteous tone
2. Clearly explain what changed (items added, removed, or modified)
3. Provide the complete updated parts list
4. ${supplierPricing?.previousTotal ? `Mention their previous quote of $${supplierPricing.previousTotal.toFixed(2)}` : 'Request their quote for the updated items'}
5. ${pricingContext?.suggestedReduction ? `Politely suggest a ${pricingContext.suggestedReduction}% price reduction to remain competitive` : 'Request competitive pricing'}
6. Maintain the existing conversation thread context
7. Use HTML formatting for good readability
8. Highlight additions in green and removals in red using HTML
9. If previous quotes exist, show them in a comparison table

Generate a JSON response with:
{
  "subject": "Quote Request Updated - [Quote ID]",
  "body": "HTML formatted email body"
}`;

    const response = await llmClient.generateStructuredOutput<{ subject: string; body: string }>(
      prompt,
      ChangeNotificationSchema
    );

    return response;
  } catch (error) {
    console.error('AI generation failed, using template:', error);
    return generateTemplateNotification(
      quoteRequest,
      supplier,
      addedItems,
      removedItems,
      modifiedItems,
      changeSummary,
      supplierPricing,
      pricingContext
    );
  }
}

interface SupplierPricingContext {
  supplierId: string;
  previousTotal: number;
  itemQuotes: Array<{
    partNumber: string;
    unitPrice: number;
    totalPrice: number;
  }>;
}

interface PricingContext {
  supplierPrices: Map<string, SupplierPricingContext>;
  lowestTotal?: number;
  averageTotal?: number;
  suggestedReduction?: number;
}

function calculatePricingContext(quoteRequest: any): PricingContext {
  const supplierPrices = new Map<string, SupplierPricingContext>();
  const totals: number[] = [];

  // Aggregate pricing by supplier
  for (const item of quoteRequest.items) {
    for (const quote of item.supplierQuotes || []) {
      const supplierId = quote.supplierId;
      
      if (!supplierPrices.has(supplierId)) {
        supplierPrices.set(supplierId, {
          supplierId,
          previousTotal: 0,
          itemQuotes: [],
        });
      }

      const supplierCtx = supplierPrices.get(supplierId)!;
      supplierCtx.previousTotal += parseFloat(quote.totalPrice.toString());
      supplierCtx.itemQuotes.push({
        partNumber: item.partNumber,
        unitPrice: parseFloat(quote.unitPrice.toString()),
        totalPrice: parseFloat(quote.totalPrice.toString()),
      });
    }
  }

  // Calculate totals for comparison
  for (const [_, ctx] of supplierPrices) {
    totals.push(ctx.previousTotal);
  }

  const lowestTotal = totals.length > 0 ? Math.min(...totals) : undefined;
  const averageTotal = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : undefined;
  
  // Calculate suggested reduction (5-15% based on how far above the lowest quote)
  let suggestedReduction: number | undefined;
  if (lowestTotal && averageTotal && lowestTotal < averageTotal) {
    const difference = ((averageTotal - lowestTotal) / averageTotal) * 100;
    if (difference > 20) {
      suggestedReduction = 15;
    } else if (difference > 10) {
      suggestedReduction = 10;
    } else if (difference > 5) {
      suggestedReduction = 5;
    }
  }

  return {
    supplierPrices,
    lowestTotal,
    averageTotal,
    suggestedReduction,
  };
}

function buildPricingSummary(
  supplierPricing?: SupplierPricingContext,
  pricingContext?: PricingContext
): string {
  if (!supplierPricing && !pricingContext) {
    return 'Pricing Context: No previous quotes available.';
  }

  const parts: string[] = ['Pricing Context:'];

  if (supplierPricing) {
    parts.push(`- Their Previous Quote: $${supplierPricing.previousTotal.toFixed(2)}`);
    parts.push(`  Items Quoted:`);
    supplierPricing.itemQuotes.forEach(q => {
      parts.push(`    • ${q.partNumber}: $${q.unitPrice.toFixed(2)} each ($${q.totalPrice.toFixed(2)} total)`);
    });
  }

  if (pricingContext) {
    if (pricingContext.lowestTotal) {
      parts.push(`- Best Competitive Quote: $${pricingContext.lowestTotal.toFixed(2)}`);
    }
    if (pricingContext.averageTotal) {
      parts.push(`- Market Average: $${pricingContext.averageTotal.toFixed(2)}`);
    }
    if (pricingContext.suggestedReduction) {
      parts.push(`- Suggested Price Reduction: ${pricingContext.suggestedReduction}% to remain competitive`);
    }
  }

  return parts.join('\n');
}

function buildChangeSummary(
  addedItems: any[],
  removedItems: any[],
  modifiedItems: any[]
): string {
  const parts: string[] = [];

  if (addedItems.length > 0) {
    parts.push(`Added ${addedItems.length} item(s):\n${addedItems.map(item => `  - ${item.partNumber}: ${item.description} (Qty: ${item.quantity})`).join('\n')}`);
  }

  if (removedItems.length > 0) {
    parts.push(`Removed ${removedItems.length} item(s):\n${removedItems.map(item => `  - ${item.partNumber}: ${item.description}`).join('\n')}`);
  }

  if (modifiedItems.length > 0) {
    parts.push(`Modified ${modifiedItems.length} item(s):\n${modifiedItems.map(item => `  - ${item.partNumber}: ${item.description} (Qty: ${item.quantity})`).join('\n')}`);
  }

  return parts.join('\n\n');
}

function generateTemplateNotification(
  quoteRequest: any,
  supplier: any,
  addedItems: any[],
  removedItems: any[],
  modifiedItems: any[],
  changeSummary: string,
  supplierPricing?: SupplierPricingContext,
  pricingContext?: PricingContext
): { subject: string; body: string } {
  const subject = `Quote Request Updated - ${quoteRequest.id}`;

  // Build previous quote section if available
  const previousQuoteSection = supplierPricing ? `
    <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <h4 style="margin-top: 0; color: #92400e;">Your Previous Quote: $${supplierPricing.previousTotal.toFixed(2)}</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background-color: #fde68a;">
            <th style="padding: 8px; text-align: left; border: 1px solid #fbbf24;">Part</th>
            <th style="padding: 8px; text-align: right; border: 1px solid #fbbf24;">Unit Price</th>
            <th style="padding: 8px; text-align: right; border: 1px solid #fbbf24;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${supplierPricing.itemQuotes.map(q => `
            <tr>
              <td style="padding: 8px; border: 1px solid #fbbf24;">${q.partNumber}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #fbbf24;">$${q.unitPrice.toFixed(2)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #fbbf24;">$${q.totalPrice.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  // Build competitive pricing section
  const competitivePricingSection = (pricingContext?.lowestTotal || pricingContext?.suggestedReduction) ? `
    <div style="background-color: #dbeafe; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <h4 style="margin-top: 0; color: #1e40af;">Competitive Pricing Insights</h4>
      ${pricingContext.lowestTotal ? `<p style="margin: 5px 0;">📊 Current Best Quote: <strong>$${pricingContext.lowestTotal.toFixed(2)}</strong></p>` : ''}
      ${pricingContext.averageTotal ? `<p style="margin: 5px 0;">📈 Market Average: <strong>$${pricingContext.averageTotal.toFixed(2)}</strong></p>` : ''}
      ${pricingContext.suggestedReduction ? `
        <p style="margin: 10px 0; padding: 10px; background-color: #bfdbfe; border-radius: 3px;">
          💡 <strong>Suggestion:</strong> A <strong>${pricingContext.suggestedReduction}%</strong> price reduction would make your quote more competitive while maintaining a fair margin.
        </p>
      ` : ''}
    </div>
  ` : '';

  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Quote Request Updated</h2>
      
      <p>Dear ${supplier.name},</p>
      
      <p>We have made changes to our quote request <strong>${quoteRequest.id}</strong> for the following vehicle:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <strong>${quoteRequest.vehicle?.year} ${quoteRequest.vehicle?.make} ${quoteRequest.vehicle?.model}</strong><br>
        ${quoteRequest.vehicle?.vin ? `VIN: ${quoteRequest.vehicle.vin}` : ''}
      </div>

      ${previousQuoteSection}
      ${competitivePricingSection}
      
      <h3>Changes Made:</h3>
      
      ${addedItems.length > 0 ? `
        <div style="margin: 15px 0;">
          <strong style="color: #16a34a;">✓ Added Items (${addedItems.length}):</strong>
          <ul style="color: #16a34a;">
            ${addedItems.map(item => `<li><strong>${item.partNumber}</strong>: ${item.description} (Qty: ${item.quantity})</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${removedItems.length > 0 ? `
        <div style="margin: 15px 0;">
          <strong style="color: #dc2626;">✗ Removed Items (${removedItems.length}):</strong>
          <ul style="color: #dc2626; text-decoration: line-through;">
            ${removedItems.map(item => `<li><strong>${item.partNumber}</strong>: ${item.description}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${modifiedItems.length > 0 ? `
        <div style="margin: 15px 0;">
          <strong style="color: #2563eb;">↻ Modified Items (${modifiedItems.length}):</strong>
          <ul style="color: #2563eb;">
            ${modifiedItems.map(item => `<li><strong>${item.partNumber}</strong>: ${item.description} (Qty: ${item.quantity})</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      <h3>Complete Updated Parts List:</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">#</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Part Number</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Description</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${quoteRequest.items.map((item: any, idx: number) => `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">${idx + 1}</td>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>${item.partNumber}</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${item.description}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <p>Please review these changes and provide an updated quote at your earliest convenience.</p>
      
      <p>If you have any questions about these changes, please don't hesitate to reach out.</p>
      
      <p>Thank you for your continued support!</p>
      
      <p>Best regards,<br>
      ${quoteRequest.createdBy.name}<br>
      ${quoteRequest.createdBy.email}</p>
    </div>
  `;

  return { subject, body };
}
