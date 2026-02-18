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
      isSubstitute: z.boolean().optional().default(false),
      originalPartNumber: z.string().nullable().optional(),
    })
  ).default([]),
  notes: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  shippingMethod: z.string().nullable().optional(),
  shippingCost: z.number().nullable().optional(),
});

type ExtractedQuoteData = z.infer<typeof ExtractedQuoteSchema>;

// Normalize a part number for comparison (strip whitespace, dashes, case)
function normalizePart(partNumber: string): string {
  return partNumber.replace(/[\s-]/g, '').toUpperCase();
}

// Find a matching QuoteRequestItem by part number (exact, case-insensitive, or normalized)
async function findMatchingItem(
  partNumber: string,
  allItems: Array<{ id: string; partNumber: string }>
) {
  const normalized = normalizePart(partNumber);
  return allItems.find((qri) => {
    const normalizedDb = normalizePart(qri.partNumber);
    return (
      normalizedDb === normalized ||
      qri.partNumber === partNumber ||
      qri.partNumber.toLowerCase() === partNumber.toLowerCase()
    );
  }) || null;
}

// Parse availability string to enum value
function parseAvailability(
  availability: string | null | undefined,
  leadTimeDays: number | null
): 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN' {
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
  const value = availability?.toUpperCase() || '';
  let result = availabilityMap[value] || 'UNKNOWN';

  // Override: if marked IN_STOCK but has a lead time, it's actually backordered
  if (result === 'IN_STOCK' && leadTimeDays && leadTimeDays > 0) {
    result = 'BACKORDERED';
  }

  return result;
}

// Parse lead time string to days
function parseLeadTimeDays(leadTime: string | null | undefined): number | null {
  if (!leadTime) return null;
  const match = leadTime.match(/(\d+)/);
  if (!match) return null;
  let days = parseInt(match[1]);
  if (leadTime.toLowerCase().includes('week')) {
    days *= 7;
  }
  return days;
}

// Try to use pre-extracted quotes from the VoIP call state (saved by the webhook)
function extractFromCallState(
  extractedQuotes: any[]
): ExtractedQuoteData['items'] {
  if (!Array.isArray(extractedQuotes) || extractedQuotes.length === 0) {
    return [];
  }

  return extractedQuotes
    .filter((q: any) => q.price != null)
    .map((q: any) => ({
      partNumber: q.partNumber || '',
      description: q.notes || '',
      quantity: 1,
      unitPrice: typeof q.price === 'number' ? q.price : parseFloat(q.price) || 0,
      totalPrice: typeof q.price === 'number' ? q.price : parseFloat(q.price) || 0,
      leadTime: q.leadTime || null,
      availability: q.availability === 'in_stock' ? 'IN_STOCK'
        : q.availability === 'backorder' ? 'BACKORDERED'
        : q.availability === 'unavailable' ? 'OUT_OF_STOCK'
        : null,
      availabilityNote: q.notes || null,
      isSubstitute: q.isSubstitute || false,
      originalPartNumber: q.originalPartNumber || null,
    }));
}

