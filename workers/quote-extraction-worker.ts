// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { QuoteExtractionJobData } from '@/lib/queue/types';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { getEmailClientForUser } from '@/lib/services/email/email-client-factory';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { extractPdfTextFromS3, isValidPdf, extractBasicQuoteInfo } from '@/lib/services/document/pdf-parser';
import { uploadEmailAttachment } from '@/lib/services/storage/s3-client';
import { workerLogger } from '@/lib/logger';

const QUEUE_NAME = 'quote-extraction';

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
      availability: z.enum(['IN_STOCK', 'BACKORDERED', 'SPECIAL_ORDER', 'UNKNOWN']).nullable().optional(),
      availabilityNote: z.string().nullable().optional(),
      source: z.enum(['PDF_ATTACHMENT', 'EMAIL_BODY']).optional().default('PDF_ATTACHMENT'),
      isAlternative: z.boolean().optional().default(false),
      alternativeReason: z.string().nullable().optional(),
      originalPartNumber: z.string().nullable().optional(),
      isSuperseded: z.boolean().optional().default(false),
      supersessionNotes: z.string().nullable().optional(),
    })
  ).default([]),
  miscellaneousCosts: z.object({
    description: z.string().optional().default('Additional costs and fees'),
    amount: z.number().optional().default(0),
    details: z.string().nullable().optional(),
  }).optional(),
  notes: z.string().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  shippingMethod: z.string().nullable().optional(),
  shippingCost: z.number().nullable().optional(),
});

type ExtractedQuoteData = z.infer<typeof ExtractedQuoteSchema>;

// Schema for extracted tracking data
const ExtractedTrackingSchema = z.object({
  trackingNumber: z.string().nullable().optional(),
  carrier: z.string().nullable().optional(),
  shippingMethod: z.string().nullable().optional(),
  shippedDate: z.string().nullable().optional(),
  estimatedDeliveryDate: z.string().nullable().optional(),
  actualDeliveryDate: z.string().nullable().optional(),
  orderStatus: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'ON_HOLD']).nullable().optional(),
  notes: z.string().nullable().optional(),
});

type ExtractedTrackingData = z.infer<typeof ExtractedTrackingSchema>;

// Extract tracking data using OpenRouterClient
async function extractTrackingWithLLM(
  llmClient: OpenRouterClient,
  emailData: { subject: string; from: string; body: string },
  attachmentText: string,
  orderNumber: string
): Promise<ExtractedTrackingData> {
  const extractionPrompt = `You are a specialized assistant that extracts shipping and tracking information from supplier emails.

CONTEXT: We have an order (${orderNumber}) with a supplier. The supplier has sent an email that may contain tracking information, shipment updates, or delivery status.

EMAIL DETAILS:
Subject: ${emailData.subject}
From: ${emailData.from}

EMAIL BODY:
${emailData.body}

${attachmentText ? `ATTACHMENT CONTENT:\n${attachmentText}` : ''}

INSTRUCTIONS:
Extract any shipping, tracking, or delivery information from this email. Look for:
1. Tracking numbers (UPS, FedEx, USPS, DHL, etc.)
2. Carrier/shipping company names
3. Shipping method (Ground, Express, Priority, etc.)
4. Shipment dates (when items were shipped)
5. Estimated delivery dates
6. Actual delivery dates (if delivered)
7. Order status updates (shipped, in transit, delivered, etc.)
8. Any relevant notes about the shipment

ORDER STATUS must be one of these EXACT values:
- "PENDING" - Order received but not yet processed
- "PROCESSING" - Order confirmed/being processed/packed
- "IN_TRANSIT" - Items have been shipped and in transit
- "DELIVERED" - Items delivered to destination
- "CANCELLED" - Order cancelled

Respond with a JSON object in this EXACT format:
{
  "trackingNumber": "tracking number if found, or null",
  "carrier": "carrier name (UPS, FedEx, USPS, DHL, etc.) or null",
  "shippingMethod": "shipping method description or null",
  "shippedDate": "ISO date string when shipped, or null",
  "estimatedDeliveryDate": "ISO date string for estimated delivery, or null",
  "actualDeliveryDate": "ISO date string when delivered, or null",
  "orderStatus": "one of: PENDING, PROCESSING, IN_TRANSIT, DELIVERED, CANCELLED (or null if unclear)",
  "notes": "any relevant notes about shipping/delivery or null"
}

If no tracking information is found, return all fields as null.`;

  workerLogger.info('Extracting tracking information from email');

  try {
    const result = await llmClient.generateStructuredOutput<ExtractedTrackingData>(
      extractionPrompt,
      ExtractedTrackingSchema
    );

    workerLogger.debug({ result }, 'Tracking extraction result');
    return result;
  } catch (error: any) {
    workerLogger.error({ err: error }, 'LLM tracking extraction error');
    // Return empty tracking data on error
    return {
      trackingNumber: null,
      carrier: null,
      shippingMethod: null,
      shippedDate: null,
      estimatedDeliveryDate: null,
      actualDeliveryDate: null,
      orderStatus: null,
      notes: null,
    };
  }
}

