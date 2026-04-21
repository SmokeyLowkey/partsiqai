import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cronLogger } from '@/lib/logger';
import { evaluateAllNumberHealth, syncVapiStatuses } from '@/lib/voip/phone-pool/health';
import { getPhonePoolConfig } from '@/lib/voip/phone-pool/config';
import { CredentialsManager } from '@/lib/services/credentials/credentials-manager';
import { verifyCronAuth } from '@/lib/api-utils';

/**
 * Cron Job: Phone Pool Health Check
 *
 * Runs nightly to:
 * 1. Reset daily call counts
 * 2. Evaluate health (answer-rate degradation)
 * 3. Sync Vapi-reported statuses
 * 4. Alert if pool is below minimum size
 *
 * Schedule: Daily at midnight
 *
 * Setup with Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/phone-pool-health",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security (timing-safe)
    if (!verifyCronAuth(req.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    cronLogger.info('Phone pool health check triggered');

    const config = await getPhonePoolConfig();

    // Step 1: Reset daily call counts
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const resetResult = await prisma.vapiPhoneNumber.updateMany({
      where: {
        dailyCallCount: { gt: 0 },
      },
      data: {
        dailyCallCount: 0,
        dailyCallCountResetAt: today,
      },
    });

    cronLogger.info({ resetCount: resetResult.count }, 'Daily call counts reset');

    // Step 2: Sync Vapi-reported statuses
    try {
      const credentialsManager = new CredentialsManager();
      const vapiCreds = await credentialsManager.getCredentialsWithFallback<{ apiKey: string }>(
        'system-platform-credentials',
        'VAPI'
      );
      if (vapiCreds?.apiKey) {
        await syncVapiStatuses(vapiCreds.apiKey);
        cronLogger.info('Vapi statuses synced');
      }
    } catch (syncError) {
      cronLogger.warn({ error: syncError }, 'Failed to sync Vapi statuses (non-critical)');
    }

    // Step 3: Evaluate rolling health (answer-rate degradation)
    const healthResult = await evaluateAllNumberHealth();
    cronLogger.info(healthResult, 'Health evaluation complete');

    // Step 4: Check pool size and alert if below minimum
    const healthyCount = await prisma.vapiPhoneNumber.count({
      where: { isActive: true, healthStatus: 'HEALTHY' },
    });

    const totalActive = await prisma.vapiPhoneNumber.count({
      where: { isActive: true },
    });

    let alertMessage: string | null = null;
    if (healthyCount < config.minPoolSize) {
      alertMessage = `Phone pool below minimum: ${healthyCount} healthy numbers (minimum: ${config.minPoolSize}). Total active: ${totalActive}. Provision new numbers in Admin Settings.`;
      cronLogger.warn({ healthyCount, minPoolSize: config.minPoolSize, totalActive }, alertMessage);

      // Store alert in SystemSetting for admin dashboard visibility
      await prisma.systemSetting.upsert({
        where: { key: 'PHONE_POOL_ALERT' },
        update: {
          value: alertMessage,
          updatedAt: new Date(),
        },
        create: {
          key: 'PHONE_POOL_ALERT',
          value: alertMessage,
          category: 'VOIP',
          description: 'Auto-generated alert when phone pool is below minimum size',
        },
      });
    } else {
      // Clear any existing alert
      await prisma.systemSetting.deleteMany({
        where: { key: 'PHONE_POOL_ALERT' },
      });
    }

    return NextResponse.json({
      success: true,
      dailyCountsReset: resetResult.count,
      health: healthResult,
      healthyCount,
      totalActive,
      minPoolSize: config.minPoolSize,
      alert: alertMessage,
    });
  } catch (error: any) {
    cronLogger.error({ error: error.message }, 'Phone pool health check failed');
    return NextResponse.json(
      { error: 'Phone pool health check failed', details: error.message },
      { status: 500 }
    );
  }
}
