import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { credentialsManager } from '../credentials/credentials-manager';
import { prisma } from '@/lib/prisma';
import { decryptCredentials } from '../credentials/encryption';

export interface EmailData {
  id: string;
  threadId: string;
  date: string;
  headers: any[];
  parts: any[];
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
}

export class GmailClient {
  private oauth2Client: OAuth2Client;
  private gmail: any;
  private userId?: string;

  private constructor(
    credentials: {
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      accessToken?: string;
    },
    userId?: string
  ) {
    this.userId = userId;
    this.oauth2Client = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      process.env.GMAIL_OAUTH_REDIRECT_URI
    );
    this.oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken,
      access_token: credentials.accessToken,
    });

    // Set up automatic token refresh
    this.oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        console.log('New refresh token received');
      }
      if (tokens.access_token && this.userId) {
        console.log('Access token refreshed, updating credentials for user');
        // Update stored credentials with new access token in UserEmailIntegration
        try {
          const emailIntegration = await prisma.userEmailIntegration.findUnique({
            where: { userId: this.userId },
          });

          if (emailIntegration) {
            const currentCreds = decryptCredentials<{
              clientId: string;
              clientSecret: string;
              refreshToken: string;
              accessToken?: string;
            }>(emailIntegration.credentials);

            if (currentCreds) {
              const { encryptCredentials } = await import('../credentials/encryption');
              const updatedCreds = encryptCredentials({
                ...currentCreds,
                accessToken: tokens.access_token,
              });

              await prisma.userEmailIntegration.update({
                where: { userId: this.userId },
                data: {
                  credentials: updatedCreds,
                  updatedAt: new Date(),
                },
              });
            }
          }
        } catch (error) {
          console.error('Failed to update access token:', error);
        }
      }
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Create GmailClient from user's stored credentials in UserEmailIntegration
   */
  static async fromUser(userId: string): Promise<GmailClient> {
    // Get credentials from UserEmailIntegration table
    const emailIntegration = await prisma.userEmailIntegration.findUnique({
      where: { userId },
    });

    if (!emailIntegration) {
      throw new Error('Email integration not configured for this user. Please ask an admin to set up your email account.');
    }

    if (emailIntegration.providerType !== 'GMAIL_OAUTH') {
      throw new Error('This user is not configured for Gmail. Provider type: ' + emailIntegration.providerType);
    }

    const credentials = decryptCredentials<{
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      accessToken?: string;
    }>(emailIntegration.credentials);

    if (!credentials?.clientId || !credentials?.clientSecret) {
      throw new Error('Gmail OAuth credentials not properly configured for this user.');
    }

    if (!credentials.refreshToken) {
      throw new Error('Gmail not authorized. Please ask an admin to authorize your Gmail account.');
    }

    return new GmailClient(credentials, userId);
  }

  /**
   * @deprecated Use fromUser() instead. Kept for backward compatibility.
   */
  static async fromOrganization(organizationId: string): Promise<GmailClient> {
    console.warn('GmailClient.fromOrganization is deprecated. Use fromUser() instead.');
    const credentials = await credentialsManager.getCredentials<{
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      accessToken?: string;
    }>(organizationId, 'GMAIL');

    if (!credentials) {
      throw new Error('Gmail credentials not configured for this organization');
    }

    return new GmailClient(credentials, undefined);
  }

  /**
   * Manually refresh the access token
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      console.log('Manually refreshing access token...');
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      console.log('Access token refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      throw new Error('Failed to refresh Gmail access token. Please re-authenticate.');
    }
  }

  async fetchNewEmails(afterMessageId?: string): Promise<EmailData[]> {
    try {
      // List messages from INBOX only
      const listParams: any = {
        userId: 'me',
        maxResults: 50,
        labelIds: ['INBOX'], // Only fetch inbox messages
      };

      console.log('Fetching emails from Gmail INBOX...');
      const response = await this.gmail.users.messages.list(listParams);
      const messages = response.data.messages || [];
      console.log(`Found ${messages.length} messages in INBOX`);

      if (messages.length === 0) {
        return [];
      }

      // If afterMessageId is provided, only fetch newer messages
      if (afterMessageId) {
        // Find the index of afterMessageId in the list
        const afterIndex = messages.findIndex((m: any) => m.id === afterMessageId);
        console.log(`afterMessageId: ${afterMessageId}, found at index: ${afterIndex}`);

        if (afterIndex === 0) {
          // afterMessageId is the newest message, no new emails
          console.log('No new emails since last sync');
          return [];
        } else if (afterIndex > 0) {
          // Only process messages before that index (newer messages)
          const newMessages = messages.slice(0, afterIndex);
          console.log(`Found ${newMessages.length} new emails since last sync`);
          return await this.fetchMessageDetails(newMessages.slice(0, 20)); // Limit to 20 new emails
        } else {
          // afterMessageId not found in list - it may be too old
          // In this case, just process recent emails but log a warning
          console.log(`Warning: afterMessageId ${afterMessageId} not found in recent messages. Processing up to 10 recent emails.`);
          return await this.fetchMessageDetails(messages.slice(0, 10));
        }
      } else {
        // No afterMessageId - first sync, get recent emails
        console.log('First sync - fetching up to 10 recent emails');
        return await this.fetchMessageDetails(messages.slice(0, 10));
      }
    } catch (error: any) {
      console.error('Error fetching emails:', error);
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }
  }

  private async fetchMessageDetails(messages: any[]): Promise<EmailData[]> {
    const emailData: EmailData[] = [];

    for (const message of messages) {
      try {
        const details = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });

        const payload = details.data.payload;
        const headers = payload.headers;

        // Extract attachments
        const attachments: EmailData['attachments'] = [];

        const extractAttachments = (parts: any[]) => {
          if (!parts) return;

          for (const part of parts) {
            if (part.filename && part.body?.attachmentId) {
              attachments.push({
                filename: part.filename,
                mimeType: part.mimeType,
                size: part.body.size,
                attachmentId: part.body.attachmentId,
              });
            }

            if (part.parts) {
              extractAttachments(part.parts);
            }
          }
        };

        extractAttachments(payload.parts || [payload]);

        emailData.push({
          id: details.data.id!,
          threadId: details.data.threadId!,
          date: details.data.internalDate!,
          headers,
          parts: payload.parts || [payload],
          attachments,
        });
      } catch (error) {
        console.error(`Error fetching message ${message.id}:`, error);
      }
    }

    return emailData;
  }

  /**
   * Send an email via Gmail API
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param bodyHtml - HTML body content
   * @param cc - Optional CC recipients
   * @param bcc - Optional BCC recipients
   * @param options - Optional settings for threading
   * @param options.threadId - Gmail thread ID to add this message to (for replies)
   * @param options.inReplyTo - Message-ID header of the message being replied to
   * @param options.references - References header for email threading
   */
  async sendEmail(
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
  ): Promise<{ messageId: string; threadId: string }> {
    try {
      // Build email headers - use CRLF as per RFC 822
      const headers: string[] = [];
      headers.push(`To: ${to}`);
      if (cc && cc.length > 0) {
        headers.push(`Cc: ${cc.join(', ')}`);
      }
      if (bcc && bcc.length > 0) {
        headers.push(`Bcc: ${bcc.join(', ')}`);
      }
      headers.push(`Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`);
      headers.push('MIME-Version: 1.0');
      headers.push('Content-Type: text/html; charset=UTF-8');
      headers.push('Content-Transfer-Encoding: base64');

      // Add threading headers if this is a reply
      // Message-IDs must be wrapped in angle brackets for proper threading
      if (options?.inReplyTo) {
        const messageId = options.inReplyTo.startsWith('<') 
          ? options.inReplyTo 
          : `<${options.inReplyTo}>`;
        console.log('In-Reply-To header value:', messageId);
        headers.push(`In-Reply-To: ${messageId}`);
      }
      if (options?.references) {
        const refs = options.references.startsWith('<') 
          ? options.references 
          : `<${options.references}>`;
        console.log('References header value:', refs);
        headers.push(`References: ${refs}`);
      }

      // Build the email with CRLF line endings
      const headerSection = headers.join('\r\n');
      const bodyBase64 = Buffer.from(bodyHtml).toString('base64');
      const email = `${headerSection}\r\n\r\n${bodyBase64}`;

      // Encode email in base64url format for Gmail API
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      console.log('Sending email to:', to);
      console.log('Subject:', subject);
      console.log('Body HTML length:', bodyHtml.length);
      if (options?.inReplyTo) {
        console.log('In-Reply-To:', options.inReplyTo);
        console.log('References:', options.references);
      }

      const requestBody: any = {
        raw: encodedEmail,
      };

      // Add threadId to request body if provided - this is critical for maintaining thread continuity
      if (options?.threadId) {
        requestBody.threadId = options.threadId;
      }

      // Build request parameters
      const requestParams: any = {
        userId: 'me',
        requestBody,
      };

      const response = await this.gmail.users.messages.send(requestParams);

      console.log('Email sent successfully, message ID:', response.data.id, 'thread ID:', response.data.threadId);
      return {
        messageId: response.data.id!,
        threadId: response.data.threadId!,
      };
    } catch (error: any) {
      console.error('Error sending email:', error);
      
      // If we get invalid_grant, try to refresh the token and retry once
      if (error.message?.includes('invalid_grant') || error.code === 401) {
        console.log('Token expired, attempting to refresh and retry...');
        try {
          await this.refreshAccessToken();
          
          // Rebuild request body for retry
          const headers: string[] = [];
          headers.push(`To: ${to}`);
          if (cc && cc.length > 0) {
            headers.push(`Cc: ${cc.join(', ')}`);
          }
          if (bcc && bcc.length > 0) {
            headers.push(`Bcc: ${bcc.join(', ')}`);
          }
          headers.push(`Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`);
          headers.push('MIME-Version: 1.0');
          headers.push('Content-Type: text/html; charset=UTF-8');
          headers.push('Content-Transfer-Encoding: base64');

          // Add threading headers with angle brackets
          if (options?.inReplyTo) {
            const messageId = options.inReplyTo.startsWith('<') 
              ? options.inReplyTo 
              : `<${options.inReplyTo}>`;
            headers.push(`In-Reply-To: ${messageId}`);
          }
          if (options?.references) {
            const refs = options.references.startsWith('<') 
              ? options.references 
              : `<${options.references}>`;
            headers.push(`References: ${refs}`);
          }

          const headerSection = headers.join('\r\n');
          const bodyBase64 = Buffer.from(bodyHtml).toString('base64');
          const email = `${headerSection}\r\n\r\n${bodyBase64}`;

          const encodedEmail = Buffer.from(email)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          const requestBody: any = {
            raw: encodedEmail,
          };

          // Add threadId to request body if provided - critical for maintaining thread continuity
          if (options?.threadId) {
            requestBody.threadId = options.threadId;
          }

          // Build request parameters for retry
          const requestParams: any = {
            userId: 'me',
            requestBody,
          };
          
          // Retry the send operation
          const response = await this.gmail.users.messages.send(requestParams);
          
          console.log('Email sent successfully after token refresh, message ID:', response.data.id);
          return {
            messageId: response.data.id!,
            threadId: response.data.threadId!,
          };
        } catch (retryError: any) {
          console.error('Failed to send email after token refresh:', retryError);
          throw new Error(`Failed to send email after token refresh: ${retryError.message}`);
        }
      }
      
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    try {
      const response = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
      });

      // Decode base64
      const data = response.data.data.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(data, 'base64');
    } catch (error: any) {
      console.error('Error downloading attachment:', error);
      throw new Error(`Failed to download attachment: ${error.message}`);
    }
  }
}