// Extract quote data using OpenRouterClient
async function extractQuoteWithLLM(
  llmClient: OpenRouterClient,
  emailData: { subject: string; from: string; body: string },
  attachmentText: string,
  requestedPartNumbers: string[]
): Promise<ExtractedQuoteData> {
  const extractionPrompt = `You are a specialized assistant that extracts structured quote/pricing information from supplier emails and attached documents.

CONTEXT: We sent a quote request to a supplier asking for prices on these parts: ${requestedPartNumbers.length > 0 ? requestedPartNumbers.join(', ') : '(unknown - extract all pricing info)'}
The supplier has responded with this email/document. Extract ALL pricing information you can find.

EMAIL DETAILS:
Subject: ${emailData.subject}
From: ${emailData.from}

EMAIL BODY:
${emailData.body}

PDF ATTACHMENT CONTENT:
${attachmentText || '(no PDF attachments)'}

CRITICAL INSTRUCTIONS:
1. **For items found in PDF attachments with clear part numbers**: Add them to the "items" array with source: "PDF_ATTACHMENT"
2. **For items found ONLY in email body with clear part numbers**: Add them to the "items" array with source: "EMAIL_BODY"
3. **For informal pricing (shipping, freight, fees, ambiguous costs, lead time info without prices)**: Put in "miscellaneousCosts"
4. Part numbers may have variations (spaces, dashes) - match them intelligently to requested parts
5. If an email says "both items are 1-2 days away" without specific prices, put this info in miscellaneousCosts.details
6. **AVAILABILITY MUST BE ONE OF**: "IN_STOCK", "BACKORDERED", "SPECIAL_ORDER", or "UNKNOWN" (use EXACT values)
   - Use "IN_STOCK" ONLY for: explicitly says "in stock", "on hand", "ships today", "immediate availability", "ready to ship"
   - Use "BACKORDERED" for: backordered, out of stock, not available, temporarily unavailable, any lead time/wait (e.g., "available in 2 days", "1-2 days away", "ships in 3 days")
   - Use "SPECIAL_ORDER" for: special order, custom order, made to order, non-stock item, requires authorization
   - Use "UNKNOWN" for: unclear, not specified, pending confirmation, or any ambiguous status
   - IMPORTANT: "available for pick up in X days" or "X days away" is NOT in stock — use BACKORDERED with the lead time
7. **availabilityNote**: Always include the EXACT supplier text about availability/lead time (e.g., "Parts available for pick up in 2 days", "In stock, ships today"). This preserves the supplier's original wording.
7. **ALTERNATIVE/AFTERMARKET PARTS**: If supplier offers different part numbers than requested:
   - Set isAlternative: true if it's an aftermarket or substitute part
   - Set alternativeReason: explain why (e.g., "OEM discontinued", "Aftermarket equivalent", "Better availability")
   - Set originalPartNumber: the part number originally requested
   - Set isSuperseded: true if the part has been superseded/replaced
   - Set supersessionNotes: supersession details if mentioned

EXAMPLES:
- "Part ABC123 is $50" in PDF → items array with source: "PDF_ATTACHMENT"
- "Part ABC123 is $50" only in email → items array with source: "EMAIL_BODY"  
- "$200 for freight" → miscellaneousCosts.amount = 200, details = "Freight cost"
- "1-2 days away" without prices → miscellaneousCosts.details = "Lead time: 1-2 days"
- "Additional $50 handling fee" → miscellaneousCosts.amount += 50, details includes "handling fee"
- "both items are 1-2 days away" → availability: "BACKORDERED", leadTime: "1-2 days", availabilityNote: "both items are 1-2 days away"

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
      "availability": "MUST BE EXACTLY: IN_STOCK, BACKORDERED, SPECIAL_ORDER, or UNKNOWN",
      "availabilityNote": "exact supplier text about availability/lead time, or null",
      "source": "PDF_ATTACHMENT or EMAIL_BODY",
      "isAlternative": false or true if this is an aftermarket/substitute part,
      "alternativeReason": "reason if alternative (e.g., 'OEM discontinued', 'Aftermarket equivalent') or null",
      "originalPartNumber": "originally requested part number if this is alternative, or null",
      "isSuperseded": false or true if part has been superseded,
      "supersessionNotes": "supersession details if mentioned, or null"
    }
  ],
  "miscellaneousCosts": {
    "description": "Brief summary of misc costs",
    "amount": total miscellaneous amount as number (sum of all fees, shipping, etc.),
    "details": "Detailed breakdown: freight $200, handling $50, etc. Include lead times and informal notes here."
  },
  "notes": "any special notes or conditions",
  "paymentTerms": "payment terms if mentioned",
  "shippingMethod": "shipping method if mentioned",
  "shippingCost": shipping cost as number or null
}

IMPORTANT: Always include miscellaneousCosts object even if amount is 0. Numbers should be numbers, not strings.`;

  workerLogger.info({ emailBodyLength: emailData.body.length, attachmentTextLength: attachmentText.length, requestedPartNumbers }, 'Sending extraction request to LLM');

  try {
    const result = await llmClient.generateStructuredOutput<ExtractedQuoteData>(
      extractionPrompt,
      ExtractedQuoteSchema
    );

    workerLogger.debug({ resultPreview: JSON.stringify(result).substring(0, 500) }, 'LLM extraction result');
    return result;
  } catch (error: any) {
    workerLogger.error({ err: error }, 'LLM extraction error');
    throw error;
  }
}

