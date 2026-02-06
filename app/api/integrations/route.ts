import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';
import { z } from 'zod';

const credentialsManager = new CredentialsManager();

const IntegrationCredentialSchema = z.object({
  integrationType: z.enum(['OPENROUTER', 'GMAIL', 'PINECONE', 'NEO4J', 'REDIS', 'SMTP']),
  credentials: z.any(),
  config: z.any().optional(),
  name: z.string().optional(),
});

// GET /api/integrations - List all integrations for the organization
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integrations = await credentialsManager.listCredentials(
      session.user.organizationId
    );

    // Don't send actual credentials to frontend, just metadata
    const sanitizedIntegrations = integrations.map((int) => ({
      id: int.id,
      integrationType: int.integrationType,
      name: int.name,
      isActive: int.isActive,
      lastUsedAt: int.lastUsedAt,
      lastTestedAt: int.lastTestedAt,
      testStatus: int.testStatus,
      errorMessage: int.errorMessage,
      createdAt: int.createdAt,
      updatedAt: int.updatedAt,
      hasCredentials: true,
    }));

    return NextResponse.json({ integrations: sanitizedIntegrations });
  } catch (error: any) {
    console.error('Get integrations API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch integrations',
      },
      { status: 500 }
    );
  }
}

// POST /api/integrations - Create or update integration credentials
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can configure organization-level integrations
    const allowedRoles = ['ADMIN', 'MASTER_ADMIN'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Only administrators can configure integrations' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Validate request body
    const validationResult = IntegrationCredentialSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { integrationType, credentials, config, name } = validationResult.data;

    // Save credentials (will upsert)
    await credentialsManager.saveCredentials(
      session.user.organizationId,
      integrationType,
      credentials,
      session.user.id,
      name,
      config
    );

    // Test the credentials
    const testResult = await credentialsManager.testCredentials(
      session.user.organizationId,
      integrationType
    );

    return NextResponse.json({
      success: true,
      message: 'Integration credentials saved successfully',
      testResult,
    });
  } catch (error: any) {
    console.error('Save integration API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to save integration credentials',
      },
      { status: 500 }
    );
  }
}
