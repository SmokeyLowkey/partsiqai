import Redis from 'ioredis';
import { CallState } from './types';

let redis: Redis | null = null;

function getRedisClient() {
  if (!redis && process.env.UPSTASH_REDIS_URL) {
    redis = new Redis(process.env.UPSTASH_REDIS_URL);
  }
  return redis;
}

/**
 * Save call state to Redis with 1 hour TTL
 */
export async function saveCallState(
  callId: string,
  state: CallState
): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    console.warn('Redis not configured, state will not be persisted');
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
 */
export async function getCallState(
  callId: string
): Promise<CallState | null> {
  const client = getRedisClient();
  if (!client) {
    return null;
  }

  const data = await client.get(`voip:call:${callId}`);
  if (!data) {
    return null;
  }

  return JSON.parse(data);
}

/**
 * Delete call state from Redis
 */
export async function deleteCallState(callId: string): Promise<void> {
  const client = getRedisClient();
  if (!client) {
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
