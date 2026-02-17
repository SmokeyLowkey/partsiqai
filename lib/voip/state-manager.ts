import { CallState } from './types';
import { workerLogger } from '@/lib/logger';
import { redisConnection } from '@/lib/queue/connection';

const logger = workerLogger.child({ module: 'voip-state-manager' });

// In-memory fallback for development (NOT for production!)
const inMemoryStore = new Map<string, { state: CallState; expires: number }>();

// Index key: maps quoteRequestId → set of callIds
function quoteIndexKey(quoteRequestId: string): string {
  return `voip:quote-calls:${quoteRequestId}`;
}

function callStateKey(callId: string): string {
  return `voip:call:${callId}`;
}

function getRedisClient() {
  if (!redisConnection) {
    return null;
  }
  return redisConnection;
}

/**
 * Save call state to Redis with 1 hour TTL.
 * Also maintains a per-quote Set index for efficient lookups.
 */
export async function saveCallState(
  callId: string,
  state: CallState
): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    logger.warn('Redis not configured, using in-memory fallback (NOT FOR PRODUCTION!)');
    inMemoryStore.set(callStateKey(callId), {
      state,
      expires: Date.now() + 3600 * 1000,
    });
    return;
  }

  try {
    const pipeline = client.pipeline();

    // Save the call state with TTL
    pipeline.set(callStateKey(callId), JSON.stringify(state), 'EX', 3600);

    // Add callId to the per-quote index set (if we have a quoteRequestId)
    if (state.quoteRequestId) {
      const indexKey = quoteIndexKey(state.quoteRequestId);
      pipeline.sadd(indexKey, callId);
      pipeline.expire(indexKey, 3600);
    }

    await pipeline.exec();
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
 * Acquire a per-call mutex lock using Redis SETNX.
 * Prevents concurrent processing of the same call (e.g., if Vapi
 * sends two messages rapidly before the first finishes processing).
 * @param callId  The call to lock
 * @param ttlMs   Auto-expire in milliseconds (safety net if process crashes)
 * @returns true if lock acquired, false if already locked
 */
export async function acquireCallLock(callId: string, ttlMs: number = 15000): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return true; // No Redis = no lock needed (dev mode)

  const lockKey = `voip:lock:${callId}`;
  const result = await client.set(lockKey, Date.now().toString(), 'PX', ttlMs, 'NX');
  return result === 'OK';
}

/**
 * Release the per-call mutex lock.
 */
export async function releaseCallLock(callId: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  await client.del(`voip:lock:${callId}`);
}

/**
 * Get call state from Redis
 */
export async function getCallState(
  callId: string
): Promise<CallState | null> {
  const client = getRedisClient();
  if (!client) {
    logger.warn({ callId }, 'Using in-memory fallback to get call state');
    const stored = inMemoryStore.get(callStateKey(callId));
    if (!stored) {
      return null;
    }
    if (Date.now() > stored.expires) {
      inMemoryStore.delete(callStateKey(callId));
      return null;
    }
    return stored.state;
  }

  try {
    const data = await client.get(callStateKey(callId));
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
 * Delete call state from Redis and remove from quote index
 */
export async function deleteCallState(callId: string): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    inMemoryStore.delete(callStateKey(callId));
    return;
  }

  // Get state first so we can clean up the index
  const data = await client.get(callStateKey(callId));
  if (data) {
    try {
      const state = JSON.parse(data) as CallState;
      if (state.quoteRequestId) {
        const pipeline = client.pipeline();
        pipeline.del(callStateKey(callId));
        pipeline.srem(quoteIndexKey(state.quoteRequestId), callId);
        await pipeline.exec();
        return;
      }
    } catch {
      // Fall through to simple delete
    }
  }

  await client.del(callStateKey(callId));
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
 * Get all active calls for a quote request using the Set index.
 * O(M) where M = calls for this quote, instead of O(N) scanning all keys.
 */
export async function getActiveCallsForQuote(
  quoteRequestId: string
): Promise<CallState[]> {
  const client = getRedisClient();
  if (!client) {
    return [];
  }

  try {
    // Get call IDs from the per-quote index (1 SMEMBERS command)
    const callIds = await client.smembers(quoteIndexKey(quoteRequestId));
    if (callIds.length === 0) {
      return [];
    }

    // Batch-fetch all call states (1 MGET command)
    const keys = callIds.map((id) => callStateKey(id));
    const results = await client.mget(...keys);

    const states: CallState[] = [];
    const expiredCallIds: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const data = results[i];
      if (!data) {
        // Call state expired but still in index — mark for cleanup
        expiredCallIds.push(callIds[i]);
        continue;
      }
      const state = JSON.parse(data) as CallState;
      if (state.status === 'in_progress') {
        states.push(state);
      }
    }

    // Clean up expired entries from the index
    if (expiredCallIds.length > 0) {
      await client.srem(quoteIndexKey(quoteRequestId), ...expiredCallIds);
    }

    return states;
  } catch (error: any) {
    logger.error(
      { quoteRequestId, error: error.message },
      'Failed to get active calls for quote'
    );
    return [];
  }
}
