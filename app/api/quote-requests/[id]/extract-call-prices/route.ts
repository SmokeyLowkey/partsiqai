import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { z } from 'zod';

// Same schema as email extraction for consistency
const ExtractedQuoteSchema = z.object({
  quoteNumber: z.string().nullable().optional(),
  totalAmount: z.number().nullable().optional(),
  currency: z.string().default('USD'),
  validUntil: z.string().nullable().optional(),
  items: z.array(
    z.object({
      partNumber: z.string(),
      description: z.string().optional().default(''),
      quantity: z.number().optional().default(1),
      unitPrice: z.number(),
      totalPrice: z.number(),
      leadTime: z.string().nullable().optional(),
      availability: z.string().nullable().optional(),
      availabilityNote: z.string().nullable().optional(),
    })
  ).default([]),
  notes: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  shippingMethod: z.string().nullable().optional(),
  shippingCost: z.number().nullable().optional(),
});

type ExtractedQuoteData = z.infer<typeof ExtractedQuoteSchema>;

// POST /api/quote-requests/[id]/extract-call-prices
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
    const organizationId = session.user.organizationId;

    // Get quote request with items
    const whereClause: any = {
      id,
      organizationId,
    };

    // Technicians can only extract from their own quotes
    if (session.user.role === 'TECHNICIAN') {
      whereClause.createdById = session.user.id;
    }

    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: whereClause,
      include: {
        items: true,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: 'Quote request not found' },
        { status: 404 }
      );
    }

    // Get requested part numbers for context
    const requestedPartNumbers = quoteRequest.items
      .map((item) => item.partNumber)
      .filter(Boolean);

    console.log('[Extract Call Prices] Quote request:', id);
    console.log('[Extract Call Prices] Requested part numbers:', requestedPartNumbers);

    // Get completed calls for this quote request
    const calls = await prisma.supplierCall.findMany({
      where: {
        quoteRequestId: id,
        status: 'COMPLETED',
        conversationLog: { not: null as any },
      },
      include: {
        supplier: true,
      },
    });

    if (calls.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        totalItemsExtracted: 0,
        message: 'No completed calls found for this quote request.',
      });
    }

    // Try to get LLM client
    let llmClient: OpenRouterClient | null = null;
    try {
      llmClient = await OpenRouterClient.fromOrganization(organizationId);
    } catch (error: any) {
      console.warn('[Extract Call Prices] Failed to initialize LLM client:', error.message);
      return NextResponse.json(
        { error: 'LLM client not configured. Please set up OpenRouter in integrations.' },
        { status: 400 }
      );
    }

    const results: Array<{
      supplierId: string;
      supplierName: string;
      itemsExtracted: number;
      success: boolean;
      error?: string;
    }> = [];

    // Process each call
    for (const call of calls) {
      const supplier = call.supplier;
      const conversationLog = call.conversationLog as any;

      if (!supplier || !conversationLog?.conversationHistory) {
        continue;
      }

      console.log(`[Extract Call Prices] Processing call to ${supplier.name}...`);

      try {
        // Build transcript text from conversation history
        const transcript = conversationLog.conversationHistory
          .map((msg: any) => {
            const role = msg.speaker === 'ai' ? 'AI AGENT' : 'SUPPLIER';
            return `${role}: ${msg.text}`;
          })
          .join('\n');

        if (!transcript.trim()) {
          console.log(`[Extract Call Prices] Empty transcript for call to ${supplier.name}`);
          continue;
        }

        console.log(`[Extract Call Prices] Transcript length: ${transcript.length} chars`);

        // Use LLM to extract pricing
        const extractionPrompt = `You are a specialized assistant that extracts structured quote/pricing information from phone call transcripts between an AI purchasing agent and a parts supplier.

CONTEXT: Our AI agent called the supplier (${supplier.name}) to get prices on these parts: ${requestedPartNumbers.length > 0 ? requestedPartNumbers.join(', ') : '(extract all pricing info)'}

PHONE CALL TRANSCRIPT:
${transcript}

INSTRUCTIONS:
1. Extract ALL items with pricing mentioned in the conversation
2. Match items to the requested part numbers: ${requestedPartNumbers.join(', ')}
3. For each item found, extract: part number, description, quantity, unit price, total price, lead time, availability
4. Pay attention to how prices are stated verbally (e.g. "three thousand fourteen dollars and twenty cents" = $3014.20)
5. Part numbers may be spoken phonetically (e.g. "A H C one eight five nine eight" = AHC18598)
6. AVAILABILITY RULES:
   - Use "IN_STOCK" for: explicitly says "in stock", "on hand", "ships today", "we have it"
   - Use "BACKORDERED" for: backordered, out of stock, any wait time
   - Use "SPECIAL_ORDER" for: special order, custom order
   - Use null if unclear
7. availabilityNote: Include any relevant supplier comments about the item

Respond with a JSON object in this EXACT format:
{
  "quoteNumber": null,
  "totalAmount": total amount as number or null,
  "currency": "USD",
  "validUntil": null,
  "items": [
    {
      "partNumber": "exact part number",
      "description": "part description",
      "quantity": quantity as number,
      "unitPrice": unit price as number,
      "totalPrice": total price as number,
      "leadTime": "lead time info or null",
      "availability": "IN_STOCK, BACKORDERED, SPECIAL_ORDER, or null",
      "availabilityNote": "supplier comments about availability, or null"
    }
  ],
  "notes": "any special notes or conditions mentioned",
  "paymentTerms": "payment terms if mentioned (e.g. cash account)",
  "shippingMethod": null,
  "shippingCost": null
}

IMPORTANT: Numbers should be numbers, not strings.`;

        let extractedData: ExtractedQuoteData = { items: [], currency: 'USD' };

        try {
          extractedData = await llmClient.generateStructuredOutput<ExtractedQuoteData>(
            extractionPrompt,
            ExtractedQuoteSchema
          );
          console.log(`[Extract Call Prices] LLM extracted ${extractedData.items.length} items from ${supplier.name}`);
        } catch (llmError: any) {
          console.error('[Extract Call Prices] LLM extraction failed:', llmError.message);
          results.push({
            supplierId: supplier.id,
            supplierName: supplier.name,
            itemsExtracted: 0,
            success: false,
            error: `LLM extraction failed: ${llmError.message}`,
          });
          continue;
        }

        // Save extracted data to SupplierQuoteItem records
        let itemsCreated = 0;
        for (const item of extractedData.items) {
          const normalizedExtractedPart = item.partNumber.replace(/[\s-]/g, '').toUpperCase();

          // First try exact match, then case-insensitive
          let existingItem = await prisma.quoteRequestItem.findFirst({
            where: {
              quoteRequestId: id,
              OR: [
                { partNumber: item.partNumber },
                { partNumber: { equals: item.partNumber, mode: 'insensitive' } },
              ],
            },
          });

          // If no match, try normalized version
          if (!existingItem) {
            const allItems = await prisma.quoteRequestItem.findMany({
              where: { quoteRequestId: id },
            });
            existingItem = allItems.find((qri) => {
              const normalizedDbPart = qri.partNumber.replace(/[\s-]/g, '').toUpperCase();
              return normalizedDbPart === normalizedExtractedPart;
            }) || null;
          }

          if (existingItem) {
            // Parse availability
            const availabilityMap: Record<string, 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN'> = {
              'IN_STOCK': 'IN_STOCK',
              'IN STOCK': 'IN_STOCK',
              'AVAILABLE': 'IN_STOCK',
              'BACKORDERED': 'BACKORDERED',
              'BACK ORDERED': 'BACKORDERED',
              'BACKORDER': 'BACKORDERED',
              'SPECIAL_ORDER': 'SPECIAL_ORDER',
              'SPECIAL ORDER': 'SPECIAL_ORDER',
              'OUT_OF_STOCK': 'BACKORDERED',
              'OUT OF STOCK': 'BACKORDERED',
            };
            const availabilityValue = item.availability?.toUpperCase() || '';
            let availability = availabilityMap[availabilityValue] || 'UNKNOWN';

            // Parse lead time
            let leadTimeDays: number | null = null;
            if (item.leadTime) {
              const leadTimeMatch = item.leadTime.match(/(\d+)/);
              if (leadTimeMatch) {
                leadTimeDays = parseInt(leadTimeMatch[1]);
                if (item.leadTime.toLowerCase().includes('week')) {
                  leadTimeDays *= 7;
                }
              }
            }

            // Override: if marked IN_STOCK but has a lead time, it's actually backordered
            if (availability === 'IN_STOCK' && leadTimeDays && leadTimeDays > 0) {
              availability = 'BACKORDERED';
            }

            const noteText = item.availabilityNote || item.leadTime || item.availability;

            // Skip if no pricing
            if (item.unitPrice === null && item.totalPrice === null) {
              console.log(`[Extract Call Prices] Skipping ${item.partNumber} - no pricing`);
              continue;
            }

            // Create or update SupplierQuoteItem
            await prisma.supplierQuoteItem.upsert({
              where: {
                quoteRequestItemId_supplierId: {
                  quoteRequestItemId: existingItem.id,
                  supplierId: supplier.id,
                },
              },
              update: {
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                currency: extractedData.currency || 'USD',
                availability,
                leadTimeDays,
                notes: noteText ? `${noteText} (extracted from phone call)` : 'Extracted from phone call',
                validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : null,
              },
              create: {
                quoteRequestItemId: existingItem.id,
                supplierId: supplier.id,
                unitPrice: item.unitPrice || 0,
                totalPrice: item.totalPrice || 0,
                currency: extractedData.currency || 'USD',
                availability,
                leadTimeDays,
                notes: noteText ? `${noteText} (extracted from phone call)` : 'Extracted from phone call',
                validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : null,
              },
            });

            itemsCreated++;
          } else {
            console.log(`[Extract Call Prices] No matching item for part number: ${item.partNumber}`);
          }
        }

        results.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          itemsExtracted: itemsCreated,
          success: true,
        });
      } catch (error: any) {
        console.error(`[Extract Call Prices] Error processing ${supplier.name}:`, error);
        results.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          itemsExtracted: 0,
          success: false,
          error: error.message,
        });
      }
    }

    // Update quote request status if we extracted any prices
    const totalItemsExtracted = results.reduce((sum, r) => sum + r.itemsExtracted, 0);
    if (totalItemsExtracted > 0) {
      await prisma.quoteRequest.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          responseDate: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      results,
      totalItemsExtracted,
      message: totalItemsExtracted > 0
        ? `Extracted ${totalItemsExtracted} item prices from ${results.filter((r) => r.success).length} call(s)`
        : 'No pricing data found in call transcripts.',
    });
  } catch (error: any) {
    console.error('[Extract Call Prices] API error:', error);
    return NextResponse.json(
      { error: 'Failed to extract prices from calls' },
      { status: 500 }
    );
  }
}
