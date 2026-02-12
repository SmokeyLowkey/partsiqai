import { Mistral } from '@mistralai/mistralai';
import { getSignedPdfUrl } from '../storage/s3-client';
import { credentialsManager } from '../credentials/credentials-manager';

export interface ParsedPdfResult {
  text: string;
  numPages: number;
  info: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

/**
 * Parse PDF using Mistral OCR with document URL
 * @param organizationId - Organization ID for credential retrieval
 * @param s3Key - S3 key for the PDF file
 */
export async function parsePdfFromS3(organizationId: string, s3Key: string): Promise<ParsedPdfResult> {
  try {
    // Get Mistral credentials using platform credentials fallback
    const credentials = await credentialsManager.getCredentialsWithFallback<{ apiKey: string }>(
      organizationId,
      'MISTRAL'
    );

    if (!credentials?.apiKey) {
      throw new Error('Mistral API credentials not configured');
    }

    const mistral = new Mistral({
      apiKey: credentials.apiKey,
    });

    // Generate presigned URL with 1 hour expiration
    const presignedUrl = await getSignedPdfUrl(s3Key, 3600);
    
    console.log(`Using Mistral OCR for PDF from S3: ${s3Key}`);

    // Use Mistral's OCR process API with presigned URL
    const result = await mistral.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        documentUrl: presignedUrl,
        type: 'document_url',
      },
    });

    // Extract text from all pages - each page has markdown content
    const extractedText = result.pages
      .map((page) => page.markdown)
      .join('\n\n');

    return {
      text: extractedText,
      numPages: result.pages?.length || 1,
      info: {
        title: undefined,
        author: undefined,
        subject: undefined,
        creator: 'mistral-ocr-latest',
        producer: undefined,
        creationDate: undefined,
        modificationDate: undefined,
      },
    };
  } catch (error: any) {
    console.error('PDF parsing error with Mistral OCR:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Parse PDF buffer and extract text content using Mistral OCR
 * Note: This uploads to a temp location or uses base64, preferably use parsePdfFromS3 instead
 * @param organizationId - Organization ID for credential retrieval
 * @param buffer - PDF file buffer
 */
export async function parsePdf(organizationId: string, buffer: Buffer): Promise<ParsedPdfResult> {
  try {
    // Get Mistral credentials using platform credentials fallback
    const credentials = await credentialsManager.getCredentialsWithFallback<{ apiKey: string }>(
      organizationId,
      'MISTRAL'
    );

    if (!credentials?.apiKey) {
      throw new Error('Mistral API credentials not configured');
    }

    const mistral = new Mistral({
      apiKey: credentials.apiKey,
    });

    // Convert buffer to base64 data URL
    const base64Pdf = buffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

    console.log(`Using Mistral OCR for PDF buffer (${buffer.length} bytes)`);

    // Use Mistral's OCR process API with base64 data URL
    const result = await mistral.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        documentUrl: dataUrl,
        type: 'document_url',
      },
    });

    // Extract text from all pages - each page has markdown content
    const extractedText = result.pages
      .map((page) => page.markdown)
      .join('\n\n');

    return {
      text: extractedText,
      numPages: result.pages?.length || 1,
      info: {
        title: undefined,
        author: undefined,
        subject: undefined,
        creator: 'mistral-ocr-latest',
        producer: undefined,
        creationDate: undefined,
        modificationDate: undefined,
      },
    };
  } catch (error: any) {
    console.error('PDF parsing error with Mistral OCR:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Extract text from PDF in S3 and clean it for LLM processing
 * @param organizationId - Organization ID for credential retrieval
 * @param s3Key - S3 key for the PDF file
 */
export async function extractPdfTextFromS3(organizationId: string, s3Key: string): Promise<string> {
  const result = await parsePdfFromS3(organizationId, s3Key);

  // Clean up the text for better LLM processing
  let cleanedText = result.text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive line breaks
    .replace(/(\r?\n){3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  return cleanedText;
}

/**
 * Extract text from PDF buffer and clean it for LLM processing
 * @param organizationId - Organization ID for credential retrieval
 * @param buffer - PDF file buffer
 */
export async function extractPdfText(organizationId: string, buffer: Buffer): Promise<string> {
  const result = await parsePdf(organizationId, buffer);

  // Clean up the text for better LLM processing
  let cleanedText = result.text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive line breaks
    .replace(/(\r?\n){3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  return cleanedText;
}

/**
 * Check if a buffer is a valid PDF
 */
export function isValidPdf(buffer: Buffer): boolean {
  // Check PDF magic number (header)
  const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
  return buffer.subarray(0, 4).equals(pdfHeader);
}

/**
 * Extract structured quote data from PDF text using patterns
 * This is a fallback when LLM is not available
 */
export function extractBasicQuoteInfo(text: string): {
  possibleQuoteNumber?: string;
  possibleTotal?: number;
  possibleItems: Array<{
    partNumber?: string;
    description?: string;
    quantity?: number;
    price?: number;
  }>;
} {
  const result: ReturnType<typeof extractBasicQuoteInfo> = {
    possibleItems: [],
  };

  // Try to find quote/invoice number
  const quoteNumberMatch = text.match(
    /(?:quote|quotation|invoice|order|ref(?:erence)?)\s*(?:#|no\.?|number)?:?\s*([A-Z0-9-]+)/i
  );
  if (quoteNumberMatch) {
    result.possibleQuoteNumber = quoteNumberMatch[1];
  }

  // Try to find total amount
  const totalMatch = text.match(
    /(?:total|grand\s*total|amount\s*due|balance\s*due)[:\s]*\$?\s*([\d,]+\.?\d*)/i
  );
  if (totalMatch) {
    result.possibleTotal = parseFloat(totalMatch[1].replace(/,/g, ''));
  }

  // Try to find line items with part numbers and prices
  // Pattern: Part number followed by description and price
  const lineItemPattern =
    /([A-Z0-9][-A-Z0-9]+)\s+(.{10,50}?)\s+(\d+)\s+\$?([\d,]+\.?\d*)/gi;
  let match;
  while ((match = lineItemPattern.exec(text)) !== null) {
    result.possibleItems.push({
      partNumber: match[1],
      description: match[2].trim(),
      quantity: parseInt(match[3], 10),
      price: parseFloat(match[4].replace(/,/g, '')),
    });
  }

  return result;
}
