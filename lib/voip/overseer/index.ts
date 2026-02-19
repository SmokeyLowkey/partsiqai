// Overseer Public API
// Ties together gating, analysis, state management, and Commander event emission.

import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { CallState } from '../types';
import { getOverseerState, saveOverseerState, initOverseerState, stageNudge, peekDirective, consumeDirective } from './state';
import { shouldOverseerFire } from './gating';
import { analyzeAndNudge } from './analyzer';
import { workerLogger } from '@/lib/logger';

const logger = workerLogger.child({ module: 'overseer' });

/**
 * Run the Overseer asynchronously for a completed turn.
 * This is fire-and-forget — it analyzes the turn, stages a nudge for the next turn,
 * and emits events to the Commander queue.
 *
 * NEVER blocks the voice agent's response. Errors are caught and logged.
 */
export async function runOverseerAsync(
  callId: string,
  llmClient: OpenRouterClient,
  callState: CallState,
): Promise<void> {
  const turnNumber = callState.turnNumber || 0;

  try {
    // 1. Get or init overseer state
    let overseerState = await getOverseerState(callId);
    if (!overseerState) {
      overseerState = initOverseerState(callId);
    }

    // 2. Skip if already analyzed this turn
    if (overseerState.lastAnalyzedTurn >= turnNumber) {
      logger.debug({ callId, turn: turnNumber }, 'Overseer already analyzed this turn — skipping');
      return;
    }

    // 3. Run gating
    if (!shouldOverseerFire(callState, overseerState)) {
      logger.debug({ callId, turn: turnNumber, node: callState.currentNode }, 'Overseer gated OUT');
      overseerState.lastAnalyzedTurn = turnNumber;
      await saveOverseerState(callId, overseerState);
      return;
    }

    logger.info({ callId, turn: turnNumber, phase: overseerState.phase, node: callState.currentNode }, 'Overseer gated IN — running analysis');

    // 4. Peek at Commander directive (don't consume yet — only after success)
    const directive = await peekDirective(callId);
    if (directive) {
      logger.info(
        { callId, directiveType: directive.directiveType },
        'Commander directive found — incorporating into analysis',
      );
    }

    // 5. Analyze and generate nudge
    const { nudge, updatedState, event } = await analyzeAndNudge(
      llmClient,
      callState,
      overseerState,
      directive,
    );

    // 6. Analysis succeeded — consume the directive so it's not reprocessed
    if (directive) {
      await consumeDirective(callId);
    }

    // 7. Stage nudge for next turn
    if (nudge) {
      await stageNudge(callId, nudge);
    }

    // 8. Emit event to Commander queue (if any)
    if (event) {
      try {
        // Dynamic import to avoid circular dependency
        const { commanderEventsQueue } = await import('@/lib/queue/queues');
        await commanderEventsQueue.add(
          `event-${callState.callId}-${turnNumber}`,
          {
            ...event,
            organizationId: callState.organizationId,
          },
        );
        logger.info(
          { callId, eventType: event.eventType },
          'Commander event enqueued',
        );
      } catch (queueError: any) {
        logger.warn(
          { callId, error: queueError.message },
          'Failed to enqueue Commander event — Commander may not be configured',
        );
      }
    }

    // 9. Save updated overseer state
    await saveOverseerState(callId, updatedState);
  } catch (error: any) {
    logger.error(
      { callId, turn: turnNumber, error: error.message, stack: error.stack },
      'Overseer async error — voice agent unaffected',
    );
  }
}

// Re-export state functions used by the LangGraph handler
export { consumeNudge, initOverseerState, saveOverseerState } from './state';
export type { OverseerNudge } from './types';
