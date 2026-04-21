import { prisma } from '@/lib/prisma';
import { GmailClient } from './gmail-client';
import { MicrosoftClient } from './microsoft-client';
import { isOAuthReauthError, markEmailIntegrationNeedsReauth } from '@/lib/email/reauth';

export interface EmailClient {
  sendEmail(
    to: string,
    subject: string,
    bodyHtml: string,
    cc?: string[],
    bcc?: string[],
    options?: {
      threadId?: string;
      inReplyTo?: string;
      references?: string;
    }
  ): Promise<{ messageId: string; threadId: string }>;

  fetchNewEmails(afterMessageId?: string): Promise<any[]>;

  downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer>;
}

/**
 * Wrap a concrete client so every method catches `invalid_grant`-class
 * errors, flags the user's integration as needing re-authorization, then
 * rethrows. Without this, every caller has to know the reauth signals; with
 * it, the bookkeeping lives in one place and works for ~13 call sites.
 *
 * Proxying methods rather than subclassing keeps this interface-only — we
 * don't care which concrete client (Gmail, Microsoft) is underneath.
 */
function withReauthGuard(userId: string, client: EmailClient): EmailClient {
  const wrap = <F extends (...args: any[]) => Promise<any>>(fn: F): F =>
    (async (...args: Parameters<F>): Promise<ReturnType<F>> => {
      try {
        return await fn(...args);
      } catch (err) {
        if (isOAuthReauthError(err)) {
          await markEmailIntegrationNeedsReauth(
            userId,
            err instanceof Error ? err.message : 'OAuth token revoked or expired'
          );
        }
        throw err;
      }
    }) as F;

  return {
    sendEmail: wrap(client.sendEmail.bind(client)),
    fetchNewEmails: wrap(client.fetchNewEmails.bind(client)),
    downloadAttachment: wrap(client.downloadAttachment.bind(client)),
  };
}

/**
 * Factory function to create the appropriate email client based on user's configured provider
 */
export async function getEmailClientForUser(userId: string): Promise<EmailClient> {
  // Get user's email integration
  const emailIntegration = await prisma.userEmailIntegration.findUnique({
    where: { userId },
    select: { providerType: true },
  });

  if (!emailIntegration) {
    throw new Error('Email integration not configured for this user. Please ask an admin to set up your email account.');
  }

  let client: EmailClient;
  switch (emailIntegration.providerType) {
    case 'GMAIL_OAUTH':
      client = await GmailClient.fromUser(userId);
      break;

    case 'MICROSOFT_OAUTH':
      client = await MicrosoftClient.fromUser(userId);
      break;

    case 'SMTP':
      throw new Error('SMTP email sending is not yet implemented.');

    default:
      throw new Error(`Unknown email provider type: ${emailIntegration.providerType}`);
  }

  return withReauthGuard(userId, client);
}

/**
 * Factory function to get an email client for an organization
 * Finds the first user with active email integration
 */
export async function getEmailClientForOrganization(organizationId: string): Promise<EmailClient> {
  // Find a user with email integration configured for this organization
  const userWithEmail = await prisma.userEmailIntegration.findFirst({
    where: {
      user: { organizationId },
      isActive: true,
      providerType: { in: ['GMAIL_OAUTH', 'MICROSOFT_OAUTH'] },
    },
    select: { userId: true, providerType: true },
  });

  if (!userWithEmail) {
    throw new Error('No user with email integration found for this organization');
  }

  return getEmailClientForUser(userWithEmail.userId);
}
