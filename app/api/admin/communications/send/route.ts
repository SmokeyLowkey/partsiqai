import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  sendEmail,
  getBaseUrl,
  getWelcomeFollowupEmailHtml,
  getTrialExpiringEmailHtml,
  getSetupHelpEmailHtml,
  getCustomAdminEmailHtml,
} from '@/lib/email/resend';
import { withHardening } from '@/lib/api/with-hardening';
import { auditAdminAction } from '@/lib/audit-admin';
import { z } from 'zod';

const SENDER_OPTIONS = [
  'onboarding@partsiqai.com',
  'support@partsiqai.com',
  'sales@partsiqai.com',
] as const;

const TEMPLATE_TYPES = ['welcome_followup', 'trial_expiring', 'setup_help', 'custom'] as const;

const SendEmailSchema = z.object({
  templateType: z.enum(TEMPLATE_TYPES),
  organizationId: z.string().min(1),
  recipientUserIds: z.array(z.string()).min(1, 'At least one recipient is required'),
  senderEmail: z.enum(SENDER_OPTIONS),
  subject: z.string().optional(),
  customBody: z.string().optional(),
  templateVars: z.record(z.unknown()).optional(),
}).refine(
  (data) => data.templateType !== 'custom' || (data.subject && data.customBody),
  { message: 'Subject and body are required for custom emails' }
);

// Mass-email surface — MASTER_ADMIN only, tight per-user cap to prevent a
// compromised admin account from blasting every user on the platform.
export const POST = withHardening(
  {
    roles: ['MASTER_ADMIN'],
    rateLimit: { limit: 5, windowSeconds: 3600, prefix: 'admin-comms-send', keyBy: 'user' },
  },
  async (request: Request) => {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const validation = SendEmailSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { templateType, organizationId, recipientUserIds, senderEmail, subject, customBody, templateVars } = validation.data;

    // Fetch org
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, trialEndsAt: true },
    });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Fetch recipients (verify they belong to the org)
    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientUserIds }, organizationId },
      select: { id: true, name: true, email: true },
    });

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipients found in this organization' }, { status: 400 });
    }

    const baseUrl = getBaseUrl();
    const fromAddress = `PartsIQ <${senderEmail}>`;
    const results: { sent: number; failed: number; emails: any[] } = { sent: 0, failed: 0, emails: [] };

    for (const recipient of recipients) {
      const recipientName = recipient.name || recipient.email.split('@')[0];
      let emailSubject: string;
      let html: string;

      switch (templateType) {
        case 'welcome_followup':
          emailSubject = subject || `Welcome to PartsIQ, ${recipientName}!`;
          html = getWelcomeFollowupEmailHtml(recipientName, org.name, `${baseUrl}/admin/dashboard`);
          break;
        case 'trial_expiring': {
          const daysLeft = templateVars?.daysLeft as number ??
            (org.trialEndsAt ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 7);
          emailSubject = subject || `Your PartsIQ trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
          html = getTrialExpiringEmailHtml(recipientName, org.name, daysLeft, `${baseUrl}/admin/billing`);
          break;
        }
        case 'setup_help':
          emailSubject = subject || 'Need help setting up PartsIQ?';
          html = getSetupHelpEmailHtml(recipientName, org.name, `${baseUrl}/admin/dashboard`);
          break;
        case 'custom':
          emailSubject = subject!;
          html = getCustomAdminEmailHtml(recipientName, subject!, customBody!);
          break;
      }

      let status = 'sent';
      let errorMessage: string | null = null;
      let resendMessageId: string | null = null;

      // Pre-create the record so we have an ID for the tracking header
      const adminEmail = await prisma.adminEmail.create({
        data: {
          subject: emailSubject,
          htmlBody: html,
          templateType,
          templateVars: templateVars ? JSON.parse(JSON.stringify(templateVars)) : undefined,
          senderEmail,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientUserId: recipient.id,
          organizationId,
          sentById: session.user.id,
          status: 'pending',
        },
      });

      try {
        const result = await sendEmail({
          to: recipient.email,
          subject: emailSubject,
          html,
          from: fromAddress,
          headers: {
            'X-PartsIQ-Admin-Email-Id': adminEmail.id,
          },
          organizationId,
        });
        resendMessageId = result?.id ?? null;
        status = 'sent';
      } catch (err: any) {
        status = 'failed';
        errorMessage = err.message || 'Unknown error';
      }

      await prisma.adminEmail.update({
        where: { id: adminEmail.id },
        data: { resendMessageId, status, errorMessage },
      });

      if (status === 'sent') {
        results.sent++;
      } else {
        results.failed++;
      }
      results.emails.push({ ...adminEmail, resendMessageId, status, errorMessage });
    }

    await auditAdminAction({
      req: request,
      session: { user: { id: session.user.id, organizationId: session.user.organizationId } },
      eventType: 'ADMIN_EMAIL_SENT',
      description: `${session.user.email} sent ${templateType} to ${results.sent}/${recipientUserIds.length} recipients in org ${organizationId}`,
      targetOrganizationId: organizationId,
      metadata: {
        templateType,
        senderEmail,
        recipientCount: recipientUserIds.length,
        sent: results.sent,
        failed: results.failed,
      },
    });

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Send admin email error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  }
);
