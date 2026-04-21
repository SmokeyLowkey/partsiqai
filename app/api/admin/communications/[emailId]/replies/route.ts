import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';
import { withHardening } from '@/lib/api/with-hardening';
import { auditAdminAction } from '@/lib/audit-admin';
import { z } from 'zod';

const SENDER_OPTIONS = [
  'onboarding@partsiqai.com',
  'support@partsiqai.com',
  'sales@partsiqai.com',
] as const;

const ReplySchema = z.object({
  body: z.string().min(1, 'Reply body is required'),
  senderEmail: z.enum(SENDER_OPTIONS),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user || session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { emailId } = await params;

    const replies = await prisma.adminEmailReply.findMany({
      where: { adminEmailId: emailId },
      include: {
        sentBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { receivedAt: 'asc' },
    });

    return NextResponse.json({ replies });
  } catch (error) {
    console.error('Error fetching email replies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch replies' },
      { status: 500 }
    );
  }
}

export const POST = withHardening(
  {
    roles: ['MASTER_ADMIN'],
    rateLimit: { limit: 30, windowSeconds: 3600, prefix: 'admin-comms-reply', keyBy: 'user' },
  },
  async (request: Request, { params }: { params: Promise<{ emailId: string }> }) => {
  try {
    const session = await getServerSession();
    if (!session?.user || session.user.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { emailId } = await params;
    const rawBody = await request.json();
    const validation = ReplySchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { body, senderEmail } = validation.data;

    // Look up the original admin email
    const adminEmail = await prisma.adminEmail.findUnique({
      where: { id: emailId },
    });
    if (!adminEmail) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Get all existing replies to build threading headers
    const existingReplies = await prisma.adminEmailReply.findMany({
      where: { adminEmailId: emailId, resendMessageId: { not: null } },
      orderBy: { receivedAt: 'desc' },
      select: { resendMessageId: true },
    });

    // Build In-Reply-To (latest message in thread) and References (all message IDs)
    const allMessageIds: string[] = [];
    if (adminEmail.resendMessageId) {
      allMessageIds.push(adminEmail.resendMessageId);
    }
    for (const reply of existingReplies.reverse()) {
      if (reply.resendMessageId) {
        allMessageIds.push(reply.resendMessageId);
      }
    }

    const latestMessageId = allMessageIds[allMessageIds.length - 1];
    const headers: Record<string, string> = {};
    if (latestMessageId) {
      headers['In-Reply-To'] = `<${latestMessageId}>`;
    }
    if (allMessageIds.length > 0) {
      headers['References'] = allMessageIds.map((id) => `<${id}>`).join(' ');
    }

    // Build subject with Re: prefix
    const subject = adminEmail.subject.startsWith('Re:')
      ? adminEmail.subject
      : `Re: ${adminEmail.subject}`;

    // Send the reply via Resend
    const fromAddress = `PartsIQ <${senderEmail}>`;
    const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155;">${body.replace(/\n/g, '<br>')}</div>`;

    let resendMessageId: string | null = null;
    try {
      const result = await sendEmail({
        to: adminEmail.recipientEmail,
        subject,
        html: htmlBody,
        from: fromAddress,
        headers,
        organizationId: adminEmail.organizationId ?? undefined,
      });
      resendMessageId = result?.id ?? null;
    } catch (err: any) {
      console.error('Failed to send reply:', err);
      return NextResponse.json(
        { error: `Failed to send reply: ${err.message}` },
        { status: 500 }
      );
    }

    // Store the outbound reply
    const reply = await prisma.adminEmailReply.create({
      data: {
        adminEmailId: emailId,
        direction: 'OUTBOUND',
        fromEmail: senderEmail,
        fromName: session.user.name || 'PartsIQ Admin',
        toEmail: adminEmail.recipientEmail,
        subject,
        bodyText: body,
        bodyHtml: htmlBody,
        resendMessageId,
        sentById: session.user.id,
      },
      include: {
        sentBy: { select: { id: true, name: true, email: true } },
      },
    });

    await auditAdminAction({
      req: request,
      session: { user: { id: session.user.id, organizationId: session.user.organizationId } },
      eventType: 'ADMIN_EMAIL_SENT',
      description: `${session.user.email} replied to ${adminEmail.recipientEmail} on admin email ${adminEmail.id}`,
      metadata: {
        action: 'reply',
        originalAdminEmailId: adminEmail.id,
        senderEmail,
        recipientEmail: adminEmail.recipientEmail,
        resendMessageId,
      },
    });

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Error sending reply:', error);
    return NextResponse.json(
      { error: 'Failed to send reply' },
      { status: 500 }
    );
  }
  }
);
