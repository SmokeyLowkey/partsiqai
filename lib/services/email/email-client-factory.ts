import { prisma } from '@/lib/prisma';
import { GmailClient } from './gmail-client';
import { MicrosoftClient } from './microsoft-client';

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

  switch (emailIntegration.providerType) {
    case 'GMAIL_OAUTH':
      return await GmailClient.fromUser(userId);

    case 'MICROSOFT_OAUTH':
      return await MicrosoftClient.fromUser(userId);

    case 'SMTP':
      throw new Error('SMTP email sending is not yet implemented.');

    default:
      throw new Error(`Unknown email provider type: ${emailIntegration.providerType}`);
  }
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
