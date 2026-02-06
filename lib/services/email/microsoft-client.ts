import { prisma } from '@/lib/prisma';
import { decryptCredentials, encryptCredentials } from '../credentials/encryption';

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

interface MicrosoftCredentials {
  clientId: string;
  clientSecret: string;
  tenantId?: string;
  refreshToken: string;
  accessToken?: string;
  expiryDate?: number;
}

export class MicrosoftClient {
  private credentials: MicrosoftCredentials;
  private userId?: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private constructor(credentials: MicrosoftCredentials, userId?: string) {
    this.credentials = credentials;
    this.userId = userId;
    this.accessToken = credentials.accessToken || null;
    this.tokenExpiry = credentials.expiryDate || 0;
  }

  /**
   * Create MicrosoftClient from user's stored credentials in UserEmailIntegration
   */
  static async fromUser(userId: string): Promise<MicrosoftClient> {
    const emailIntegration = await prisma.userEmailIntegration.findUnique({
      where: { userId },
    });

    if (!emailIntegration) {
      throw new Error('Email integration not configured for this user. Please ask an admin to set up your email account.');
    }

    if (emailIntegration.providerType !== 'MICROSOFT_OAUTH') {
      throw new Error('This user is not configured for Microsoft. Provider type: ' + emailIntegration.providerType);
    }

    const credentials = decryptCredentials<MicrosoftCredentials>(emailIntegration.credentials);

    if (!credentials?.clientId || !credentials?.clientSecret) {
      throw new Error('Microsoft OAuth credentials not properly configured for this user.');
    }

    if (!credentials.refreshToken) {
      throw new Error('Microsoft not authorized. Please ask an admin to authorize your Microsoft account.');
    }

    return new MicrosoftClient(credentials, userId);
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry > Date.now() + 60000) {
      return this.accessToken;
    }

