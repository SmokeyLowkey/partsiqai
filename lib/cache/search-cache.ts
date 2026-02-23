import { createHash } from 'crypto';
import Redis from 'ioredis';
import { apiLogger } from '@/lib/logger';

const log = apiLogger.child({ service: 'search-cache' });

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_PREFIX = 'search:';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  if (!url) {
    log.warn('UPSTASH_REDIS_REST_URL not set, caching disabled');
    return null;
  }

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 3000,
      family: 0,
      tls: {},
    });

    redis.on('error', (err) => {
      log.warn({ err: err.message }, 'Redis error');
    });

    redis.connect().catch(() => {
      log.warn('Redis connection failed, caching disabled');
      redis = null;
    });

    return redis;
  } catch {
    return null;
  }
}

/**
 * Build a deterministic cache key from search parameters.
 */
function buildCacheKey(
  query: string,
  organizationId: string,
  vehicleId?: string
): string {
  const raw = `${query.toLowerCase().trim()}|${organizationId}|${vehicleId || ''}`;
  const hash = createHash('md5').update(raw).digest('hex');
  return `${CACHE_PREFIX}${hash}`;
}

/**
 * Get cached search results. Returns null on miss or error.
 */
export async function getCachedSearch<T>(
  query: string,
  organizationId: string,
  vehicleId?: string
): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const key = buildCacheKey(query, organizationId, vehicleId);
    const cached = await client.get(key);
    if (!cached) return null;

    log.info({ key: key.slice(0, 20) }, 'Cache HIT');
    return JSON.parse(cached) as T;
  } catch (error: any) {
    log.warn({ err: error.message }, 'Cache GET failed');
    return null;
  }
}

/**
 * Cache search results with TTL.
 */
export async function setCachedSearch<T>(
  query: string,
  organizationId: string,
  vehicleId: string | undefined,
  data: T
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    const key = buildCacheKey(query, organizationId, vehicleId);
    await client.setex(key, CACHE_TTL_SECONDS, JSON.stringify(data));
    log.info({ key: key.slice(0, 20) }, 'Cache SET');
  } catch (error: any) {
    log.warn({ err: error.message }, 'Cache SET failed');
  }
}

/**
 * Ping Redis to check connectivity. Returns true if reachable.
 */
export async function pingRedis(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Invalidate all search cache entries for an organization.
 * Call this after data ingestion completes.
 */
export async function invalidateSearchCache(organizationId: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    // Scan for matching keys and delete them
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        `${CACHE_PREFIX}*`,
        'COUNT',
        100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        // We can't filter by org from the hash key, so we delete all search cache.
        // This is acceptable since: 5min TTL means stale entries expire quickly,
        // and ingestion is infrequent.
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    log.info({ deletedCount }, 'Invalidated cache entries');
  } catch (error: any) {
    log.warn({ err: error.message }, 'Cache invalidation failed');
  }
}
