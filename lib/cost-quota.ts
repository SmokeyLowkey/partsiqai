import Redis from 'ioredis';

/**
 * Per-org daily cost quota on expensive external APIs. Every paid call does:
 *
 *     await assertQuota({ provider, organizationId, cost })
 *
 * before hitting the upstream. A compromised session or runaway worker can
 * burn through `LIMIT` "units" per day and then fail-closed for the rest of
 * the day. The real defense against cost DoS.
 *
 * Storage: Redis key `quota:${provider}:${orgId}:${YYYY-MM-DD}` (UTC day).
 *   - INCRBY cost  → atomic debit
 *   - EXPIRE 48h   → self-cleanup after bucket rolls over
 *   - If post-INCR total > LIMIT, we refund the debit and throw.
 *
 * Fail-open when Redis is down — matches the `lib/rate-limit.ts` pattern
 * (better to let a few requests through than to lock the whole org out
 * when Upstash is flapping). The signature of the failure mode is that
 * rate-limit.ts also fails open, so the two composed give us at-least
 * some protection at all times.
 */

let redis: Redis | null = null;
let redisUnavailable = false;

function getRedis(): Redis | null {
  if (redisUnavailable) return null;
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) {
    redisUnavailable = true;
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 2000,
      family: 0,
      tls: {},
    });
    redis.on('error', (err) => console.warn('[CostQuota] Redis error:', err.message));
    redis.connect().catch(() => {
      redis = null;
      redisUnavailable = true;
    });
    return redis;
  } catch {
    redisUnavailable = true;
    return null;
  }
}

export type QuotaProvider = 'openrouter' | 'vapi' | 'resend';

/**
 * Daily cost ceilings per org. Units are provider-specific:
 *   - openrouter: LLM tokens (1 unit = 1 token). 1M/day ≈ $30 at GPT-4o rates.
 *   - vapi:       minutes of call time (1 unit = 1 minute). 300 min/day ≈ $27.
 *   - resend:     outbound emails (1 unit = 1 email). 1000/day is a lot of email.
 *
 * Defaults are generous to avoid false positives on legitimate heavy users;
 * the goal here is to catch *runaway* spend, not to enforce business-tier
 * quotas (those live in `lib/subscription-limits.ts`).
 *
 * Overrides via env: COST_QUOTA_<PROVIDER>_DAILY (e.g. COST_QUOTA_OPENROUTER_DAILY=2000000).
 */
const DEFAULT_DAILY_LIMITS: Record<QuotaProvider, number> = {
  openrouter: 1_000_000, // tokens
  vapi: 300,             // minutes
  resend: 1_000,         // emails
};

function limitFor(provider: QuotaProvider): number {
  const override = process.env[`COST_QUOTA_${provider.toUpperCase()}_DAILY`];
  if (override) {
    const n = parseInt(override, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_DAILY_LIMITS[provider];
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export class QuotaExhaustedError extends Error {
  readonly provider: QuotaProvider;
  readonly organizationId: string;
  readonly limit: number;
  readonly attempted: number;
  constructor(provider: QuotaProvider, organizationId: string, limit: number, attempted: number) {
    super(
      `Daily cost quota exhausted for provider=${provider} org=${organizationId} ` +
        `(limit=${limit}, attempted=${attempted}). Contact support to raise the cap.`
    );
    this.name = 'QuotaExhaustedError';
    this.provider = provider;
    this.organizationId = organizationId;
    this.limit = limit;
    this.attempted = attempted;
  }
}

export interface AssertQuotaOptions {
  provider: QuotaProvider;
  organizationId: string;
  /** Cost to debit. For LLMs, estimate tokens; for Vapi, estimate minutes. */
  cost: number;
  /**
   * When true, overshoot is allowed once (bucket goes negative but we don't
   * throw). Useful for callers that need to complete a single in-flight
   * operation whose cost can't be known precisely until after the call.
   */
  allowSoftOvershoot?: boolean;
}

/**
 * Debit `cost` against the org's daily budget for this provider. Throws
 * `QuotaExhaustedError` if the debit would push past the limit. On Redis
 * failure, logs and returns (fail-open).
 */
export async function assertQuota(opts: AssertQuotaOptions): Promise<void> {
  if (opts.cost <= 0) return;

  const client = getRedis();
  if (!client) return; // fail-open when Redis is unreachable

  const limit = limitFor(opts.provider);
  const key = `quota:${opts.provider}:${opts.organizationId}:${todayUtc()}`;

  try {
    const after = await client.incrby(key, opts.cost);
    if (after === opts.cost) {
      // First increment today — set TTL so the bucket auto-resets tomorrow.
      await client.expire(key, 48 * 3600);
    }
    if (after > limit && !opts.allowSoftOvershoot) {
      // Refund the debit so we don't permanently block after an overshoot spike.
      await client.decrby(key, opts.cost).catch(() => undefined);
      throw new QuotaExhaustedError(opts.provider, opts.organizationId, limit, after);
    }
  } catch (err) {
    if (err instanceof QuotaExhaustedError) throw err;
    console.warn('[CostQuota] Redis failure, allowing request:', (err as Error)?.message);
  }
}

/** Snapshot of an org's current usage. Useful for an admin dashboard tile. */
export async function getQuotaUsage(
  provider: QuotaProvider,
  organizationId: string
): Promise<{ used: number; limit: number; remaining: number; pctUsed: number }> {
  const client = getRedis();
  const limit = limitFor(provider);
  if (!client) return { used: 0, limit, remaining: limit, pctUsed: 0 };

  const key = `quota:${provider}:${organizationId}:${todayUtc()}`;
  try {
    const raw = await client.get(key);
    const used = raw ? parseInt(raw, 10) : 0;
    const remaining = Math.max(0, limit - used);
    const pctUsed = limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
    return { used, limit, remaining, pctUsed };
  } catch {
    return { used: 0, limit, remaining: limit, pctUsed: 0 };
  }
}
