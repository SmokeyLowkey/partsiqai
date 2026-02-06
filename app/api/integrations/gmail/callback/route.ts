import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';
import { prisma } from '@/lib/prisma';
import { decryptCredentials, encryptCredentials } from '@/lib/services/credentials/encryption';
import crypto from 'crypto';

const credentialsManager = new CredentialsManager();

interface OAuthStateData {
  organizationId: string;
  userId: string;
  csrfToken: string;
  isUserLevel?: boolean;
  targetUserId?: string;
}

function verifyOAuthStateToken(stateParam: string): OAuthStateData | null {
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    const { payload, hmac } = decoded;
    const expectedHmac = crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET!).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return null;
    }
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// GET /api/integrations/gmail/callback - Handle Gmail OAuth callback
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Verify CSRF-protected state token first to determine redirect URL
    const stateData = state ? verifyOAuthStateToken(state) : null;
    const isUserLevel = stateData?.isUserLevel;
    const errorRedirectBase = isUserLevel ? '/admin/users' : '/customer/settings';

    if (error) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${error}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=missing_params`, req.url)
      );
    }

    if (!stateData) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=invalid_state`, req.url)
      );
    }

    const { organizationId, targetUserId, userId } = stateData;

    let clientId: string;
    let clientSecret: string;
    let redirectUrl: string;

    if (isUserLevel && targetUserId) {
      // User-level OAuth: get credentials from UserEmailIntegration
      const emailIntegration = await prisma.userEmailIntegration.findUnique({
        where: { userId: targetUserId },
      });

      if (!emailIntegration) {
        return NextResponse.redirect(
          new URL('/admin/users?error=missing_config', req.url)
        );
      }

      const credentials = decryptCredentials<{ clientId: string; clientSecret: string }>(
        emailIntegration.credentials
      );

      if (!credentials?.clientId || !credentials?.clientSecret) {
        return NextResponse.redirect(
          new URL('/admin/users?error=missing_credentials', req.url)
        );
      }

      clientId = credentials.clientId;
      clientSecret = credentials.clientSecret;
      redirectUrl = '/admin/users?success=gmail_authorized';
    } else {
      // Org-level OAuth: get credentials from IntegrationCredential
      const gmailCreds = await credentialsManager.getCredentials<{
        clientId: string;
        clientSecret: string;
      }>(organizationId, 'GMAIL');

      if (!gmailCreds) {
        return NextResponse.redirect(
          new URL('/customer/settings?error=missing_config', req.url)
        );
      }

      clientId = gmailCreds.clientId;
      clientSecret = gmailCreds.clientSecret;
      redirectUrl = '/customer/settings?success=gmail_connected';
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GMAIL_OAUTH_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token || !tokens.access_token) {
      const errorUrl = isUserLevel ? '/admin/users?error=no_tokens' : '/customer/settings?error=no_tokens';
      return NextResponse.redirect(new URL(errorUrl, req.url));
    }

    if (isUserLevel && targetUserId) {
      // Save tokens to UserEmailIntegration
      const emailIntegration = await prisma.userEmailIntegration.findUnique({
        where: { userId: targetUserId },
      });

      if (emailIntegration) {
        const existingCreds = decryptCredentials<any>(emailIntegration.credentials) || {};
        const updatedCreds = encryptCredentials({
          ...existingCreds,
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token,
          expiryDate: tokens.expiry_date,
        });

        await prisma.userEmailIntegration.update({
          where: { userId: targetUserId },
          data: {
            credentials: updatedCreds,
            lastTestedAt: new Date(),
            testStatus: 'SUCCESS',
            errorMessage: null,
            updatedAt: new Date(),
          },
        });
      }
    } else {
      // Save tokens to IntegrationCredential (org-level)
      await credentialsManager.saveCredentials(
        organizationId,
        'GMAIL',
        {
          clientId,
          clientSecret,
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token,
          expiryDate: tokens.expiry_date,
        },
        userId, // The admin user who initiated the OAuth
        'Gmail API'
      );

      // Test the connection
      await credentialsManager.testCredentials(organizationId, 'GMAIL');
    }

    // Redirect back with success message
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  } catch (error: any) {
    console.error('Gmail callback API error:', error);

    // Try to determine redirect URL from state, fallback to customer settings
    let errorRedirect = '/customer/settings';
    try {
      const { searchParams } = new URL(req.url);
      const state = searchParams.get('state');
      if (state) {
        const stateData = verifyOAuthStateToken(state);
        if (stateData?.isUserLevel) {
          errorRedirect = '/admin/users';
        }
      }
    } catch {}

    return NextResponse.redirect(
      new URL(`${errorRedirect}?error=${encodeURIComponent(error.message)}`, req.url)
    );
  }
}
