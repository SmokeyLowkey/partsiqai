// Commander Redis State Management
// Manages commander state across all active calls for a procurement request.

import { CommanderState, CommanderDirective } from './types';
import { redisConnection } from '@/lib/queue/connection';
import { workerLogger } from '@/lib/logger';

const logger = workerLogger.child({ module: 'commander-state' });

function commanderStateKey(quoteRequestId: string): string {
  return `voip:commander:${quoteRequestId}:state`;
}

// Directives are stored in the Overseer's namespace because the Overseer consumes them
function directiveKey(callId: string): string {
  return `voip:overseer:${callId}:directive`;
}

function getRedisClient() {
  if (!redisConnection) return null;
  return redisConnection;
}

/**
 * Create a default Commander state for a procurement request.
 */
export function initCommanderState(
  quoteRequestId: string,
  organizationId: string,
  parts: Array<{ partNumber: string; budgetMax?: number }>,
  calls: Array<{ callId: string; supplierId: string; supplierName: string }>,
): CommanderState {
  const bestQuotes: CommanderState['bestQuotes'] = {};
  const budgets: CommanderState['budgets'] = {};
  const activeCalls: CommanderState['activeCalls'] = {};

  for (const part of parts) {
    bestQuotes[part.partNumber] = {
      bestPrice: null,
      bestSupplier: null,
      bestLeadTimeDays: null,
      bestLeadTimeSupplier: null,
      quotesReceived: 0,
    };
    budgets[part.partNumber] = {
      budgetCeiling: part.budgetMax ?? null,
      targetPrice: part.budgetMax ? Math.round(part.budgetMax * 0.85) : null, // Target 15% below ceiling
    };
  }

  for (const call of calls) {
    activeCalls[call.callId] = {
      supplierId: call.supplierId,
      supplierName: call.supplierName,
      status: 'active',
      phase: 'GATHER',
    };
  }

  return {
    quoteRequestId,
    organizationId,
    bestQuotes,
    activeCalls,
    budgets,
    eventsProcessed: 0,
    lastEventTimestamp: 0,
  };
}

/**
 * Get the Commander state for a procurement request.
 */
export async function getCommanderState(quoteRequestId: string): Promise<CommanderState | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const data = await client.get(commanderStateKey(quoteRequestId));
    if (!data) return null;
    return JSON.parse(data) as CommanderState;
  } catch (error: any) {
    logger.error({ quoteRequestId, error: error.message }, 'Failed to get commander state');
    return null;
  }
}

/**
 * Save the Commander state with 2-hour TTL.
 * Longer than Overseer (1hr) because procurement requests span multiple calls.
 */
export async function saveCommanderState(quoteRequestId: string, state: CommanderState): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.set(commanderStateKey(quoteRequestId), JSON.stringify(state), 'EX', 7200);
    logger.debug(
      { quoteRequestId, activeCalls: Object.keys(state.activeCalls).length, eventsProcessed: state.eventsProcessed },
      'Commander state saved',
    );
  } catch (error: any) {
    logger.error({ quoteRequestId, error: error.message }, 'Failed to save commander state');
  }
}

/**
 * Stage a Commander directive for a specific call's Overseer.
 * Uses a Redis list (RPUSH) so multiple directives in one analysis batch don't overwrite each other.
 * 5-minute TTL refreshed on each push — may need to wait for the next Overseer analysis cycle.
 */
export async function stageDirective(callId: string, directive: CommanderDirective): Promise<void> {
  const client = getRedisClient();
  if (!client) return;

  try {
    const key = directiveKey(callId);
    await client.rpush(key, JSON.stringify(directive));
    await client.expire(key, 300);
    logger.info(
      { callId, directiveType: directive.directiveType },
      'Commander directive staged for Overseer',
    );
  } catch (error: any) {
    logger.error({ callId, error: error.message }, 'Failed to stage directive');
  }
}
