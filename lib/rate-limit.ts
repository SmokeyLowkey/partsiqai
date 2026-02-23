import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

/**
 * Distributed rate limiter backed by Redis (INCR + EXPIRE).
 * Falls back to in-memory Map if Redis is unavailable (fail-open).
 */

// ─── Redis client (lazy singleton) ──────────────────────────────────

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

    redis.on('error', (err) => {
      console.warn('[RateLimit] Redis error:', err.message);
    });

    redis.connect().catch(() => {
      console.warn('[RateLimit] Redis connection failed, using in-memory fallback');
      redis = null;
      redisUnavailable = true;
    });

    return redis;
  } catch {
    redisUnavailable = true;
    return null;
  }
}

// ─── In-memory fallback ─────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

function checkInMemory(
  identifier: string,
  config: RateLimitConfig
): { success: true } | { success: false; response: NextResponse } {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { success: true };
  }

  if (entry.count >= config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      ),
    };
  }

  entry.count++;
  return { success: true };
}

// ─── Public API ─────────────────────────────────────────────────────

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

/**
 * Check rate limit for a given identifier.
 * Uses Redis INCR+EXPIRE for distributed limiting. Falls back to in-memory if Redis is unavailable.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<{ success: true } | { success: false; response: NextResponse }> {
  const client = getRedis();

  if (!client) {
    return checkInMemory(identifier, config);
  }

  try {
    const key = `rl:${identifier}`;
    const count = await client.incr(key);

    // Set expiry on first request in the window
    if (count === 1) {
      await client.expire(key, config.windowSeconds);
    }

    if (count > config.limit) {
      const ttl = await client.ttl(key);
      const retryAfter = ttl > 0 ? ttl : config.windowSeconds;
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: { 'Retry-After': String(retryAfter) },
          }
        ),
      };
    }

    return { success: true };
  } catch (error: any) {
    // Fail open — don't block requests if Redis is down
    console.warn('[RateLimit] Redis check failed, allowing request:', error.message);
    return { success: true };
  }
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// Pre-configured rate limiters
export const rateLimits = {
  /** Login: 5 attempts per minute */
  login: { limit: 5, windowSeconds: 60 },
  /** Signup: 3 attempts per 15 minutes */
  signup: { limit: 3, windowSeconds: 900 },
  /** Password reset / verification: 5 attempts per 15 minutes */
  authAction: { limit: 5, windowSeconds: 900 },
  /** General API: 100 requests per minute */
  api: { limit: 100, windowSeconds: 60 },
  /** Cron: 2 per minute (prevent hammering) */
  cron: { limit: 2, windowSeconds: 60 },
  /** Chat: 20 messages per minute per user */
  chat: { limit: 20, windowSeconds: 60 },
  /** Invitations: 10 per hour per user */
  invitation: { limit: 10, windowSeconds: 3600 },
} as const;