// POST /api/quote-requests/[id]/extract-call-prices
export async function POST(
  _req: NextRequest,
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

    // Pre-fetch all quote request items once (avoid N+1 queries)
    const allQuoteRequestItems = quoteRequest.items.map((item) => ({
      id: item.id,
      partNumber: item.partNumber,
    }));

    console.log('[Extract Call Prices] Quote request:', id);
    console.log('[Extract Call Prices] Requested part numbers:', requestedPartNumbers);

    // Get ALL calls for this quote request that have conversation data
    // Include COMPLETED, FAILED, and HUMAN_ESCALATED — any might have pricing info
    const allCalls = await prisma.supplierCall.findMany({
      where: {
        quoteRequestId: id,
        status: { in: ['COMPLETED', 'FAILED', 'HUMAN_ESCALATED'] },
        conversationLog: { not: null as any },
      },
      include: {
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (allCalls.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        totalItemsExtracted: 0,
        message: 'No calls with conversation data found for this quote request.',
      });
    }

    // For multiple calls to the same supplier (retries), prefer COMPLETED over FAILED.
    // If multiple COMPLETED calls exist, use the most recent one.
    const callsBySupplier = new Map<string, typeof allCalls[0]>();
    for (const call of allCalls) {
      if (!call.supplier) continue;
      const existing = callsBySupplier.get(call.supplierId);
      if (!existing) {
        callsBySupplier.set(call.supplierId, call);
      } else {
        // Prefer COMPLETED over other statuses
        const statusPriority = (s: string) => s === 'COMPLETED' ? 0 : s === 'HUMAN_ESCALATED' ? 1 : 2;
        if (statusPriority(call.status) < statusPriority(existing.status)) {
          callsBySupplier.set(call.supplierId, call);
        }
        // Same status priority → already have the most recent (orderBy: desc)
      }
    }
    const calls = Array.from(callsBySupplier.values());
    console.log(`[Extract Call Prices] ${allCalls.length} total calls, ${calls.length} unique suppliers`);

    // Only initialize LLM client if we actually need it (lazy)
    let llmClient: OpenRouterClient | null = null;

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
        let items: ExtractedQuoteData['items'] = [];
        let currency = 'USD';
        let validUntil: string | null = null;

        // Strategy 1: Use pre-extracted quotes from VoIP call state
        const preExtracted = extractFromCallState(
          call.extractedQuotes as any[] || []
        );

        if (preExtracted.length > 0) {
          console.log(`[Extract Call Prices] Using ${preExtracted.length} pre-extracted quotes from call state for ${supplier.name}`);
          items = preExtracted;
        } else {
          // Strategy 2: Also check conversationLog.quotes (saved since fix)
          const logQuotes = conversationLog.quotes;
          if (Array.isArray(logQuotes) && logQuotes.length > 0) {
            const fromLog = extractFromCallState(logQuotes);
            if (fromLog.length > 0) {
              console.log(`[Extract Call Prices] Using ${fromLog.length} quotes from conversationLog for ${supplier.name}`);
              items = fromLog;
            }
          }
        }

        // Strategy 3: Fall back to LLM re-extraction from transcript
        if (items.length === 0) {
          console.log(`[Extract Call Prices] No pre-extracted quotes, falling back to LLM extraction for ${supplier.name}`);

          // Lazy-init LLM client
          if (!llmClient) {
            try {
              llmClient = await OpenRouterClient.fromOrganization(organizationId);
            } catch (error: any) {
              console.warn('[Extract Call Prices] Failed to initialize LLM client:', error.message);
              results.push({
                supplierId: supplier.id,
                supplierName: supplier.name,
                itemsExtracted: 0,
                success: false,
                error: 'LLM client not configured. Please set up OpenRouter in integrations.',
              });
              continue;
            }
          }

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
6. NATO phonetic alphabet decoding: Alpha=A, Bravo=B, Charlie=C, Delta=D, Echo=E, Foxtrot=F, Golf=G, Hotel=H, India=I, Juliet=J, Kilo=K, Lima=L, Mike=M, November=N, Oscar=O, Papa=P, Quebec=Q, Romeo=R, Sierra=S, Tango=T, Uniform=U, Victor=V, Whiskey=W, X-ray=X, Yankee=Y, Zulu=Z
7. AVAILABILITY RULES:
   - Use "IN_STOCK" for: explicitly says "in stock", "on hand", "ships today", "we have it", "have them", "have a couple"
   - Use "BACKORDERED" for: backordered, out of stock, any wait time
   - Use "SPECIAL_ORDER" for: special order, custom order
   - Use null if unclear
8. availabilityNote: Include any relevant supplier comments about the item
9. SUBSTITUTE/SUPERSEDED PARTS: If the supplier says a part has been superseded, replaced, or offers a substitute:
   - Use the SUBSTITUTE part number as "partNumber"
   - Set "isSubstitute" to true
   - Set "originalPartNumber" to the originally requested part number

Respond with a JSON object in this EXACT format:
{
  "quoteNumber": null,
  "totalAmount": total amount as number or null,
  "currency": "USD",
  "validUntil": null,
  "items": [
    {
      "partNumber": "exact part number (use substitute if applicable)",
      "description": "part description",
      "quantity": quantity as number,
      "unitPrice": unit price as number,
      "totalPrice": total price as number,
      "leadTime": "lead time info or null",
      "availability": "IN_STOCK, BACKORDERED, SPECIAL_ORDER, or null",
      "availabilityNote": "supplier comments about availability, or null",
      "isSubstitute": false,
      "originalPartNumber": null
    }
  ],
  "notes": "any special notes or conditions mentioned",
  "paymentTerms": "payment terms if mentioned (e.g. cash account)",
  "shippingMethod": null,
  "shippingCost": null
}

IMPORTANT: Numbers should be numbers, not strings.`;

          try {
            const extractedData = await llmClient.generateStructuredOutput<ExtractedQuoteData>(
              extractionPrompt,
              ExtractedQuoteSchema
            );
            items = extractedData.items;
            currency = extractedData.currency || 'USD';
            validUntil = extractedData.validUntil || null;
            console.log(`[Extract Call Prices] LLM extracted ${items.length} items from ${supplier.name}`);
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
        }

        // Save extracted data to SupplierQuoteItem records
        let itemsCreated = 0;
        for (const item of items) {
          // Skip if no pricing
          if (item.unitPrice == null && item.totalPrice == null) {
            console.log(`[Extract Call Prices] Skipping ${item.partNumber} - no pricing`);
            continue;
          }

          // Try to match the extracted part number to a quote request item
          let existingItem = await findMatchingItem(item.partNumber, allQuoteRequestItems);

          // If no match and this is a substitute, try matching on the original part number
          if (!existingItem && item.isSubstitute && item.originalPartNumber) {
            console.log(`[Extract Call Prices] Substitute ${item.partNumber} — trying original part number ${item.originalPartNumber}`);
            existingItem = await findMatchingItem(item.originalPartNumber, allQuoteRequestItems);
          }

          if (!existingItem) {
            console.log(`[Extract Call Prices] No matching item for part number: ${item.partNumber}${item.isSubstitute ? ` (substitute for ${item.originalPartNumber})` : ''}`);
            continue;
          }

          const leadTimeDays = parseLeadTimeDays(item.leadTime);
          const availability = parseAvailability(item.availability, leadTimeDays);

          // Build notes with substitute info
          let noteText = item.availabilityNote || item.leadTime || item.availability || '';
          if (item.isSubstitute) {
            noteText = `Substitute part: ${item.partNumber} (replaces ${item.originalPartNumber || existingItem.partNumber}). ${noteText}`.trim();
          }

          // Set supplierPartNumber for substitutes
          const supplierPartNumber = item.isSubstitute ? item.partNumber : null;

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
              currency: currency,
              availability,
              leadTimeDays,
              supplierPartNumber,
              notes: noteText ? `${noteText} (extracted from phone call)` : 'Extracted from phone call',
              validUntil: validUntil ? new Date(validUntil) : null,
            },
            create: {
              quoteRequestItemId: existingItem.id,
              supplierId: supplier.id,
              unitPrice: item.unitPrice || 0,
              totalPrice: item.totalPrice || 0,
              currency: currency,
              availability,
              leadTimeDays,
              supplierPartNumber,
              notes: noteText ? `${noteText} (extracted from phone call)` : 'Extracted from phone call',
              validUntil: validUntil ? new Date(validUntil) : null,
            },
          });

          itemsCreated++;
          console.log(`[Extract Call Prices] Saved ${item.isSubstitute ? 'substitute ' : ''}${item.partNumber} → ${existingItem.partNumber} ($${item.unitPrice})`);
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
