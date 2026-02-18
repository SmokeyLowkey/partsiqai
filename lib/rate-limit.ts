import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple in-memory sliding window rate limiter.
 * For production with multiple instances, consider @upstash/ratelimit
 * which uses Redis for distributed rate limiting.
 */

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

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

/**
 * Check rate limit for a given identifier.
 * Returns { success: true } if under limit, or { success: false, response } with a 429 response.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { success: true } | { success: false; response: NextResponse } {
  const now = Date.now();
  const key = identifier;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
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
} as const;
