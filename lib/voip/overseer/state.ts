// Overseer Redis State Management
// Manages overseer state, nudge staging/consumption, and directive handling via Redis.

import { OverseerState, OverseerNudge } from './types';
import { CommanderDirective } from '../commander/types';
import { redisConnection } from '@/lib/queue/connection';
import { workerLogger } from '@/lib/logger';

const logger = workerLogger.child({ module: 'overseer-state' });

function overseerStateKey(callId: string): string {
  return `voip:overseer:${callId}:state`;
}

function nudgeKey(callId: string): string {
  return `voip:overseer:${callId}:nudge`;
}

function directiveKey(callId: string): string {
  return `voip:overseer:${callId}:directive`;
}

function getRedisClient() {
  if (!redisConnection) return null;
  return redisConnection;
}

/**
 * Create a default Overseer state for a new call.
 */
export function initOverseerState(callId: string): OverseerState {
  return {
    callId,
    phase: 'GATHER',
    lastAnalyzedTurn: -1,
    infoWeNeed: {
      unitPrices: 'pending',
      leadTime: 'pending',
      stockStatus: 'pending',
      allPartsAddressed: false,
    },
    infoTheyWant: {
      quantity: 'not_asked',
      companyName: 'not_asked',
      accountNumber: 'not_asked',
    },
    negotiationNotes: [],
    flaggedIssues: [],
  };
}

/**
 * Get the Overseer state for a call.
 */
export async function getOverseerState(callId: string): Promise<OverseerState | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const data = await client.get(overseerStateKey(callId));
    if (!data) return null;
    return JSON.parse(data) as OverseerState;
  } catch (error: any) {
    logger.error({ callId, error: error.message }, 'Failed to get overseer state');
    return null;
  }
}

/**
 * Save the Overseer state with 1-hour TTL.
 */
export async function saveOverseerState(callId: string, state: OverseerState): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(overseerStateKey(callId), JSON.stringify(state), 'EX', 3600);
    logger.debug({ callId, phase: state.phase, turn: state.lastAnalyzedTurn }, 'Overseer state saved');
  } catch (error: any) {
    logger.error({ callId, error: error.message }, 'Failed to save overseer state');
  }
}

/**
 * Stage a nudge for the voice agent to pick up on the next turn.
 * Short TTL (120s) because nudges are per-turn — if not consumed quickly, they're stale.
 */
export async function stageNudge(callId: string, nudge: OverseerNudge): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(nudgeKey(callId), JSON.stringify(nudge), 'EX', 120);
    logger.info(
      { callId, priority: nudge.priority, turnTarget: nudge.turnNumber, source: nudge.source },
      'Overseer nudge staged',
    );
  } catch (error: any) {
    logger.error({ callId, error: error.message }, 'Failed to stage nudge');
  }
}

// Lua script for atomic GET+DEL (single Redis operation, no race window)
const GET_AND_DELETE_SCRIPT = `
  local value = redis.call('GET', KEYS[1])
  if value then
    redis.call('DEL', KEYS[1])
  end
  return value
`;

/**
 * Consume a staged nudge atomically using a Lua script.
 * Returns the nudge and removes it from Redis in a single atomic operation.
 */
export async function consumeNudge(callId: string): Promise<OverseerNudge | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const data = await (client as any).eval(GET_AND_DELETE_SCRIPT, 1, nudgeKey(callId));
    if (!data) return null;
    return JSON.parse(data as string) as OverseerNudge;
  } catch (error: any) {
    logger.error({ callId, error: error.message }, 'Failed to consume nudge');
    return null;
  }
}

/**
 * Peek at all Commander directives without consuming them.
 * Returns the highest-priority directive (wrap_up/escalate > leverage_update > deprioritize).
 * Used to read before analysis — only consumed after success.
 */
export async function peekDirective(callId: string): Promise<CommanderDirective | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const items = await client.lrange(directiveKey(callId), 0, -1);
    if (!items || items.length === 0) return null;

    // Parse all directives and return the highest-priority one
    const directives = items.map(item => JSON.parse(item) as CommanderDirective);

    // Priority order: escalate > wrap_up > award > leverage_update > deprioritize
    const priorityOrder: Record<string, number> = {
      escalate: 5, wrap_up: 4, award: 3, leverage_update: 2, deprioritize: 1,
    };
    directives.sort((a, b) => (priorityOrder[b.directiveType] ?? 0) - (priorityOrder[a.directiveType] ?? 0));

    return directives[0];
  } catch (error: any) {
    logger.error({ callId, error: error.message }, 'Failed to peek directive');
    return null;
  }
}

/**
 * Consume all Commander directives for this call (DEL the list key).
 * Call this only after analysis succeeds, so directives aren't lost on failure.
 */
export async function consumeDirective(callId: string): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.del(directiveKey(callId));
  } catch (error: any) {
    logger.error({ callId, error: error.message }, 'Failed to consume directive');
  }
}
