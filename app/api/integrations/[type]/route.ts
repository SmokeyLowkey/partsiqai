import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';

const credentialsManager = new CredentialsManager();

// GET /api/integrations/[type] - Get specific integration status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await params;
    const integrationType = type.toUpperCase() as any;

    const hasCredentials = await credentialsManager.hasCredentials(
      session.user.organizationId,
      integrationType
    );

    if (!hasCredentials) {
      return NextResponse.json({
        hasCredentials: false,
        integrationType,
      });
    }

    // Get metadata only (no credentials)
    const integrations = await credentialsManager.listCredentials(
      session.user.organizationId
    );

    const integration = integrations.find(
      (int) => int.integrationType === integrationType
    );

    if (!integration) {
      return NextResponse.json({
        hasCredentials: false,
        integrationType,
      });
    }

    return NextResponse.json({
      hasCredentials: true,
      integrationType: integration.integrationType,
      name: integration.name,
      isActive: integration.isActive,
      lastUsedAt: integration.lastUsedAt,
      lastTestedAt: integration.lastTestedAt,
      testStatus: integration.testStatus,
      errorMessage: integration.errorMessage,
    });
  } catch (error: any) {
    console.error('Get integration API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch integration',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/[type] - Delete integration credentials
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await params;
    const integrationType = type.toUpperCase() as any;

    await credentialsManager.deleteCredentials(
      session.user.organizationId,
      integrationType
    );

    return NextResponse.json({
      success: true,
      message: 'Integration credentials deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete integration API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete integration credentials',
      },
      { status: 500 }
    );
  }
}
