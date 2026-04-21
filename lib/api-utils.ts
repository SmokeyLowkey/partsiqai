import { NextResponse } from 'next/server';
import crypto from 'crypto';

interface ApiErrorOptions {
  code?: string;
  details?: unknown;
}

/**
 * Standardized API error response.
 * Returns consistent shape: { error, code?, timestamp, details? }
 */
export function apiError(
  message: string,
  status: number,
  options?: ApiErrorOptions
): NextResponse {
  const body: Record<string, unknown> = {
    error: message,
    timestamp: new Date().toISOString(),
  };

  if (options?.code) body.code = options.code;
  if (options?.details !== undefined) body.details = options.details;

  return NextResponse.json(body, { status });
}

// SHA-256 hashes both sides to a fixed 32 bytes so length-based timing leaks and
// length mismatches collapse to a single constant-time comparison.
export function timingSafeStringEqual(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!expected) return false;
  const providedHash = crypto.createHash('sha256').update(provided ?? '').digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

export function verifyCronAuth(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`);
}

// Rejects webhooks with timestamps outside a ±toleranceSec window to stop replay attacks.
// timestampSec: Unix seconds (string or number). Returns true if the timestamp is fresh.
export function isWebhookTimestampFresh(
  timestampSec: string | number | null | undefined,
  toleranceSec = 300
): boolean {
  if (timestampSec === null || timestampSec === undefined || timestampSec === '') return false;
  const ts = typeof timestampSec === 'string' ? parseInt(timestampSec, 10) : timestampSec;
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.abs(nowSec - ts) <= toleranceSec;
}
