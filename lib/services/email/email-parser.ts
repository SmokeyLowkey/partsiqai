import { prisma } from '@/lib/prisma';

export interface ParsedHeaders {
  from: string;
  to: string;
  cc: string[];
  bcc: string[];
  subject: string;
  date: string;
  messageId?: string;
  inReplyTo?: string;
}

export class EmailParser {
  parseHeaders(headers: any[]): ParsedHeaders {
    const getHeader = (name: string): string => {
      const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const getHeaderArray = (name: string): string[] => {
      const value = getHeader(name);
      return value ? value.split(',').map((v) => v.trim()) : [];
    };

    return {
      from: getHeader('from'),
      to: getHeader('to'),
      cc: getHeaderArray('cc'),
      bcc: getHeaderArray('bcc'),
      subject: getHeader('subject'),
      date: getHeader('date'),
      messageId: getHeader('message-id'),
      inReplyTo: getHeader('in-reply-to'),
    };
  }

  async identifySupplier(fromEmail: string, organizationId: string): Promise<any | null> {
    // Extract domain from email
    const domain = fromEmail.match(/@([^>]+)/)?.[1]?.toLowerCase();
    if (!domain) return null;

    // Try to find supplier by email or email domain
    const supplier = await prisma.supplier.findFirst({
      where: {
        organizationId,
        OR: [
          { email: fromEmail }, // Exact match
          { email: { contains: domain } }, // Domain match
          {
            auxiliaryEmails: {
              some: {
                email: fromEmail,
              },
            },
          },
          {
            auxiliaryEmails: {
              some: {
                email: { contains: domain },
              },
            },
          },
        ],
      },
    });

    return supplier;
  }

  extractBody(parts: any[]): { text: string; html: string } {
    let text = '';
    let html = '';

    const extractFromPart = (part: any) => {
      if (!part) return;

      // Check if this part is the body
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      // Recursively check nested parts
      if (part.parts && Array.isArray(part.parts)) {
        part.parts.forEach(extractFromPart);
      }
    };

    parts.forEach(extractFromPart);

    return { text, html };
  }

  /**
   * Extract email addresses from various formats
   * e.g., "John Doe <john@example.com>" -> "john@example.com"
   */
  extractEmailAddress(emailString: string): string {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString.trim();
  }

  /**
   * Check if email subject or body contains quote-related keywords
   */
  isQuoteEmail(subject: string, body: string): boolean {
    const quoteKeywords = [
      'quote',
      'quotation',
      'pricing',
      'price list',
      'proposal',
      'estimate',
      'cost',
      'invoice',
      'order confirmation',
      'rfq',
      'request for quote',
      'unit price',
      'total price',
      'availability',
      'lead time',
      'part number',
      'part #',
      'p/n',
      'qty',
      'quantity',
      'usd',
      'attached',
      'see attached',
      'please find',
    ];

    const lowerSubject = subject.toLowerCase();
    const lowerBody = body.toLowerCase();

    // Check for Re: in subject (replies to our quote requests)
    const isReply = lowerSubject.startsWith('re:');

    return isReply || quoteKeywords.some(
      (keyword) => lowerSubject.includes(keyword) || lowerBody.includes(keyword)
    );
  }
}
