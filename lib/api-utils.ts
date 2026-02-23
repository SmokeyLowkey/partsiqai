import { NextResponse } from 'next/server';

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
