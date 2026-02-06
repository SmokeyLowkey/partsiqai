import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decryptCredentials } from '@/lib/services/credentials/encryption';
import crypto from 'crypto';

interface OAuthStatePayload {
  organizationId: string;
  userId: string;
  csrfToken: string;
  isUserLevel?: boolean;
  targetUserId?: string;
}

function generateOAuthStateToken(payload: OAuthStatePayload): string {
  const payloadStr = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET!).update(payloadStr).digest('hex');
  return Buffer.from(JSON.stringify({ payload: payloadStr, hmac })).toString('base64url');
}

// GET /api/integrations/microsoft/authorize - Initiate Microsoft OAuth flow
// Supports user-level OAuth with ?userId=xxx parameter
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    let clientId: string;
    let tenantId: string = 'common';
    let isUserLevel = false;

    if (targetUserId) {
      // User-level OAuth: read credentials from UserEmailIntegration
      // Only admins can authorize on behalf of users
      if (!['MASTER_ADMIN', 'ADMIN'].includes(session.user.role)) {
        return NextResponse.json(
          { error: 'Unauthorized - Admin access required' },
          { status: 403 }
        );
      }

      const emailIntegration = await prisma.userEmailIntegration.findUnique({
        where: { userId: targetUserId },
        include: {
          user: { select: { organizationId: true } }
        }
      });

      if (!emailIntegration) {
        return NextResponse.json(
          { error: 'Email integration not found. Please save credentials first.' },
          { status: 404 }
        );
      }

      // Verify admin has access to this user's organization
      if (session.user.role !== 'MASTER_ADMIN' &&
          emailIntegration.user.organizationId !== session.user.organizationId) {
        return NextResponse.json(
          { error: 'Cannot authorize users from other organizations' },
          { status: 403 }
        );
      }

      if (emailIntegration.providerType !== 'MICROSOFT_OAUTH') {
        return NextResponse.json(
          { error: 'This user is not configured for Microsoft OAuth' },
          { status: 400 }
        );
      }

      const credentials = decryptCredentials<{
        clientId: string;
        clientSecret: string;
        tenantId?: string;
      }>(emailIntegration.credentials);

      if (!credentials?.clientId || !credentials?.clientSecret) {
        return NextResponse.json(
          { error: 'Microsoft OAuth credentials not properly configured' },
          { status: 400 }
        );
      }

      clientId = credentials.clientId;
      tenantId = credentials.tenantId || 'common';
      isUserLevel = true;
    } else {
      return NextResponse.json(
        { error: 'userId parameter is required for Microsoft OAuth' },
        { status: 400 }
      );
    }

    // Generate CSRF-protected state token
    const statePayload: OAuthStatePayload = {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      csrfToken: crypto.randomBytes(32).toString('hex'),
      isUserLevel,
      targetUserId: targetUserId || undefined,
    };
    const state = generateOAuthStateToken(statePayload);

    // Microsoft OAuth 2.0 authorization endpoint
    const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL}/api/integrations/microsoft/callback`;

    // Build authorization URL
    // Using Microsoft identity platform v2.0
    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('scope', [
      'offline_access',
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/User.Read',
    ].join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token

    // Redirect to Microsoft's OAuth consent screen
    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('Microsoft authorize API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth flow',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
