import Redis from 'ioredis';
import { CallState } from './types';

let redis: Redis | null = null;

// In-memory fallback for development (NOT for production!)
const inMemoryStore = new Map<string, { state: CallState; expires: number }>();

function getRedisClient() {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL) {
    redis = new Redis(process.env.UPSTASH_REDIS_REST_URL);
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
    console.warn('Redis not configured, using in-memory fallback (NOT FOR PRODUCTION!)');
    // Fall back to in-memory storage
    inMemoryStore.set(`voip:call:${callId}`, {
      state,
      expires: Date.now() + 3600 * 1000 // 1 hour from now
    });
    return;
  }

  await client.set(
    `voip:call:${callId}`,
    JSON.stringify(state),
    'EX',
    3600 // 1 hour TTL
  );
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
    // Use in-memory fallback
    const stored = inMemoryStore.get(`voip:call:${callId}`);
    if (!stored) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > stored.expires) {
      inMemoryStore.delete(`voip:call:${callId}`);
      return null;
    }
    
    return stored.state;
  }

  const data = await client.get(`voip:call:${callId}`);
  if (!data) {
    return null;
  }

  return JSON.parse(data);
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
