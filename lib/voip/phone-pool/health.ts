import { prisma } from '@/lib/prisma';
import { PhoneNumberHealth } from '@prisma/client';
import { getPhonePoolConfig } from './config';

/** SIP codes that indicate carrier-level blocking */
const BLOCK_SIP_CODES = ['603', '607', '608'];

/**
 * Record a call outcome and update phone number health accordingly.
 * Called from the Vapi webhook handler after each call ends.
 */
export async function recordCallOutcome(
  phoneNumberRowId: string,
  data: {
    endedReason?: string | null;
    sipCode?: string | null;
    status: string;
  }
): Promise<void> {
  if (!data.sipCode || !BLOCK_SIP_CODES.includes(data.sipCode)) {
    return; // Only process block-signal SIP codes
  }

  const config = await getPhonePoolConfig();

  // Count block-signal SIP codes for this number in the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const blockSignalCount = await prisma.supplierCall.count({
    where: {
      vapiPhoneNumberRowId: phoneNumberRowId,
      sipCode: { in: BLOCK_SIP_CODES },
      startedAt: { gte: twentyFourHoursAgo },
    },
  });

  const current = await prisma.vapiPhoneNumber.findUnique({
    where: { id: phoneNumberRowId },
    select: { healthStatus: true },
  });

  if (!current || current.healthStatus === 'RETIRED') return;

  let newHealth: PhoneNumberHealth = current.healthStatus;

  if (blockSignalCount >= config.blockedThreshold) {
    newHealth = 'BLOCKED';
  } else if (blockSignalCount >= config.degradedThreshold) {
    newHealth = 'DEGRADED';
  }

  if (newHealth !== current.healthStatus) {
    await prisma.vapiPhoneNumber.update({
      where: { id: phoneNumberRowId },
      data: {
        healthStatus: newHealth,
        ...(newHealth === 'BLOCKED' && {
          blockedAt: new Date(),
          blockedReason: `SIP ${data.sipCode} received ${blockSignalCount} times in 24h`,
          isActive: false,
        }),
      },
    });
  }
}

/**
 * Manually mark a phone number as blocked (admin action).
 */
export async function markBlocked(phoneNumberRowId: string, reason: string): Promise<void> {
  await prisma.vapiPhoneNumber.update({
    where: { id: phoneNumberRowId },
    data: {
      healthStatus: 'BLOCKED',
      isActive: false,
      blockedAt: new Date(),
      blockedReason: reason,
    },
  });
}

/**
 * Compute rolling answer rate for a phone number over the last N calls.
 * Returns a value between 0 and 1.
 */
export async function computeAnswerRate(
  phoneNumberRowId: string,
  windowSize: number = 20
): Promise<number> {
  const recentCalls = await prisma.supplierCall.findMany({
    where: {
      vapiPhoneNumberRowId: phoneNumberRowId,
      status: { notIn: ['INITIATED', 'CANCELLED'] },
    },
    orderBy: { startedAt: 'desc' },
    take: windowSize,
    select: { status: true },
  });

  if (recentCalls.length === 0) return 1; // No data = assume healthy

  const answered = recentCalls.filter(
    (c) => c.status === 'ANSWERED' || c.status === 'IN_PROGRESS' || c.status === 'COMPLETED'
  ).length;

  return answered / recentCalls.length;
}

/**
 * Compute answer rate baseline (30-day average) for comparison.
 */
export async function computeBaselineAnswerRate(
  phoneNumberRowId: string
): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const calls = await prisma.supplierCall.findMany({
    where: {
      vapiPhoneNumberRowId: phoneNumberRowId,
      startedAt: { gte: thirtyDaysAgo },
      status: { notIn: ['INITIATED', 'CANCELLED'] },
    },
    select: { status: true },
  });

  if (calls.length === 0) return 1;

  const answered = calls.filter(
    (c) => c.status === 'ANSWERED' || c.status === 'IN_PROGRESS' || c.status === 'COMPLETED'
  ).length;

  return answered / calls.length;
}

/**
 * Run health evaluation for all active numbers.
 * Called by the nightly health worker.
 */
export async function evaluateAllNumberHealth(): Promise<{
  healthy: number;
  degraded: number;
  blocked: number;
}> {
  const activeNumbers = await prisma.vapiPhoneNumber.findMany({
    where: {
      healthStatus: { in: ['HEALTHY', 'DEGRADED'] },
      isActive: true,
    },
    select: { id: true, healthStatus: true },
  });

  let healthy = 0;
  let degraded = 0;
  let blocked = 0;

  for (const number of activeNumbers) {
    const currentRate = await computeAnswerRate(number.id);
    const baselineRate = await computeBaselineAnswerRate(number.id);

    // If answer rate dropped >50% vs baseline, flag as degraded
    if (baselineRate > 0 && currentRate < baselineRate * 0.5) {
      if (number.healthStatus === 'HEALTHY') {
        await prisma.vapiPhoneNumber.update({
          where: { id: number.id },
          data: { healthStatus: 'DEGRADED' },
        });
        degraded++;
        continue;
      }
    }

    if (number.healthStatus === 'HEALTHY') healthy++;
    else degraded++;
  }

  blocked = await prisma.vapiPhoneNumber.count({
    where: { healthStatus: 'BLOCKED' },
  });

  return { healthy, degraded, blocked };
}

/**
 * Sync Vapi-reported status for all active pool numbers.
 * Vapi can mark numbers as "blocked" independently.
 */
export async function syncVapiStatuses(vapiApiKey: string): Promise<void> {
  const numbers = await prisma.vapiPhoneNumber.findMany({
    where: { isActive: true },
    select: { id: true, vapiPhoneNumberId: true, vapiStatus: true },
  });

  for (const number of numbers) {
    try {
      const response = await fetch(`https://api.vapi.ai/phone-number/${number.vapiPhoneNumberId}`, {
        headers: { Authorization: `Bearer ${vapiApiKey}` },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const vapiStatus = data.status as string | undefined;

      if (vapiStatus && vapiStatus !== number.vapiStatus) {
        await prisma.vapiPhoneNumber.update({
          where: { id: number.id },
          data: {
            vapiStatus,
            ...(vapiStatus === 'blocked' && {
              healthStatus: 'BLOCKED',
              isActive: false,
              blockedAt: new Date(),
              blockedReason: 'Vapi reported number as blocked',
            }),
          },
        });
      }
    } catch {
      // Non-critical — continue to next number
    }
  }
}
