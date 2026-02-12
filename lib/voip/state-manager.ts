import Redis from 'ioredis';
import { CallState } from './types';
import { workerLogger } from '@/lib/logger';

const logger = workerLogger.child({ module: 'voip-state-manager' });

let redis: Redis | null = null;

// In-memory fallback for development (NOT for production!)
const inMemoryStore = new Map<string, { state: CallState; expires: number }>();

function getRedisClient() {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL) {
    logger.info('Initializing Redis connection for VOIP state management');
    redis = new Redis(process.env.UPSTASH_REDIS_REST_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false, // Connect immediately
      family: 0, // Use IPv4 and IPv6
      tls: {
        // Ensure TLS is enabled for rediss:// protocol
      },
    });

    redis.on('connect', () => {
      logger.info('VOIP state manager connected to Redis');
    });

    redis.on('error', (err) => {
      logger.error({ err: err.message }, 'VOIP state manager Redis connection error');
    });
  }
  return redis;
}

/**
 * Save call state to Redis with 1 hour TTL
 * Falls back to in-memory storage if Redis is not configured
 */
export async function saveCallState(
  callId: string,
  state: CallState
): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    logger.warn(
      { 
        hasRedisUrl: !!redisUrl,
        redisUrlPreview: redisUrl ? redisUrl.substring(0, 20) + '...' : 'undefined'
      }, 
      'Redis not configured, using in-memory fallback (NOT FOR PRODUCTION!)'
    );
    // Fall back to in-memory storage
    inMemoryStore.set(`voip:call:${callId}`, {
      state,
      expires: Date.now() + 3600 * 1000 // 1 hour from now
    });
    return;
  }

  try {
    await client.set(
      `voip:call:${callId}`,
      JSON.stringify(state),
      'EX',
      3600 // 1 hour TTL
    );
    logger.debug({ callId, currentNode: state.currentNode }, 'Call state saved to Redis');
  } catch (error: any) {
    logger.error(
      { callId, error: error.message, stack: error.stack },
      'Failed to save call state to Redis'
    );
    throw error;
  }
}

/**
 * Get call state from Redis
 * Falls back to in-memory storage if Redis is not configured
 */
export async function getCallState(
  callId: string
): Promise<CallState | null> {
  const client = getRedisClient();
  if (!client) {
    logger.warn({ callId }, 'Using in-memory fallback to get call state');
    // Use in-memory fallback
    const stored = inMemoryStore.get(`voip:call:${callId}`);
    if (!stored) {
      logger.warn({ callId }, 'Call state not found in in-memory store');
      return null;
    }
    
    // Check if expired
    if (Date.now() > stored.expires) {
      inMemoryStore.delete(`voip:call:${callId}`);
      logger.warn({ callId }, 'Call state expired in in-memory store');
      return null;
    }
    
    logger.debug({ callId, currentNode: stored.state.currentNode }, 'Call state retrieved from in-memory store');
    return stored.state;
  }

  try {
    const data = await client.get(`voip:call:${callId}`);
    if (!data) {
      logger.warn({ callId }, 'Call state not found in Redis');
      return null;
    }

    const state = JSON.parse(data);
    logger.debug({ callId, currentNode: state.currentNode }, 'Call state retrieved from Redis');
    return state;
  } catch (error: any) {
    logger.error(
      { callId, error: error.message, stack: error.stack },
      'Failed to get call state from Redis'
    );
    throw error;
  }
}

/**
 * Delete call state from Redis
 * Falls back to in-memory storage if Redis is not configured
 */
export async function deleteCallState(callId: string): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    // Use in-memory fallback
    inMemoryStore.delete(`voip:call:${callId}`);
    return;
  }

  await client.del(`voip:call:${callId}`);
}

/**
 * Update specific fields in call state
 */
export async function updateCallState(
  callId: string,
  updates: Partial<CallState>
): Promise<CallState | null> {
  const currentState = await getCallState(callId);
  if (!currentState) {
    return null;
  }

  const newState = {
    ...currentState,
    ...updates,
  };

  await saveCallState(callId, newState);
  return newState;
}

/**
 * Get all active calls for a quote request
 */
export async function getActiveCallsForQuote(
  quoteRequestId: string
): Promise<CallState[]> {
  const client = getRedisClient();
  if (!client) {
    return [];
  }

  const keys = await client.keys('voip:call:*');
  const states: CallState[] = [];

  for (const key of keys) {
    const data = await client.get(key);
    if (data) {
      const state = JSON.parse(data);
      if (state.quoteRequestId === quoteRequestId && state.status === 'in_progress') {
        states.push(state);
      }
    }
  }

  return states;
}
