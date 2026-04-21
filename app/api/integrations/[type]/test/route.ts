import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';
import { withHardening } from '@/lib/api/with-hardening';

const credentialsManager = new CredentialsManager();

// POST /api/integrations/[type]/test - Test integration credentials.
// Issues real API calls to external services — tight rate limit.
export const POST = withHardening(
  {
    roles: ['ADMIN', 'MASTER_ADMIN'],
    rateLimit: { limit: 20, windowSeconds: 60, prefix: 'integrations-test', keyBy: 'org' },
  },
  async (req: Request, { params }: { params: Promise<{ type: string }> }) => {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await params;
    const integrationType = type.toUpperCase() as any;

    const result = await credentialsManager.testCredentials(
      session.user.organizationId,
      integrationType
    );

    return NextResponse.json({
      success: result,
      message: result
        ? 'Integration test successful'
        : 'Integration test failed',
    });
  } catch (error: any) {
    console.error('Test integration API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test integration',
      },
      { status: 500 }
    );
  }
  }
);
