import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { isWebhookTimestampFresh } from '@/lib/api-utils';
import { claimWebhook } from '@/lib/webhook-dedupe';

export const dynamic = 'force-dynamic';

// Verify Resend webhook signature (Svix)
function verifyWebhookSignature(
  payload: string,
  headers: { svixId: string; svixTimestamp: string; svixSignature: string }
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('RESEND_WEBHOOK_SECRET not set — skipping signature verification');
    return true;
  }

  // Resend/Svix secret is base64-encoded with a "whsec_" prefix
  const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64');
  const toSign = `${headers.svixId}.${headers.svixTimestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(toSign)
    .digest('base64');

  // The signature header can contain multiple signatures separated by spaces
  const signatures = headers.svixSignature.split(' ').map((s) => s.replace('v1,', ''));
  return signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(sig)
      );
    } catch {
      return false;
    }
  });
}

// Normalize email: strip Gmail-style +alias tags (user+tag@gmail.com → user@gmail.com)
function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split('@');
  if (!domain) return email.toLowerCase();
  return `${local.split('+')[0]}@${domain}`;
}

// Match an inbound email reply to the original outbound AdminEmail
async function findOriginalEmail(inReplyToMessageId: string | null, fromEmail: string, subject: string) {
  // Strategy 1: Match by In-Reply-To header → resendMessageId
  if (inReplyToMessageId) {
    // Resend message IDs in headers look like <msg_id@resend.dev>
    const cleanId = inReplyToMessageId.replace(/[<>]/g, '').split('@')[0];
    const match = await prisma.adminEmail.findFirst({
      where: {
        resendMessageId: cleanId,
        status: { notIn: ['failed', 'pending'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (match) return match;
  }

  // Strategy 2: Match by recipient email + subject (strip all Re:/Fwd:/Fw: prefixes)
  const cleanSubject = subject.replace(/^((Re|Fwd|Fw)\s*:\s*)+/i, '').trim();
  if (!cleanSubject) return null;

  // Try exact email match first
  const exactMatch = await prisma.adminEmail.findFirst({
    where: {
      recipientEmail: fromEmail,
      subject: { contains: cleanSubject, mode: 'insensitive' },
      status: { notIn: ['failed', 'pending'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (exactMatch) return exactMatch;

  // Fallback: match by normalized email (handles Gmail +alias replies)
  // e.g. sent to user+tech@gmail.com, reply comes from user@gmail.com
  const normalizedFrom = normalizeEmail(fromEmail);
  const candidates = await prisma.adminEmail.findMany({
    where: {
      subject: { contains: cleanSubject, mode: 'insensitive' },
      status: { notIn: ['failed', 'pending'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return candidates.find((e) => normalizeEmail(e.recipientEmail) === normalizedFrom) || null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const headersList = request.headers;

    const svixId = headersList.get('svix-id') || '';
    const svixTimestamp = headersList.get('svix-timestamp') || '';
    const svixSignature = headersList.get('svix-signature') || '';

    if (!isWebhookTimestampFresh(svixTimestamp)) {
      console.error('Resend webhook rejected: timestamp outside 5-minute window');
      return NextResponse.json({ error: 'Stale webhook' }, { status: 401 });
    }

    if (!verifyWebhookSignature(rawBody, { svixId, svixTimestamp, svixSignature })) {
      console.error('Resend webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Svix delivers webhooks at-least-once. svix-id is the stable dedupe key.
    const fresh = await claimWebhook('resend', svixId);
    if (!fresh) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.type as string;

    // Handle inbound email (reply received)
    if (eventType === 'email.received') {
      const data = event.data;
      const emailId = data.email_id;

      // The webhook payload only contains metadata (from, to, subject).
      // We must call the Resend API to get the full email body and headers.
      // Note: inbound emails use GET /emails/received/{id}, not /emails/{id}.
      let fullEmail: any = null;
      if (emailId) {
        try {
          const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          });
          if (res.ok) {
            fullEmail = await res.json();
          } else {
            console.error(`Resend API returned ${res.status} for received email ${emailId}`);
          }
        } catch (err) {
          console.error(`Failed to fetch full inbound email ${emailId}:`, err);
        }
      }

      // Parse the "from" field — it's a string like "Name <email@example.com>"
      const rawFrom: string = fullEmail?.from || data.from || '';
      const fromMatch = rawFrom.match(/^(.+?)\s*<(.+?)>$/);
      const fromEmail = fromMatch ? fromMatch[2] : rawFrom.replace(/[<>]/g, '').trim();
      const fromName = fromMatch ? fromMatch[1].trim() : null;

      const subject = fullEmail?.subject || data.subject || '(No subject)';
      const bodyText = fullEmail?.text || null;
      const bodyHtml = fullEmail?.html || null;
      const inReplyTo = fullEmail?.headers?.['in-reply-to'] || null;

      const originalEmail = await findOriginalEmail(inReplyTo, fromEmail, subject);

      if (originalEmail) {
        await prisma.adminEmailReply.create({
          data: {
            adminEmailId: originalEmail.id,
            fromEmail,
            fromName,
            subject,
            bodyText,
            bodyHtml,
            resendMessageId: emailId || null,
          },
        });
        console.log(`Stored reply from ${fromEmail} to admin email ${originalEmail.id}`);
      } else {
        console.warn(`Received inbound email from ${fromEmail} (subject: "${subject}") but could not match to an outbound admin email`);
      }
    }

    // Handle bounce/complaint events to update email status
    if (eventType === 'email.bounced') {
      const resendMessageId = event.data?.email_id;
      if (resendMessageId) {
        await prisma.adminEmail.updateMany({
          where: { resendMessageId },
          data: { status: 'bounced', errorMessage: 'Email bounced' },
        });
      }
    }

    if (eventType === 'email.complained') {
      const resendMessageId = event.data?.email_id;
      if (resendMessageId) {
        await prisma.adminEmail.updateMany({
          where: { resendMessageId },
          data: { status: 'complained', errorMessage: 'Recipient marked as spam' },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Resend webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
