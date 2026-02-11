/**
 * Email Bounce Detection Utility
 * 
 * EDGE CASE #3: Email bounce/delivery failure tracking
 * Detects and parses bounce messages from mail servers to track supplier email deliverability
 */

export enum BounceType {
  HARD_BOUNCE = 'HARD_BOUNCE',     // Permanent failure (invalid address, domain doesn't exist)
  SOFT_BOUNCE = 'SOFT_BOUNCE',     // Temporary failure (mailbox full, server down)
  SPAM_COMPLAINT = 'SPAM_COMPLAINT', // Recipient marked as spam
  INVALID = 'INVALID',             // Email format/verification issues
}

export interface BounceDetectionResult {
  isBounce: boolean;
  bounceType?: BounceType;
  originalRecipient?: string;
  reason?: string;
  diagnosticCode?: string;
}

export class BounceDetector {
  // Common bounce sender addresses
  private static readonly BOUNCE_SENDERS = [
    'mailer-daemon',
    'postmaster',
    'mail delivery subsystem',
    'mail delivery system',
    'delivery status notification',
    'mail administrator',
    'mailerdaemon',
    'noreply',
    'no-reply',
    'bounce',
  ];

  // Hard bounce indicators (permanent failures)
  private static readonly HARD_BOUNCE_PATTERNS = [
    // Address doesn't exist
    /user (unknown|not found|doesn't exist|does not exist)/i,
    /recipient address rejected/i,
    /no such (user|recipient|mailbox|address)/i,
    /invalid (recipient|mailbox|address)/i,
    /address (rejected|invalid|unknown)/i,
    /mailbox (not found|unavailable|doesn't exist|does not exist)/i,
    /undeliverable/i,
    /permanent (failure|error)/i,
    /550 5\.1\.1/i, // User unknown
    /551 5\.1\.1/i, // User not local
    /553 5\.1\./i,  // Address issues
    /554 5\.7\.1/i, // Relay access denied
    /^5[50][0-9]\s/i, // 5xx SMTP errors
  ];

  // Soft bounce indicators (temporary failures)
  private static readonly SOFT_BOUNCE_PATTERNS = [
    /mailbox (full|quota|exceeded)/i,
    /over quota/i,
    /insufficient storage/i,
    /temporary (failure|error)/i,
    /try again later/i,
    /service (unavailable|not available)/i,
    /connection (timed out|timeout|refused)/i,
    /451 4\.3\./i, // Temporary failure
    /452 4\.2\.2/i, // Mailbox full
    /^4[50][0-9]\s/i, // 4xx SMTP errors (temporary)
  ];

  // Spam/complaint indicators
  private static readonly SPAM_PATTERNS = [
    /spam/i,
    /blocked/i,
    /blacklist/i,
    /reputation/i,
    /abuse/i,
    /complained/i,
    /unsolicited/i,
  ];

  /**
   * Check if an email is a bounce message
   */
  static isBounceMessage(from: string, subject: string, body: string): boolean {
    const lowerFrom = from.toLowerCase();
    const lowerSubject = subject.toLowerCase();
    const lowerBody = body.toLowerCase();

    // Check sender
    const isBounceSender = this.BOUNCE_SENDERS.some(sender => 
      lowerFrom.includes(sender)
    );

    // Check subject for bounce keywords
    const bounceSubjectKeywords = [
      'undeliverable',
      'delivery status notification',
      'delivery failure',
      'returned mail',
      'mail delivery failed',
      'failure notice',
      'permanent error',
      'undelivered',
      'could not be delivered',
      'mail system error',
    ];

    const hasBounceSubject = bounceSubjectKeywords.some(keyword =>
      lowerSubject.includes(keyword)
    );

    // Check body for delivery status notification format
    const hasDeliveryReport = lowerBody.includes('delivery-status') ||
                              lowerBody.includes('action: failed') ||
                              lowerBody.includes('status: 5.') ||
                              lowerBody.includes('diagnostic-code');

    return (isBounceSender && (hasBounceSubject || hasDeliveryReport));
  }

  /**
   * Analyze bounce message and determine type and reason
   */
  static analyzeBounce(subject: string, body: string): BounceDetectionResult {
    if (!this.isBounceMessage('', subject, body)) {
      return { isBounce: false };
    }

    const lowerBody = body.toLowerCase();
    const lowerSubject = subject.toLowerCase();
    const combinedText = `${lowerSubject} ${lowerBody}`;

    // Extract original recipient email
    const originalRecipient = this.extractOriginalRecipient(body);

    // Check for spam complaints first
    if (this.SPAM_PATTERNS.some(pattern => pattern.test(combinedText))) {
      return {
        isBounce: true,
        bounceType: BounceType.SPAM_COMPLAINT,
        originalRecipient,
        reason: 'Message marked as spam or blocked by recipient',
      };
    }

    // Check for hard bounce
    for (const pattern of this.HARD_BOUNCE_PATTERNS) {
      const match = combinedText.match(pattern);
      if (match) {
        const diagnosticCode = this.extractDiagnosticCode(body);
        return {
          isBounce: true,
          bounceType: BounceType.HARD_BOUNCE,
          originalRecipient,
          reason: match[0],
          diagnosticCode,
        };
      }
    }

    // Check for soft bounce
    for (const pattern of this.SOFT_BOUNCE_PATTERNS) {
      const match = combinedText.match(pattern);
      if (match) {
        const diagnosticCode = this.extractDiagnosticCode(body);
        return {
          isBounce: true,
          bounceType: BounceType.SOFT_BOUNCE,
          originalRecipient,
          reason: match[0],
          diagnosticCode,
        };
      }
    }

    // Default to hard bounce if we can't determine type
    return {
      isBounce: true,
      bounceType: BounceType.HARD_BOUNCE,
      originalRecipient,
      reason: 'Unknown delivery failure',
    };
  }

  /**
   * Extract the original recipient email from bounce message
   */
  private static extractOriginalRecipient(body: string): string | undefined {
    // Try various patterns to extract recipient
    const patterns = [
      /original-recipient:.*?rfc822;\s*([^\s<>]+@[^\s<>]+)/i,
      /final-recipient:.*?rfc822;\s*([^\s<>]+@[^\s<>]+)/i,
      /rcpt to:\s*<?([^\s<>]+@[^\s<>]+)>?/i,
      /to:\s*<?([^\s<>]+@[^\s<>]+)>?/i,
      /recipient:\s*<?([^\s<>]+@[^\s<>]+)>?/i,
      /delivered to:\s*<?([^\s<>]+@[^\s<>]+)>?/i,
      /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i, // Generic email pattern
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match?.[1]) {
        return match[1].toLowerCase().trim();
      }
    }

    return undefined;
  }

  /**
   * Extract diagnostic code from bounce message
   */
  private static extractDiagnosticCode(body: string): string | undefined {
    const patterns = [
      /diagnostic-code:.*?;\s*(.+?)(?:\n|$)/i,
      /remote-mta[\s\S]*?diagnostic-code:.*?;\s*(.+?)(?:\n|$)/i,
      /(5\.\d+\.\d+.*?)(?:\n|$)/i,
      /(4\.\d+\.\d+.*?)(?:\n|$)/i,
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match?.[1]) {
        return match[1].trim().substring(0, 200); // Limit length
      }
    }

    return undefined;
  }

  /**
   * Determine if bounce type is permanent (vs temporary)
   */
  static isPermanentBounce(bounceType: BounceType): boolean {
    return bounceType === BounceType.HARD_BOUNCE || 
           bounceType === BounceType.INVALID ||
           bounceType === BounceType.SPAM_COMPLAINT;
  }

  /**
   * Get suggested action based on bounce type
   */
  static getSuggestedAction(bounceType: BounceType): string {
    switch (bounceType) {
      case BounceType.HARD_BOUNCE:
        return 'Update or remove email address - permanent delivery failure';
      case BounceType.SOFT_BOUNCE:
        return 'Retry later - temporary issue with recipient mailbox or server';
      case BounceType.SPAM_COMPLAINT:
        return 'Contact supplier through alternative method - marked as spam';
      case BounceType.INVALID:
        return 'Verify and update email address format';
      default:
        return 'Review delivery failure details';
    }
  }
}
