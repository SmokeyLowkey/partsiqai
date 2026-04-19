import { redisConnection } from '@/lib/queue/connection';

const RATE_LIMIT_WINDOW_SEC = 3600; // 1 hour

function rateLimitKey(callerPhone: string): string {
  return `receptionist:ratelimit:${callerPhone}`;
}

/**
 * Check and increment caller's rate limit counter.
 * Returns true if the call should be allowed, false if rate limit exceeded.
 */
export async function checkAndIncrementRateLimit(
  callerPhone: string,
  limit: number
): Promise<{ allowed: boolean; count: number }> {
  const client = redisConnection;
  if (!client) {
    // No Redis — allow but warn
    return { allowed: true, count: 0 };
  }

  const key = rateLimitKey(callerPhone);
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, RATE_LIMIT_WINDOW_SEC);
  }

  return { allowed: count <= limit, count };
}

/**
 * Check if a caller phone is on the spam blocklist (normalized comparison).
 */
export function isSpamBlocked(callerPhone: string, blocklist: string[]): boolean {
  const normalized = callerPhone.replace(/\D/g, '').slice(-10);
  return blocklist.some((blocked) => blocked.replace(/\D/g, '').slice(-10) === normalized);
}
