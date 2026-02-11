/**
 * Idempotency Middleware
 * 
 * EDGE CASE #1: Duplicate request submission prevention
 * 
 * Prevents duplicate operations by caching responses based on idempotency keys.
 * Critical for order conversion where double-clicking creates duplicate orders.
 * 
 * Uses existing ioredis connection from queue/connection.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { redisConnection } from '@/lib/queue/connection';

const IDEMPOTENCY_TTL = 60 * 60 * 24; // 24 hours

export interface IdempotencyConfig {
  enabled: boolean;
  ttl?: number;
}

/**
 * Check if a request with the same idempotency key has been processed
 * Returns the cached response if found
 */
export async function checkIdempotency(
  idempotencyKey: string,
  userId: string,
  endpoint: string
): Promise<any | null> {
  const cacheKey = `idempotency:${userId}:${endpoint}:${idempotencyKey}`;
  
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      console.log('[Idempotency] Found cached response for key:', idempotencyKey);
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('[Idempotency] Error checking cache:', error);
    // On Redis error, continue with request (fail open)
    return null;
  }
}

/**
 * Store the response for this idempotency key
 */
export async function cacheResponse(
  idempotencyKey: string,
  userId: string,
  endpoint: string,
  response: any,
  ttl: number = IDEMPOTENCY_TTL
): Promise<void> {
  const cacheKey = `idempotency:${userId}:${endpoint}:${idempotencyKey}`;
  
  try {
    await redisConnection.setex(cacheKey, ttl, JSON.stringify(response));
    console.log('[Idempotency] Cached response for key:', idempotencyKey);
  } catch (error) {
    console.error('[Idempotency] Error caching response:', error);
    // Don't throw - response was already sent successfully
  }
}

/**
 * Extract idempotency key from request headers
 */
export function getIdempotencyKey(req: NextRequest): string | null {
  return req.headers.get('idempotency-key') || 
         req.headers.get('x-idempotency-key') ||
         null;
}

/**
 * Higher-order function to wrap API handlers with idempotency
 */
export function withIdempotency(
  handler: (req: NextRequest, context: any) => Promise<NextResponse>,
  config: IdempotencyConfig = { enabled: true }
) {
  return async (req: NextRequest, context: any) => {
    if (!config.enabled) {
      return handler(req, context);
    }

    // Only apply to POST/PATCH/DELETE methods
    if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      return handler(req, context);
    }

    const idempotencyKey = getIdempotencyKey(req);
    
    // If no idempotency key provided, proceed without caching
    if (!idempotencyKey) {
      return handler(req, context);
    }

    // Extract user info from context (assumes session is available)
    // This is a simplified version - in production you'd get this from getServerSession()
    const userId = (req as any).userId || 'anonymous';
    const endpoint = req.nextUrl.pathname;

    // Check for cached response
    const cachedResponse = await checkIdempotency(idempotencyKey, userId, endpoint);
    if (cachedResponse) {
      return NextResponse.json(cachedResponse, { 
        status: 200,
        headers: { 'X-Idempotency-Replay': 'true' }
      });
    }

    // Process request
    const response = await handler(req, context);

    // Cache successful responses (2xx status codes)
    if (response.status >= 200 && response.status < 300) {
      try {
        const responseData = await response.clone().json();
        await cacheResponse(
          idempotencyKey, 
          userId, 
          endpoint, 
          responseData,
          config.ttl
        );
      } catch (error) {
        console.error('[Idempotency] Error parsing response for caching:', error);
      }
    }

    return response;
  };
}

/**
 * Manual idempotency check for use inside route handlers
 * More flexible than the HOF wrapper
 */
export async function handleIdempotency(
  req: NextRequest,
  userId: string,
  handler: () => Promise<any>
): Promise<NextResponse> {
  const idempotencyKey = getIdempotencyKey(req);
  
  if (!idempotencyKey) {
    // No idempotency key - process normally
    const result = await handler();
    return NextResponse.json(result);
  }

  const endpoint = req.nextUrl.pathname;

  // Check cache
  const cachedResponse = await checkIdempotency(idempotencyKey, userId, endpoint);
  if (cachedResponse) {
    return NextResponse.json(cachedResponse, {
      headers: { 'X-Idempotency-Replay': 'true' }
    });
  }

  // Process request
  const result = await handler();

  // Cache response
  await cacheResponse(idempotencyKey, userId, endpoint, result);

  return NextResponse.json(result);
}