    // Refresh the token
    const tenantId = this.credentials.tenantId || 'common';
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.credentials.refreshToken,
        grant_type: 'refresh_token',
        scope: [
          'offline_access',
          'https://graph.microsoft.com/Mail.Read',
          'https://graph.microsoft.com/Mail.Send',
          'https://graph.microsoft.com/Mail.ReadWrite',
          'https://graph.microsoft.com/User.Read',
        ].join(' '),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Microsoft token refresh error:', errorData);
      throw new Error('Failed to refresh Microsoft access token. Please re-authenticate.');
    }

    const tokens = await response.json();
    this.accessToken = tokens.access_token;
    this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);

    // Update stored credentials with new access token
    if (this.userId) {
      try {
        const emailIntegration = await prisma.userEmailIntegration.findUnique({
          where: { userId: this.userId },
        });

        if (emailIntegration) {
          const currentCreds = decryptCredentials<MicrosoftCredentials>(emailIntegration.credentials);
          if (currentCreds) {
            const updatedCreds = encryptCredentials({
              ...currentCreds,
              accessToken: tokens.access_token,
              expiryDate: this.tokenExpiry,
              // Update refresh token if a new one was provided
              ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
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
        console.error('Failed to update Microsoft access token:', error);
      }
    }

    return this.accessToken!;
  }

  /**
   * Make an authenticated request to Microsoft Graph API
   */
  private async graphRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    return response;
  }

  /**
   * Fetch new emails from inbox
   */
  async fetchNewEmails(afterMessageId?: string): Promise<EmailData[]> {
    try {
      console.log('Fetching emails from Microsoft inbox...');

      // Fetch messages from inbox
      let endpoint = '/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc';
      endpoint += '&$select=id,conversationId,receivedDateTime,subject,from,toRecipients,ccRecipients,body,hasAttachments';

      const response = await this.graphRequest(endpoint);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch emails');
      }

      const data = await response.json();
      const messages = data.value || [];

      console.log(`Found ${messages.length} messages in inbox`);

      if (messages.length === 0) {
        return [];
      }

      // If afterMessageId is provided, filter to newer messages
      if (afterMessageId) {
        const afterIndex = messages.findIndex((m: any) => m.id === afterMessageId);
        if (afterIndex === 0) {
          console.log('No new emails since last sync');
          return [];
        } else if (afterIndex > 0) {
          const newMessages = messages.slice(0, afterIndex);
          console.log(`Found ${newMessages.length} new emails since last sync`);
          return this.convertToEmailData(newMessages.slice(0, 20));
        }
      }

      // First sync or afterMessageId not found
      console.log('Processing up to 10 recent emails');
      return this.convertToEmailData(messages.slice(0, 10));
    } catch (error: any) {
      console.error('Error fetching Microsoft emails:', error);
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }
  }

  /**
   * Convert Microsoft Graph messages to EmailData format
   */
  private async convertToEmailData(messages: any[]): Promise<EmailData[]> {
    const emailData: EmailData[] = [];

    for (const message of messages) {
      try {
        // Fetch attachments if present
        let attachments: EmailData['attachments'] = [];
        if (message.hasAttachments) {
          const attachResponse = await this.graphRequest(`/me/messages/${message.id}/attachments`);
          if (attachResponse.ok) {
            const attachData = await attachResponse.json();
            attachments = (attachData.value || []).map((att: any) => ({
              filename: att.name,
              mimeType: att.contentType,
              size: att.size,
              attachmentId: att.id,
            }));
          }
        }

        // Build headers array similar to Gmail format
        const headers = [
          { name: 'From', value: message.from?.emailAddress?.address || '' },
          { name: 'To', value: message.toRecipients?.map((r: any) => r.emailAddress?.address).join(', ') || '' },
          { name: 'Cc', value: message.ccRecipients?.map((r: any) => r.emailAddress?.address).join(', ') || '' },
          { name: 'Subject', value: message.subject || '' },
          { name: 'Date', value: message.receivedDateTime || '' },
        ];

        emailData.push({
          id: message.id,
          threadId: message.conversationId,
          date: new Date(message.receivedDateTime).getTime().toString(),
          headers,
          parts: [{
            mimeType: message.body?.contentType === 'html' ? 'text/html' : 'text/plain',
            body: { data: Buffer.from(message.body?.content || '').toString('base64') },
          }],
          attachments,
        });
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
      }
    }

    return emailData;
  }

  /**
   * Send an email via Microsoft Graph API
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
      console.log('Sending email via Microsoft Graph to:', to);

      const message: any = {
        subject,
        body: {
          contentType: 'HTML',
          content: bodyHtml,
        },
        toRecipients: [{ emailAddress: { address: to } }],
      };

      if (cc && cc.length > 0) {
        message.ccRecipients = cc.map(addr => ({ emailAddress: { address: addr } }));
      }

      if (bcc && bcc.length > 0) {
        message.bccRecipients = bcc.map(addr => ({ emailAddress: { address: addr } }));
      }

      // If this is a reply, set the conversationId
      if (options?.threadId) {
        message.conversationId = options.threadId;
      }

      // Send the message
      const response = await this.graphRequest('/me/sendMail', {
        method: 'POST',
        body: JSON.stringify({ message, saveToSentItems: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to send email');
      }

      // Microsoft doesn't return the message ID on send, so we need to fetch it
      // from sent items. For now, generate a placeholder and use threadId if available.
      const messageId = `microsoft-${Date.now()}`;
      const threadId = options?.threadId || `thread-${Date.now()}`;

      console.log('Email sent successfully via Microsoft');
      return { messageId, threadId };
    } catch (error: any) {
      console.error('Error sending email via Microsoft:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Download an attachment
   */
  async downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    try {
      const response = await this.graphRequest(
        `/me/messages/${messageId}/attachments/${attachmentId}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to download attachment');
      }

      const data = await response.json();

      // Microsoft returns base64-encoded content in contentBytes
      if (data.contentBytes) {
        return Buffer.from(data.contentBytes, 'base64');
      }

      throw new Error('No attachment content found');
    } catch (error: any) {
      console.error('Error downloading attachment:', error);
      throw new Error(`Failed to download attachment: ${error.message}`);
    }
  }
}
