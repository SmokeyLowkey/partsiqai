import { prisma } from '@/lib/prisma';
import { getPhonePoolConfig } from './config';

export interface SelectedNumber {
  id: string;
  vapiPhoneNumberId: string;
  e164: string;
  areaCode: string | null;
}

/**
 * Select the best phone number from the pool for an outbound call.
 * Uses LRU (least recently used) strategy with daily cap enforcement.
 * Prefers area-code match to supplier when available.
 */
export async function selectNumber(options?: {
  preferredAreaCode?: string;
}): Promise<SelectedNumber> {
  const config = await getPhonePoolConfig();

  // Reset daily counts for numbers whose reset window has passed (midnight)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.vapiPhoneNumber.updateMany({
    where: {
      dailyCallCountResetAt: { lt: today },
      dailyCallCount: { gt: 0 },
    },
    data: {
      dailyCallCount: 0,
      dailyCallCountResetAt: today,
    },
  });

  // Try area-code-matched number first
  if (options?.preferredAreaCode) {
    const matched = await prisma.vapiPhoneNumber.findFirst({
      where: {
        isActive: true,
        healthStatus: { in: ['HEALTHY', 'DEGRADED'] },
        dailyCallCount: { lt: config.dailyCap },
        areaCode: options.preferredAreaCode,
      },
      orderBy: { lastUsedAt: 'asc' },
      select: { id: true, vapiPhoneNumberId: true, e164: true, areaCode: true },
    });

    if (matched) {
      return matched;
    }
  }

  // Fall back to any available number (LRU)
  const number = await prisma.vapiPhoneNumber.findFirst({
    where: {
      isActive: true,
      healthStatus: { in: ['HEALTHY', 'DEGRADED'] },
      dailyCallCount: { lt: config.dailyCap },
    },
    orderBy: { lastUsedAt: 'asc' },
    select: { id: true, vapiPhoneNumberId: true, e164: true, areaCode: true },
  });

  if (!number) {
    throw new Error(
      'PHONE_POOL_EXHAUSTED: No available phone numbers in pool. All numbers are either blocked, at daily cap, or inactive.'
    );
  }

  return number;
}

/**
 * Mark a phone number as used after a call is initiated.
 * Increments daily count and updates lastUsedAt timestamp.
 */
export async function markNumberUsed(phoneNumberId: string): Promise<void> {
  await prisma.vapiPhoneNumber.update({
    where: { id: phoneNumberId },
    data: {
      dailyCallCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Check if a supplier has already been called today (across all numbers).
 * Enforces per-supplier daily call frequency cap.
 */
export async function hasSupplierBeenCalledToday(supplierId: string): Promise<boolean> {
  const config = await getPhonePoolConfig();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const callCount = await prisma.supplierCall.count({
    where: {
      supplierId,
      startedAt: { gte: today },
      status: { notIn: ['FAILED', 'CANCELLED'] },
    },
  });

  return callCount >= config.supplierDailyCallLimit;
}