// Create worker
export const quoteExtractionWorker = new Worker<QuoteExtractionJobData>(
  QUEUE_NAME,
  async (job: Job<QuoteExtractionJobData>) => {
    workerLogger.info({
      jobId: job.id,
      subject: job.data.emailData.subject,
      from: job.data.emailData.from,
      attachmentCount: job.data.attachments?.length || 0,
    }, 'Processing quote extraction job');

    const { organizationId, emailThreadId, emailMessageId, userId, emailData, attachments } = job.data;

    try {
      await job.updateProgress(10);

      // Try to get LLM client from org credentials
      let llmClient: OpenRouterClient | null = null;
      try {
        llmClient = await OpenRouterClient.fromOrganization(organizationId);
        workerLogger.info('LLM client initialized from org credentials');
      } catch (error: any) {
        workerLogger.warn({ err: error }, 'Failed to initialize LLM client, will save attachments but skip AI extraction');
      }

      // Use the specific user whose inbox the email was found in (passed from email-monitor).
      // Fall back to findFirst for backward compatibility with jobs queued before this change.
      let emailUserId = userId;
      if (!emailUserId) {
        const userWithEmail = await prisma.userEmailIntegration.findFirst({
          where: {
            user: { organizationId },
            providerType: { in: ['GMAIL_OAUTH', 'MICROSOFT_OAUTH'] },
            isActive: true,
          },
          select: { userId: true },
        });
        if (!userWithEmail) {
          throw new Error('No user with email integration found for this organization');
        }
        emailUserId = userWithEmail.userId;
      }

      // Get email client for downloading attachments using that user's credentials (supports Gmail and Microsoft)
      const emailClient = await getEmailClientForUser(emailUserId);

      await job.updateProgress(15);

      // Get email thread with supplier info and linked quote request
      const thread = await prisma.emailThread.findUnique({
        where: { id: emailThreadId },
        include: {
          supplier: true,
          quoteRequestEmailThreads: {
            include: {
              quoteRequest: {
                include: {
                  items: true,
                },
              },
            },
          },
        },
      });

      if (!thread) {
        throw new Error('Email thread not found');
      }

      // Get requested part numbers for context
      const requestedPartNumbers: string[] = [];
      const quoteRequestEmailThread = thread.quoteRequestEmailThreads; // Single relation, not array
      
      if (quoteRequestEmailThread?.quoteRequest?.items) {
        for (const item of quoteRequestEmailThread.quoteRequest.items) {
          if (item.partNumber && !requestedPartNumbers.includes(item.partNumber)) {
            requestedPartNumbers.push(item.partNumber);
          }
        }
      }
      
      workerLogger.debug({ requestedPartNumbers, quoteRequestEmailThreadCount: quoteRequestEmailThread ? 1 : 0 }, 'Quote request context loaded');

      await job.updateProgress(20);

      // Process attachments - download, upload to S3, and extract text from PDFs
      let attachmentText = '';
      const processedAttachments: Array<{
        id: string;
        filename: string;
        s3Key: string;
        extractedText?: string;
      }> = [];

      if (attachments && attachments.length > 0) {
        workerLogger.info({ attachmentCount: attachments.length }, 'Processing attachments');

        for (const attachment of attachments) {
          try {
            // Check if attachment was already processed (uploaded to S3) for this message
            const existingAttachment = await prisma.emailAttachment.findFirst({
              where: {
                messageId: emailMessageId,
                filename: attachment.filename,
              },
            });

            workerLogger.debug({ filename: attachment.filename, exists: !!existingAttachment, path: existingAttachment?.path || 'none' }, 'Checking attachment status');

            // Only skip if attachment exists AND has been uploaded to S3 (path is not empty)
            if (existingAttachment && existingAttachment.path && existingAttachment.path !== '') {
              workerLogger.debug({ filename: attachment.filename, s3Path: existingAttachment.path }, 'Skipping already processed attachment');
              // Use existing extracted text if available
              if (existingAttachment.extractedText) {
                attachmentText += `\n\n--- Content from PDF: ${attachment.filename} ---\n${existingAttachment.extractedText}`;
              }
              processedAttachments.push({
                id: attachment.id,
                filename: attachment.filename,
                s3Key: existingAttachment.path,
                extractedText: existingAttachment.extractedText || undefined,
              });
              continue;
            }

            // Download attachment from Gmail
            workerLogger.info({ filename: attachment.filename, gmailAttachmentId: attachment.gmailAttachmentId }, 'Downloading attachment from Gmail');
            const attachmentBuffer = await emailClient.downloadAttachment(
              emailData.id,
              attachment.gmailAttachmentId
            );

            await job.updateProgress(30);

            // Upload to S3
            const { key: s3Key } = await uploadEmailAttachment(
              attachmentBuffer,
              attachment.filename,
              attachment.contentType,
              organizationId,
              emailMessageId
            );

            workerLogger.info({ s3Key }, 'Uploaded attachment to S3');

            let extractedText: string | undefined;

            // Extract text from PDF attachments using Mistral OCR
            if (attachment.contentType === 'application/pdf') {
              try {
                // Use Mistral OCR directly with the S3 key
                extractedText = await extractPdfTextFromS3(s3Key);
                attachmentText += `\n\n--- Content from PDF: ${attachment.filename} ---\n${extractedText}`;
                workerLogger.info({ charCount: extractedText.length }, 'Extracted text from PDF via Mistral OCR');
              } catch (pdfError: any) {
                workerLogger.error({ err: pdfError, filename: attachment.filename }, 'Failed to extract text from PDF');
              }
            }

            // Find and update the existing attachment record (created by email-monitor-worker)
            // or create a new one if it doesn't exist
            const existingAttachmentRecord = await prisma.emailAttachment.findFirst({
              where: {
                messageId: emailMessageId,
                filename: attachment.filename,
              },
            });

            if (existingAttachmentRecord) {
              // Update existing attachment with S3 path and extracted text
              await prisma.emailAttachment.update({
                where: { id: existingAttachmentRecord.id },
                data: {
                  path: s3Key,
                  extractedText,
                },
              });
              workerLogger.info({ filename: attachment.filename }, 'Updated attachment record with S3 path');
            } else {
              // Create new attachment if it doesn't exist (shouldn't happen normally)
              await prisma.emailAttachment.create({
                data: {
                  messageId: emailMessageId,
                  filename: attachment.filename,
                  contentType: attachment.contentType,
                  size: attachment.size,
                  path: s3Key,
                  extractedText,
                },
              });
              workerLogger.info({ filename: attachment.filename }, 'Created new attachment record');
            }

            processedAttachments.push({
              id: attachment.id,
              filename: attachment.filename,
              s3Key,
              extractedText,
            });
          } catch (attachmentError: any) {
            workerLogger.error({ err: attachmentError, filename: attachment.filename }, 'Failed to process attachment');
            // Continue processing other attachments
          }
        }
      }

      await job.updateProgress(50);

      // Extract quote data using LLM (if available)
      let extractedData: ExtractedQuoteData = {
        items: [],
        currency: 'USD',
      };

      if (llmClient) {
        try {
          workerLogger.info('Extracting quote data with LLM');
          extractedData = await extractQuoteWithLLM(
            llmClient,
            emailData,
            attachmentText,
            requestedPartNumbers
          );
          workerLogger.info({ itemCount: extractedData.items.length, totalAmount: extractedData.totalAmount }, 'LLM extraction complete');
        } catch (llmError: any) {
          workerLogger.error({ err: llmError }, 'LLM extraction failed');
          // Try basic extraction as fallback
          if (attachmentText) {
            const basicInfo = extractBasicQuoteInfo(attachmentText);
            workerLogger.info({ basicInfo }, 'Using basic extraction fallback');
            extractedData = {
              quoteNumber: basicInfo.possibleQuoteNumber,
              totalAmount: basicInfo.possibleTotal,
              currency: 'USD',
              items: basicInfo.possibleItems.map(item => ({
                partNumber: item.partNumber || '',
                description: item.description || '',
                quantity: item.quantity || 1,
                unitPrice: item.price || 0,
                totalPrice: (item.price || 0) * (item.quantity || 1),
                source: 'EMAIL_BODY' as const,
                isAlternative: false,
                alternativeReason: null,
                originalPartNumber: null,
                isSuperseded: false,
                supersessionNotes: null,
              })),
            };
          }
        }
      } else {
        // No LLM - try basic extraction
        workerLogger.info('No LLM available, using basic pattern extraction');
        const fullContent = `${emailData.body}${attachmentText}`;
        const basicInfo = extractBasicQuoteInfo(fullContent);
        extractedData = {
          quoteNumber: basicInfo.possibleQuoteNumber,
          totalAmount: basicInfo.possibleTotal,
          currency: 'USD',
          items: basicInfo.possibleItems.map(item => ({
            partNumber: item.partNumber || '',
            description: item.description || '',
            quantity: item.quantity || 1,
            unitPrice: item.price || 0,
            totalPrice: (item.price || 0) * (item.quantity || 1),
            source: 'EMAIL_BODY' as const,
            isAlternative: false,
            alternativeReason: null,
            originalPartNumber: null,
            isSuperseded: false,
            supersessionNotes: null,
          })),
        };
        workerLogger.debug({ extractedData }, 'Basic extraction found');
      }

      await job.updateProgress(70);

      // Find any existing quote request for this thread/supplier to update
      // Only look for existing quote request if we have a supplierId
      let existingQuoteRequestThread = null;
      if (thread.supplierId) {
        existingQuoteRequestThread = await prisma.quoteRequestEmailThread.findFirst({
          where: {
            emailThreadId,
            supplierId: thread.supplierId,
          },
          include: {
            quoteRequest: true,
          },
        });
      }

      if (existingQuoteRequestThread) {
        // Update existing quote request with extracted data
        await prisma.quoteRequest.update({
          where: { id: existingQuoteRequestThread.quoteRequestId },
          data: {
            status: 'RECEIVED',
            responseDate: new Date(),
            totalAmount: extractedData.totalAmount,
            notes: extractedData.notes
              ? `${existingQuoteRequestThread.quoteRequest.notes || ''}\n\nSupplier Response: ${extractedData.notes}`
              : existingQuoteRequestThread.quoteRequest.notes,
          },
        });

        // Update quote request email thread
        await prisma.quoteRequestEmailThread.update({
          where: { id: existingQuoteRequestThread.id },
          data: {
            status: 'RESPONDED',
            responseDate: new Date(),
            quotedAmount: extractedData.totalAmount,
          },
        });

        // Create SupplierQuoteItem records for per-supplier pricing comparison
        let supplierQuoteItemsCreated = 0;
        if (extractedData.items.length > 0 && thread.supplierId) {
          for (const item of extractedData.items) {
            // Try to match with existing quote request item by part number
            // Use case-insensitive matching and try variations (with/without spaces, dashes)
            const normalizedExtractedPart = item.partNumber.replace(/[\s-]/g, '').toUpperCase();

            // First try exact match, then case-insensitive match
            let existingItem = await prisma.quoteRequestItem.findFirst({
              where: {
                quoteRequestId: existingQuoteRequestThread.quoteRequestId,
                OR: [
                  { partNumber: item.partNumber },
                  { partNumber: { equals: item.partNumber, mode: 'insensitive' } },
                ],
              },
            });

            // If no match found, try to find by normalized version (remove spaces/dashes)
            if (!existingItem) {
              const allItems = await prisma.quoteRequestItem.findMany({
                where: { quoteRequestId: existingQuoteRequestThread.quoteRequestId },
              });

              existingItem = allItems.find(qri => {
                const normalizedDbPart = qri.partNumber.replace(/[\s-]/g, '').toUpperCase();
                return normalizedDbPart === normalizedExtractedPart;
              }) || null;
            }

            if (existingItem) {
              // LLM should return exact enum values, but fallback to mapping for safety
              let availability: 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN' = 'UNKNOWN';
              
              if (item.availability) {
                const availValue = item.availability.toUpperCase().trim();
                // Check if it's already a valid enum value
                if (['IN_STOCK', 'BACKORDERED', 'SPECIAL_ORDER', 'UNKNOWN'].includes(availValue as any)) {
                  availability = availValue as 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN';
                } else {
                  // Fallback mapping for non-standard values (shouldn't happen with updated LLM)
                  const availabilityMap: Record<string, 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN'> = {
                    // IN_STOCK variations
                    'IN STOCK': 'IN_STOCK',
                    'INSTOCK': 'IN_STOCK',
                    'AVAILABLE': 'IN_STOCK',
                    'IN-STOCK': 'IN_STOCK',
                    'STOCK': 'IN_STOCK',
                    'YES': 'IN_STOCK',
                    'READY': 'IN_STOCK',
                    'ON HAND': 'IN_STOCK',
                    
                    // BACKORDERED variations
                    'BACK ORDERED': 'BACKORDERED',
                    'BACK-ORDERED': 'BACKORDERED',
                    'BACKORDER': 'BACKORDERED',
                    'OUT_OF_STOCK': 'BACKORDERED',
                    'OUT OF STOCK': 'BACKORDERED',
                    'UNAVAILABLE': 'BACKORDERED',
                    
                    // SPECIAL_ORDER variations
                    'SPECIAL ORDER': 'SPECIAL_ORDER',
                    'SPECIAL-ORDER': 'SPECIAL_ORDER',
                    'CUSTOM ORDER': 'SPECIAL_ORDER',
                    'CUSTOM': 'SPECIAL_ORDER',
                    
                    // UNKNOWN variations
                    'N/A': 'UNKNOWN',
                    'TBD': 'UNKNOWN',
                    'PENDING': 'UNKNOWN',
                  };
                  availability = availabilityMap[availValue] || 'UNKNOWN';
                }
              }

              // Parse lead time to days
              let leadTimeDays: number | null = null;
              if (item.leadTime) {
                const leadTimeMatch = item.leadTime.match(/(\d+)/);
                if (leadTimeMatch) {
                  leadTimeDays = parseInt(leadTimeMatch[1]);
                  // If lead time mentions weeks, convert to days
                  if (item.leadTime.toLowerCase().includes('week')) {
                    leadTimeDays *= 7;
                  }
                }
              }

              // Override: if marked IN_STOCK but has a lead time, it's actually backordered
              if (availability === 'IN_STOCK' && leadTimeDays && leadTimeDays > 0) {
                availability = 'BACKORDERED';
              }

              // Determine if supplier part number differs (normalize for comparison)
              const normalizedExtracted = item.partNumber.replace(/[\s-]/g, '').toUpperCase();
              const normalizedRequested = existingItem.partNumber.replace(/[\s-]/g, '').toUpperCase();
              const isAlternativePart = normalizedExtracted !== normalizedRequested;
              const finalSupplierPartNumber = isAlternativePart ? item.partNumber : null;

              workerLogger.debug({ requestedPart: existingItem.partNumber, extractedPart: item.partNumber, isAlternative: isAlternativePart }, 'Part matching result');

              // Use raw supplier text for notes (availabilityNote), fall back to lead time or enum
              const noteText = item.availabilityNote || item.leadTime || item.availability;

              // Create or update SupplierQuoteItem for this supplier's quote
              await prisma.supplierQuoteItem.upsert({
                where: {
                  quoteRequestItemId_supplierId: {
                    quoteRequestItemId: existingItem.id,
                    supplierId: thread.supplierId,
                  },
                },
                update: {
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
                  currency: extractedData.currency || 'USD',
                  availability,
                  leadTimeDays,
                  supplierPartNumber: finalSupplierPartNumber,
                  notes: noteText,
                  validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : null,
                  extractedFromEmailId: emailMessageId,
                },
                create: {
                  quoteRequestItemId: existingItem.id,
                  supplierId: thread.supplierId,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
                  currency: extractedData.currency || 'USD',
                  availability,
                  leadTimeDays,
                  supplierPartNumber: finalSupplierPartNumber,
                  notes: noteText,
                  validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : null,
                  extractedFromEmailId: emailMessageId,
                },
              });

              // If this is an alternative/aftermarket part, update the QuoteRequestItem
              if (item.isAlternative || item.isSuperseded || item.originalPartNumber) {
                await prisma.quoteRequestItem.update({
                  where: { id: existingItem.id },
                  data: {
                    isAlternative: item.isAlternative || false,
                    alternativeReason: item.alternativeReason,
                    isSuperseded: item.isSuperseded || false,
                    originalPartNumber: item.originalPartNumber,
                    supersessionNotes: item.supersessionNotes,
                  },
                });
                workerLogger.info({ partNumber: item.partNumber }, 'Updated QuoteRequestItem with alternative/supersession info');
              }

              supplierQuoteItemsCreated++;
              workerLogger.info({ partNumber: item.partNumber, supplierId: thread.supplierId }, 'Created/updated SupplierQuoteItem');
            } else {
              // Supplier is suggesting a part that wasn't requested - create it as an alternative/additional option
              workerLogger.info({ partNumber: item.partNumber }, 'Supplier suggested unrequested part, creating as alternative option');
              
              // Create a new QuoteRequestItem for this supplier-suggested part
              const newItem = await prisma.quoteRequestItem.create({
                data: {
                  quoteRequestId: existingQuoteRequestThread.quoteRequestId,
                  partNumber: item.partNumber,
                  description: item.description || 'Supplier suggested alternative',
                  quantity: item.quantity,
                  isAlternative: true,
                  alternativeReason: item.alternativeReason || 'Supplier suggested alternative/additional part',
                  originalPartNumber: item.originalPartNumber, // May be null if not specified
                  isSuperseded: item.isSuperseded || false,
                  supersessionNotes: item.supersessionNotes,
                },
              });
              
              // Create SupplierQuoteItem for this suggested part
              let availability: 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN' = 'UNKNOWN';
              if (item.availability) {
                const availValue = item.availability.toUpperCase().trim();
                if (['IN_STOCK', 'BACKORDERED', 'SPECIAL_ORDER', 'UNKNOWN'].includes(availValue as any)) {
                  availability = availValue as 'IN_STOCK' | 'BACKORDERED' | 'SPECIAL_ORDER' | 'UNKNOWN';
                }
              }
              
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

              await prisma.supplierQuoteItem.create({
                data: {
                  quoteRequestItemId: newItem.id,
                  supplierId: thread.supplierId,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
                  currency: extractedData.currency || 'USD',
                  availability,
                  leadTimeDays,
                  supplierPartNumber: null, // This IS the supplier's part number
                  notes: item.availabilityNote || item.leadTime || item.availability,
                  validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : null,
                  extractedFromEmailId: emailMessageId,
                },
              });
              
              supplierQuoteItemsCreated++;
              workerLogger.info({ partNumber: item.partNumber }, 'Created supplier-suggested alternative');
            }
          }
        }

        // Always create/update a MISC item for miscellaneous costs
        if (thread.supplierId) {
          // Find or ensure MISC item exists
          let miscItem = await prisma.quoteRequestItem.findFirst({
            where: {
              quoteRequestId: existingQuoteRequestThread.quoteRequestId,
              partNumber: 'MISC-COSTS',
            },
          });

          if (!miscItem) {
            // Create MISC item if it doesn't exist
            miscItem = await prisma.quoteRequestItem.create({
              data: {
                quoteRequestId: existingQuoteRequestThread.quoteRequestId,
                partNumber: 'MISC-COSTS',
                description: 'Additional Costs & Fees',
                quantity: 1,
                unitPrice: 0,
                totalPrice: 0,
              },
            });
            workerLogger.info({ quoteRequestId: existingQuoteRequestThread.quoteRequestId }, 'Created MISC item for quote request');
          }

          const miscAmount = extractedData.miscellaneousCosts?.amount || 0;
          const miscDescription = extractedData.miscellaneousCosts?.description || 'Additional costs and fees';
          const miscDetails = extractedData.miscellaneousCosts?.details || '';
          const combinedNotes = miscDetails ? `${miscDescription}\n\n${miscDetails}` : miscDescription;

          // Create/update supplier quote for MISC item
          await prisma.supplierQuoteItem.upsert({
            where: {
              quoteRequestItemId_supplierId: {
                quoteRequestItemId: miscItem.id,
                supplierId: thread.supplierId,
              },
            },
            update: {
              unitPrice: miscAmount,
              totalPrice: miscAmount,
              currency: extractedData.currency || 'USD',
              availability: 'UNKNOWN',
              notes: combinedNotes,
              validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : null,
              extractedFromEmailId: emailMessageId,
            },
            create: {
              quoteRequestItemId: miscItem.id,
              supplierId: thread.supplierId,
              unitPrice: miscAmount,
              totalPrice: miscAmount,
              currency: extractedData.currency || 'USD',
              availability: 'UNKNOWN',
              notes: combinedNotes,
              validUntil: extractedData.validUntil ? new Date(extractedData.validUntil) : null,
              extractedFromEmailId: emailMessageId,
            },
          });

          if (miscAmount > 0 || miscDetails) {
            workerLogger.info({ miscAmount, notes: combinedNotes.substring(0, 100) }, 'Created/updated MISC supplier quote item');
          } else {
            workerLogger.debug('Created/updated MISC supplier quote item with $0 (no misc costs found)');
          }
        }

        await job.updateProgress(90);

        // Update email thread status
        await prisma.emailThread.update({
          where: { id: emailThreadId },
          data: {
            status: 'RESPONSE_RECEIVED',
          },
        });

        // Check if this email thread is associated with an order for tracking extraction
        if (llmClient) {
          try {
            const associatedOrder = await prisma.order.findFirst({
              where: { emailThreadId },
              select: {
                id: true,
                orderNumber: true,
                status: true,
                trackingNumber: true,
              },
            });

            if (associatedOrder) {
              workerLogger.info({ orderNumber: associatedOrder.orderNumber }, 'Email thread is associated with order, checking for tracking info');
              
              // Extract tracking information
              const trackingData = await extractTrackingWithLLM(
                llmClient,
                emailData,
                attachmentText,
                associatedOrder.orderNumber
              );

              // Prepare order update data
              const orderUpdateData: any = {};
              let hasTrackingUpdates = false;

              if (trackingData.trackingNumber) {
                orderUpdateData.trackingNumber = trackingData.trackingNumber;
                hasTrackingUpdates = true;
                workerLogger.info({ trackingNumber: trackingData.trackingNumber }, 'Found tracking number');
              }

              if (trackingData.carrier) {
                orderUpdateData.shippingCarrier = trackingData.carrier;
                hasTrackingUpdates = true;
                workerLogger.info({ carrier: trackingData.carrier }, 'Found carrier');
              }

              if (trackingData.shippingMethod) {
                orderUpdateData.shippingMethod = trackingData.shippingMethod;
                hasTrackingUpdates = true;
                workerLogger.info({ shippingMethod: trackingData.shippingMethod }, 'Found shipping method');
              }

              if (trackingData.estimatedDeliveryDate) {
                try {
                  orderUpdateData.expectedDelivery = new Date(trackingData.estimatedDeliveryDate);
                  hasTrackingUpdates = true;
                  workerLogger.info({ estimatedDeliveryDate: trackingData.estimatedDeliveryDate }, 'Found estimated delivery');
                } catch (e) {
                  workerLogger.warn({ estimatedDeliveryDate: trackingData.estimatedDeliveryDate }, 'Invalid estimated delivery date');
                }
              }

              if (trackingData.actualDeliveryDate) {
                try {
                  orderUpdateData.actualDelivery = new Date(trackingData.actualDeliveryDate);
                  hasTrackingUpdates = true;
                  workerLogger.info({ actualDeliveryDate: trackingData.actualDeliveryDate }, 'Found actual delivery');
                } catch (e) {
                  workerLogger.warn({ actualDeliveryDate: trackingData.actualDeliveryDate }, 'Invalid actual delivery date');
                }
              }

              // Update order status if provided and different
              if (trackingData.orderStatus && trackingData.orderStatus !== associatedOrder.status) {
                // Map LLM status values to valid Prisma OrderStatus enum
                const statusMapping: Record<string, string> = {
                  'CONFIRMED': 'PROCESSING',
                  'SHIPPED': 'IN_TRANSIT',
                  'ON_HOLD': 'PENDING',
                };
                const mappedStatus = statusMapping[trackingData.orderStatus] || trackingData.orderStatus;
                orderUpdateData.status = mappedStatus as any;
                hasTrackingUpdates = true;
                workerLogger.info({ previousStatus: associatedOrder.status, newStatus: mappedStatus, rawStatus: trackingData.orderStatus }, 'Updating order status');
              }

              // Append tracking notes to internal notes
              if (trackingData.notes) {
                const existingOrder = await prisma.order.findUnique({
                  where: { id: associatedOrder.id },
                  select: { internalNotes: true },
                });
                const timestamp = new Date().toISOString();
                const newNote = `\n\n[${timestamp}] Tracking Update: ${trackingData.notes}`;
                orderUpdateData.internalNotes = (existingOrder?.internalNotes || '') + newNote;
                hasTrackingUpdates = true;
              }

              // Update order if we found any tracking information
              if (hasTrackingUpdates) {
                await prisma.order.update({
                  where: { id: associatedOrder.id },
                  data: {
                    ...orderUpdateData,
                    updatedAt: new Date(),
                  },
                });
                workerLogger.info({ orderNumber: associatedOrder.orderNumber }, 'Updated order with tracking information');
              } else {
                workerLogger.debug({ orderNumber: associatedOrder.orderNumber }, 'No tracking information found in email for order');
              }
            }
          } catch (trackingError: any) {
            workerLogger.error({ err: trackingError }, 'Error extracting tracking information');
            // Don't fail the entire job if tracking extraction fails
          }
        }

        workerLogger.info({
          jobId: job.id,
          quoteRequestId: existingQuoteRequestThread.quoteRequestId,
          supplierQuoteItemsCreated,
        }, 'Quote extraction job completed, updated quote request');

        return {
          success: true,
          action: 'updated',
          quoteRequestId: existingQuoteRequestThread.quoteRequestId,
          itemsExtracted: extractedData.items.length,
          supplierQuoteItemsCreated,
          attachmentsProcessed: processedAttachments.length,
        };
      } else {
        // No existing quote request - this is a standalone quote email
        // Update email thread to indicate quote was received
        await prisma.emailThread.update({
          where: { id: emailThreadId },
          data: {
            status: 'RESPONSE_RECEIVED',
          },
        });

        // Still check for associated orders for tracking extraction
        // (order replies may not have a linked quote request, e.g., after cross-account threading)
        if (llmClient) {
          try {
            const associatedOrder = await prisma.order.findFirst({
              where: { emailThreadId },
              select: {
                id: true,
                orderNumber: true,
                status: true,
                trackingNumber: true,
              },
            });

            if (associatedOrder) {
              workerLogger.info({ orderNumber: associatedOrder.orderNumber }, 'Email thread associated with order, checking for tracking info');

              const trackingData = await extractTrackingWithLLM(
                llmClient,
                emailData,
                attachmentText,
                associatedOrder.orderNumber
              );

              const orderUpdateData: any = {};
              let hasTrackingUpdates = false;

              if (trackingData.trackingNumber) {
                orderUpdateData.trackingNumber = trackingData.trackingNumber;
                hasTrackingUpdates = true;
              }
              if (trackingData.carrier) {
                orderUpdateData.shippingCarrier = trackingData.carrier;
                hasTrackingUpdates = true;
              }
              if (trackingData.shippingMethod) {
                orderUpdateData.shippingMethod = trackingData.shippingMethod;
                hasTrackingUpdates = true;
              }
              if (trackingData.estimatedDeliveryDate) {
                try {
                  orderUpdateData.expectedDelivery = new Date(trackingData.estimatedDeliveryDate);
                  hasTrackingUpdates = true;
                } catch (e) {
                  workerLogger.warn({ estimatedDeliveryDate: trackingData.estimatedDeliveryDate }, 'Invalid estimated delivery date');
                }
              }
              if (trackingData.actualDeliveryDate) {
                try {
                  orderUpdateData.actualDelivery = new Date(trackingData.actualDeliveryDate);
                  hasTrackingUpdates = true;
                } catch (e) {
                  workerLogger.warn({ actualDeliveryDate: trackingData.actualDeliveryDate }, 'Invalid actual delivery date');
                }
              }
              if (trackingData.orderStatus && trackingData.orderStatus !== associatedOrder.status) {
                const statusMapping: Record<string, string> = {
                  'CONFIRMED': 'PROCESSING',
                  'SHIPPED': 'IN_TRANSIT',
                  'ON_HOLD': 'PENDING',
                };
                const mappedStatus = statusMapping[trackingData.orderStatus] || trackingData.orderStatus;
                orderUpdateData.status = mappedStatus as any;
                hasTrackingUpdates = true;
                workerLogger.info({ previousStatus: associatedOrder.status, newStatus: mappedStatus }, 'Updating order status');
              }
              if (trackingData.notes) {
                const existingOrder = await prisma.order.findUnique({
                  where: { id: associatedOrder.id },
                  select: { internalNotes: true },
                });
                const timestamp = new Date().toISOString();
                orderUpdateData.internalNotes = (existingOrder?.internalNotes || '') + `\n\n[${timestamp}] Tracking Update: ${trackingData.notes}`;
                hasTrackingUpdates = true;
              }

              if (hasTrackingUpdates) {
                await prisma.order.update({
                  where: { id: associatedOrder.id },
                  data: { ...orderUpdateData, updatedAt: new Date() },
                });
                workerLogger.info({ orderNumber: associatedOrder.orderNumber }, 'Updated order with tracking information');
              } else {
                workerLogger.debug({ orderNumber: associatedOrder.orderNumber }, 'No tracking information found in email for order');
              }
            }
          } catch (trackingError: any) {
            workerLogger.error({ err: trackingError }, 'Error extracting tracking information');
          }
        }

        await job.updateProgress(100);

        workerLogger.info({ jobId: job.id }, 'Quote extraction job completed, no matching quote request found');

        return {
          success: true,
          action: 'extracted_only',
          itemsExtracted: extractedData.items.length,
          attachmentsProcessed: processedAttachments.length,
          extractedData,
        };
      }
    } catch (error: any) {
      workerLogger.error({ err: error, jobId: job.id }, 'Quote extraction job failed');

      // Try to update job queue record
      try {
        await prisma.jobQueue.updateMany({
          where: { jobId: job.id! },
          data: {
            status: 'FAILED',
            error: error.message,
            completedAt: new Date(),
          },
        });
      } catch (dbError) {
        workerLogger.error({ err: dbError }, 'Failed to update job queue');
      }

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

// Event handlers
quoteExtractionWorker.on('completed', async (job) => {
  workerLogger.info({ jobId: job.id }, 'Job completed');

  try {
    await prisma.jobQueue.updateMany({
      where: { jobId: job.id! },
      data: {
        status: 'COMPLETED',
        result: job.returnvalue,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    workerLogger.error({ err: error }, 'Failed to update job queue on completion');
  }
});

quoteExtractionWorker.on('failed', async (job, err) => {
  workerLogger.error({ err, jobId: job?.id }, 'Job failed');

  if (job) {
    try {
      await prisma.jobQueue.updateMany({
        where: { jobId: job.id! },
        data: {
          status: 'FAILED',
          error: err.message,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      workerLogger.error({ err: error }, 'Failed to update job queue on failure');
    }
  }
});

quoteExtractionWorker.on('active', async (job) => {
  workerLogger.info({ jobId: job.id }, 'Job started processing');

  try {
    await prisma.jobQueue.updateMany({
      where: { jobId: job.id! },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });
  } catch (error) {
    workerLogger.error({ err: error }, 'Failed to update job queue on active');
  }
});

quoteExtractionWorker.on('progress', (job, progress) => {
  workerLogger.debug({ jobId: job.id, progress }, 'Job progress');
});

quoteExtractionWorker.on('error', (err) => {
  workerLogger.error({ err }, 'Worker error');
});

workerLogger.info('Quote extraction worker started');
