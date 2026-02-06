import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { google } from 'googleapis';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';
import { prisma } from '@/lib/prisma';
import { decryptCredentials } from '@/lib/services/credentials/encryption';
import crypto from 'crypto';

const credentialsManager = new CredentialsManager();

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

// GET /api/integrations/gmail/authorize - Initiate Gmail OAuth flow
// Supports both org-level and user-level OAuth:
// - No userId param: org-level OAuth (reads from IntegrationCredential)
// - With userId param: user-level OAuth (reads from UserEmailIntegration)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    let clientId: string;
    let clientSecret: string;
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

      if (emailIntegration.providerType !== 'GMAIL_OAUTH') {
        return NextResponse.json(
          { error: 'This user is not configured for Gmail OAuth' },
          { status: 400 }
        );
      }

      const credentials = decryptCredentials<{ clientId: string; clientSecret: string }>(
        emailIntegration.credentials
      );

      if (!credentials?.clientId || !credentials?.clientSecret) {
        return NextResponse.json(
          { error: 'Gmail OAuth credentials not properly configured' },
          { status: 400 }
        );
      }

      clientId = credentials.clientId;
      clientSecret = credentials.clientSecret;
      isUserLevel = true;
    } else {
      // Org-level OAuth: read credentials from IntegrationCredential
      const gmailCreds = await credentialsManager.getCredentials<{
        clientId: string;
        clientSecret: string;
      }>(session.user.organizationId, 'GMAIL');

      if (!gmailCreds) {
        return NextResponse.json(
          {
            error: 'Gmail OAuth credentials not configured',
            message: 'Please configure Gmail client ID and secret first',
          },
          { status: 400 }
        );
      }

      clientId = gmailCreds.clientId;
      clientSecret = gmailCreds.clientSecret;
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GMAIL_OAUTH_REDIRECT_URI
    );

    // Generate CSRF-protected state token
    const statePayload: OAuthStatePayload = {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      csrfToken: crypto.randomBytes(32).toString('hex'),
      isUserLevel,
      targetUserId: targetUserId || undefined,
    };
    const state = generateOAuthStateToken(statePayload);

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force consent to ensure we get refresh token
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });

    // Redirect to Google's OAuth consent screen
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('Gmail authorize API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth flow',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
