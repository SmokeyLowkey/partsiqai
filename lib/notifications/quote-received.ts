import { prisma } from '@/lib/prisma';
import { sendEmail, getBaseUrl } from '@/lib/email/resend';

interface NotifyQuoteReceivedParams {
  quoteRequestId: string;
  supplierName: string;
  channel: 'phone_call' | 'email';
  organizationId: string;
  /** Number of price items extracted. When 0, the email says "call completed" instead of "pricing extracted". */
  itemsExtracted?: number;
}

/**
 * Send a notification email to the quote creator when a supplier responds.
 * Wrapped in try/catch so failures never break the caller.
 */
export async function notifyQuoteReceived(params: NotifyQuoteReceivedParams): Promise<void> {
  const { quoteRequestId, supplierName, channel, organizationId, itemsExtracted } = params;

  try {
    // Look up the quote and its creator
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id: quoteRequestId },
      select: {
        quoteNumber: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            emailNotifications: true,
          },
        },
      },
    });

    if (!quoteRequest?.createdBy) return;

    const { createdBy, quoteNumber } = quoteRequest;

    // Create activity log entry regardless of email preference
    const channelLabel = channel === 'phone_call' ? 'phone call' : 'email';
    await prisma.activityLog.create({
      data: {
        organizationId,
        type: 'QUOTE_RECEIVED',
        title: `Quote response received from ${supplierName}`,
        description: `${supplierName} responded to ${quoteNumber} via ${channelLabel}`,
        entityType: 'QUOTE_REQUEST',
        entityId: quoteRequestId,
        userId: createdBy.id,
        metadata: {
          supplierName,
          channel,
          quoteNumber,
        },
      },
    });

    // Check if user has email notifications enabled
    if (!createdBy.emailNotifications) return;
    if (!createdBy.email) return;

    const subject = `Quote Response Received — ${quoteNumber}`;
    const html = getQuoteReceivedEmailHtml({
      userName: createdBy.name || 'there',
      quoteNumber: quoteNumber || quoteRequestId,
      supplierName,
      channelLabel,
      quoteUrl: `${getBaseUrl()}/customer/quote-requests/${quoteRequestId}`,
      itemsExtracted: itemsExtracted ?? -1,
    });

    await sendEmail({ to: createdBy.email, subject, html });
  } catch (error) {
    // Log but never throw — notifications must not break the caller
    console.error('[notifyQuoteReceived] Failed to send notification:', error);
  }
}

function getQuoteReceivedEmailHtml(params: {
  userName: string;
  quoteNumber: string;
  supplierName: string;
  channelLabel: string;
  quoteUrl: string;
  /** -1 = unknown (default message), 0 = call completed but no pricing, >0 = pricing extracted */
  itemsExtracted: number;
}): string {
  const { userName, quoteNumber, supplierName, channelLabel, quoteUrl, itemsExtracted } = params;

  const detailLine =
    itemsExtracted > 0
      ? 'The pricing information has been automatically extracted and added to your quote comparison table.'
      : itemsExtracted === 0
        ? 'The call has completed. You may need to manually review the conversation or follow up for pricing details.'
        : 'The pricing information has been automatically extracted and added to your quote comparison table.';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote Response Received - PartsIQ</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #334155;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    .header {
      background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #1e293b;
      margin: 0 0 20px 0;
      font-size: 24px;
    }
    .content p {
      margin: 0 0 20px 0;
      color: #475569;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #9333ea 0%, #06b6d4 100%);
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .info-box {
      background: #f1f5f9;
      border-left: 4px solid #9333ea;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
    }
    .footer {
      background: #f8fafc;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 0 0 10px 0;
      font-size: 13px;
      color: #64748b;
    }
    .footer a {
      color: #9333ea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Quote Response Received</h1>
    </div>

    <div class="content">
      <h2>Hi ${userName},</h2>

      <p><strong>${supplierName}</strong> has responded to your quote request <strong>${quoteNumber}</strong> via ${channelLabel}.</p>

      <p>${detailLine}</p>

      <div style="text-align: center;">
        <a href="${quoteUrl}" class="button">
          View Quote Details
        </a>
      </div>

      <div class="info-box">
        <p>You can manage your notification preferences in your account settings.</p>
      </div>
    </div>

    <div class="footer">
      <p>Need help? <a href="mailto:support@partsiq.com">Contact our support team</a></p>
      <p>&copy; ${new Date().getFullYear()} PartsIQ AI. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}
