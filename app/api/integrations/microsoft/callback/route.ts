import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptCredentials, encryptCredentials } from '@/lib/services/credentials/encryption';
import crypto from 'crypto';

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

// GET /api/integrations/microsoft/callback - Handle Microsoft OAuth callback
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Verify CSRF-protected state token first to determine redirect URL
    const stateData = state ? verifyOAuthStateToken(state) : null;
    const isUserLevel = stateData?.isUserLevel;
    const errorRedirectBase = '/admin/users';

    if (error) {
      console.error('Microsoft OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${encodeURIComponent(error)}`, req.url)
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

    const { targetUserId } = stateData;

    if (!isUserLevel || !targetUserId) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=invalid_request`, req.url)
      );
    }

    // Get user's email integration to retrieve client credentials
    const emailIntegration = await prisma.userEmailIntegration.findUnique({
      where: { userId: targetUserId },
    });

    if (!emailIntegration) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=missing_config`, req.url)
      );
    }

    const credentials = decryptCredentials<{
      clientId: string;
      clientSecret: string;
      tenantId?: string;
    }>(emailIntegration.credentials);

    if (!credentials?.clientId || !credentials?.clientSecret) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=missing_credentials`, req.url)
      );
    }

    const tenantId = credentials.tenantId || 'common';
    const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL}/api/integrations/microsoft/callback`;

    // Exchange authorization code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: [
          'offline_access',
          'https://graph.microsoft.com/Mail.Read',
          'https://graph.microsoft.com/Mail.Send',
          'https://graph.microsoft.com/Mail.ReadWrite',
          'https://graph.microsoft.com/User.Read',
        ].join(' '),
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Microsoft token exchange error:', errorData);
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=${encodeURIComponent(errorData.error || 'token_exchange_failed')}`, req.url)
      );
    }

    const tokens = await tokenResponse.json();

    if (!tokens.refresh_token || !tokens.access_token) {
      return NextResponse.redirect(
        new URL(`${errorRedirectBase}?error=no_tokens`, req.url)
      );
    }

    // Save tokens to UserEmailIntegration
    const existingCreds = decryptCredentials<any>(emailIntegration.credentials) || {};
    const updatedCreds = encryptCredentials({
      ...existingCreds,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      expiryDate: Date.now() + (tokens.expires_in * 1000),
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

    // Redirect back with success message
    return NextResponse.redirect(
      new URL('/admin/users?success=microsoft_authorized', req.url)
    );
  } catch (error: any) {
    console.error('Microsoft callback API error:', error);

    return NextResponse.redirect(
      new URL(`/admin/users?error=${encodeURIComponent(error.message)}`, req.url)
    );
  }
}
