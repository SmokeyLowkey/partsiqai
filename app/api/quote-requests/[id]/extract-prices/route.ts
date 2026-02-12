import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { parsePdfFromS3, extractPdfText, isValidPdf, extractBasicQuoteInfo } from '@/lib/services/document/pdf-parser';
import { downloadFromS3 } from '@/lib/services/storage/s3-client';
import { z } from 'zod';

// Schema for extracted quote data
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

// POST /api/quote-requests/[id]/extract-prices - Manually extract prices from emails
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

    // Get quote request with email threads and items
    const whereClause: any = {
      id,
      organizationId,
    };

    // Technicians can only extract prices from their own quotes
    if (session.user.role === 'TECHNICIAN') {
      whereClause.createdById = session.user.id;
    }

    const quoteRequest = await prisma.quoteRequest.findFirst({
      where: whereClause,
      include: {
        items: true,
        emailThreads: {
          include: {
            supplier: true,
            emailThread: {
              include: {
                messages: {
                  where: {
                    direction: 'INBOUND',
                  },
                  orderBy: {
                    createdAt: 'desc',
                  },
                  include: {
                    attachments: true,
                  },
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

    // Get requested part numbers for context
    const requestedPartNumbers = quoteRequest.items
      .map((item) => item.partNumber)
      .filter(Boolean);

    console.log('Manual extraction for quote request:', id);
    console.log('Requested part numbers:', requestedPartNumbers);

    // Try to get LLM client
    let llmClient: OpenRouterClient | null = null;
    try {
      llmClient = await OpenRouterClient.fromOrganization(organizationId);
      console.log('LLM client initialized');
    } catch (error: any) {
      console.warn('Failed to initialize LLM client:', error.message);
    }

    // Try to get email client for downloading attachments using current user's credentials
    let emailClient: any = null;
    try {
      emailClient = await getEmailClientForUser(session.user.id);
    } catch (error: any) {
      console.warn('Failed to initialize email client:', error.message);
    }

    const results: Array<{
      supplierId: string;
      supplierName: string;
      itemsExtracted: number;
      success: boolean;
      error?: string;
    }> = [];

    // Process each email thread
    for (const emailThread of quoteRequest.emailThreads) {
      const supplier = emailThread.supplier;
      const thread = emailThread.emailThread;

      if (!supplier || !thread) {
        continue;
      }

      console.log(`Processing emails from ${supplier.name}...`);

      try {
        // Focus on the most recent INBOUND message with attachments or quote content
        // Sort messages by received date (most recent first)
        const sortedMessages = [...thread.messages].sort((a, b) => {
          const dateA = new Date(a.receivedAt || a.sentAt || 0).getTime();
          const dateB = new Date(b.receivedAt || b.sentAt || 0).getTime();
          return dateB - dateA; // Most recent first
        });

        // Find the most recent inbound message with attachments or quote-related content
        const mostRecentQuoteMessage = sortedMessages.find(msg => 
          msg.direction === 'INBOUND' && (
            msg.attachments.length > 0 || 
            msg.body.toLowerCase().includes('quote') ||
            msg.body.toLowerCase().includes('price')
          )
        );

        if (!mostRecentQuoteMessage) {
          console.log(`No recent quote message found for ${supplier.name}`);
          continue;
        }

        console.log(`Using most recent quote message from ${new Date(mostRecentQuoteMessage.receivedAt || mostRecentQuoteMessage.sentAt || 0).toISOString()}`);

        // Collect content from the most recent message only
        let emailContent = `--- Email: ${mostRecentQuoteMessage.subject} ---\n${mostRecentQuoteMessage.body}`;
        let attachmentText = '';

        // Process attachments from the most recent message
        for (const attachment of mostRecentQuoteMessage.attachments) {
          if (attachment.contentType === 'application/pdf') {
            try {
              // Check if we already have extracted text in database
              if (attachment.extractedText) {
                console.log(`Using cached text for ${attachment.filename}`);
                attachmentText += `\n\n--- PDF: ${attachment.filename} ---\n${attachment.extractedText}`;
              } else if (attachment.path) {
                // Use Mistral OCR directly with S3 presigned URL
                console.log(`Processing PDF from S3 with Mistral OCR: ${attachment.filename}`);
                try {
                  const result = await parsePdfFromS3(organizationId, attachment.path);
                  const pdfText = result.text;
                  
                  attachmentText += `\n\n--- PDF: ${attachment.filename} ---\n${pdfText}`;
                  console.log(`Extracted ${pdfText.length} characters from ${attachment.filename}`);

                  // Save extracted text to database for future use
                  await prisma.emailAttachment.update({
                    where: { id: attachment.id },
                    data: { extractedText: pdfText },
                  });
                } catch (s3Error: any) {
                  console.warn(`Failed to process PDF from S3: ${s3Error.message}`);
                }
              } else {
                console.log(`No S3 path for attachment: ${attachment.filename}`);
              }
            } catch (pdfError: any) {
              console.warn(`Failed to process PDF ${attachment.filename}:`, pdfError.message);
            }
          }
        }

        const fullContent = emailContent + attachmentText;
        console.log(`Full content length: ${fullContent.length} chars (email: ${emailContent.length}, attachments: ${attachmentText.length})`);
        let extractedData: ExtractedQuoteData = { items: [], currency: 'USD' };

        if (llmClient && fullContent.trim().length > 0) {
          // Use LLM for extraction
          const extractionPrompt = `You are a specialized assistant that extracts structured quote/pricing information from supplier emails and attached documents.

CONTEXT: We sent a quote request to a supplier (${supplier.name}) asking for prices on these parts: ${requestedPartNumbers.length > 0 ? requestedPartNumbers.join(', ') : '(extract all pricing info)'}
The supplier has responded. Extract ALL pricing information you can find.

CONTENT:
${fullContent}

INSTRUCTIONS:
1. Extract ALL items with pricing that you find - match them to the requested part numbers if possible
2. For each item found, extract: part number, description, quantity, unit price, total price, lead time, availability
3. If the email just has a total price without item breakdown, still include what you can find
4. Part numbers may have slight variations (spaces, dashes) - match them intelligently
5. AVAILABILITY RULES:
   - Use "IN_STOCK" ONLY for: explicitly says "in stock", "on hand", "ships today", "immediate availability"
   - Use "BACKORDERED" for: backordered, out of stock, any wait time (e.g., "available in 2 days", "1-2 days away")
   - Use "SPECIAL_ORDER" for: special order, custom order, made to order
   - Use null if unclear
   - IMPORTANT: "available for pick up in X days" or "X days away" is NOT in stock — use BACKORDERED
6. availabilityNote: Always include the EXACT supplier text about availability/lead time

Respond with a JSON object in this EXACT format:
{
  "quoteNumber": "quote/invoice number if found, or null",
  "totalAmount": total amount as number or null,
  "currency": "USD or other currency code",
  "validUntil": "ISO date string if quote has expiry, or null",
  "items": [
    {
      "partNumber": "exact part number from document",
      "description": "part description",
      "quantity": quantity as number,
      "unitPrice": unit price as number,
      "totalPrice": total price as number (unitPrice * quantity),
      "leadTime": "lead time info or null",
      "availability": "IN_STOCK, BACKORDERED, SPECIAL_ORDER, or null",
      "availabilityNote": "exact supplier text about availability/lead time, or null"
    }
  ],
  "notes": "any special notes or conditions",
  "paymentTerms": "payment terms if mentioned",
  "shippingMethod": "shipping method if mentioned",
  "shippingCost": shipping cost as number or null
}

IMPORTANT: Numbers should be numbers, not strings.`;

          try {
            extractedData = await llmClient.generateStructuredOutput<ExtractedQuoteData>(
              extractionPrompt,
              ExtractedQuoteSchema
            );
            console.log(`LLM extracted ${extractedData.items.length} items from ${supplier.name}`);
          } catch (llmError: any) {
            console.error('LLM extraction failed:', llmError.message);
            // Fall back to basic extraction
            const basicInfo = extractBasicQuoteInfo(fullContent);
            extractedData = {
              quoteNumber: basicInfo.possibleQuoteNumber,
              totalAmount: basicInfo.possibleTotal,
              currency: 'USD',
              items: basicInfo.possibleItems.map((item) => ({
                partNumber: item.partNumber || '',
                description: item.description || '',
                quantity: item.quantity || 1,
                unitPrice: item.price || 0,
                totalPrice: (item.price || 0) * (item.quantity || 1),
              })),
            };
          }
        } else if (fullContent.trim().length > 0) {
          // Use basic extraction
          const basicInfo = extractBasicQuoteInfo(fullContent);
          extractedData = {
            quoteNumber: basicInfo.possibleQuoteNumber,
            totalAmount: basicInfo.possibleTotal,
            currency: 'USD',
            items: basicInfo.possibleItems.map((item) => ({
              partNumber: item.partNumber || '',
              description: item.description || '',
              quantity: item.quantity || 1,
              unitPrice: item.price || 0,
              totalPrice: (item.price || 0) * (item.quantity || 1),
            })),
          };
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

            // Use raw supplier text for notes, fall back to lead time or enum
            const noteText = item.availabilityNote || item.leadTime || item.availability;

            // Skip creating SupplierQuoteItem if both unitPrice and totalPrice are null
            // This means the supplier didn't provide pricing for this item
            if (item.unitPrice === null && item.totalPrice === null) {
              console.log(`Skipping item ${item.partNumber} - no pricing information provided`);
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
                notes: noteText,
                validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : null,
              },
              create: {
                quoteRequestItemId: existingItem.id,
                supplierId: supplier.id,
                unitPrice: item.unitPrice || 0, // Default to 0 if null (shouldn't happen due to check above)
                totalPrice: item.totalPrice || 0,
                currency: extractedData.currency || 'USD',
                availability,
                leadTimeDays,
                notes: noteText,
                validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : null,
              },
            });

            itemsCreated++;
          }
        }

        // Update quote request email thread status
        if (extractedData.items.length > 0) {
          await prisma.quoteRequestEmailThread.update({
            where: { id: emailThread.id },
            data: {
              status: 'RESPONDED',
              responseDate: new Date(),
              quotedAmount: extractedData.totalAmount,
            },
          });
        }

        results.push({
          supplierId: supplier.id,
          supplierName: supplier.name,
          itemsExtracted: itemsCreated,
          success: true,
        });
      } catch (error: any) {
        console.error(`Error processing ${supplier.name}:`, error);
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
        ? `Extracted ${totalItemsExtracted} item prices from ${results.filter((r) => r.success).length} suppliers`
        : 'No pricing data found in emails. Make sure suppliers have responded with quotes.',
    });
  } catch (error: any) {
    console.error('Extract prices API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to extract prices',
      },
      { status: 500 }
    );
  }
}
