// CRITICAL: Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import { Worker, Job } from 'bullmq';
import { redisConnection } from '@/lib/queue/connection';
import { QUEUE_NAMES } from '@/lib/queue/queues';
import { CommanderEventJobData } from '@/lib/queue/types';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { workerLogger } from '@/lib/logger';
import { getCommanderState, saveCommanderState, initCommanderState, stageDirective } from '@/lib/voip/commander/state';
import { analyzeEvent, shouldAnalyze, updateStateFromEvent } from '@/lib/voip/commander/analyzer';
import { getActiveCallsForQuote, getCallState } from '@/lib/voip/state-manager';
import { OverseerEvent } from '@/lib/voip/overseer/types';

const logger = workerLogger.child({ worker: 'commander' });

/**
 * Initialize Commander state from a quote request by reading active calls from Redis.
 * Retries once after 500ms if no calls are found (race with concurrent call init).
 */
async function initFromQuoteRequest(
  quoteRequestId: string,
  organizationId: string,
): Promise<import('@/lib/voip/commander/types').CommanderState> {
  let activeCalls = await getActiveCallsForQuote(quoteRequestId);

  // Race condition: if calls are initializing concurrently, the first event may
  // arrive before any CallState is saved to Redis. Retry once after a short delay.
  if (activeCalls.length === 0) {
    logger.warn({ quoteRequestId }, 'No active calls found for Commander init — retrying in 500ms');
    await new Promise(resolve => setTimeout(resolve, 500));
    activeCalls = await getActiveCallsForQuote(quoteRequestId);
  }

  // Extract parts list from the first call (all calls share the same parts)
  const parts = activeCalls.length > 0
    ? activeCalls[0].parts.map(p => ({
        partNumber: p.partNumber,
        budgetMax: p.budgetMax,
      }))
    : [];

  if (parts.length === 0) {
    logger.warn({ quoteRequestId, callCount: activeCalls.length }, 'Commander initialized with empty parts list — will be populated from events');
  }

  // Build calls list
  const calls = activeCalls.map(c => ({
    callId: c.callId,
    supplierId: c.supplierId,
    supplierName: c.supplierName,
  }));

  return initCommanderState(quoteRequestId, organizationId, parts, calls);
}

/**
 * Process a Commander event job.
 */
async function processCommanderEvent(job: Job<CommanderEventJobData>): Promise<void> {
  const { callId, quoteRequestId, supplierName, eventType, timestamp, data, organizationId } = job.data;

  logger.info(
    { callId, quoteRequestId, supplierName, eventType },
    'Processing Commander event',
  );

  // 1. Get or init Commander state
  let commanderState = await getCommanderState(quoteRequestId);
  if (!commanderState) {
    logger.info({ quoteRequestId }, 'No existing Commander state — initializing from active calls');
    commanderState = await initFromQuoteRequest(quoteRequestId, organizationId);
  }

  // Ensure this call is tracked — look up real supplierId from call state
  if (!commanderState.activeCalls[callId]) {
    let supplierId = '';
    try {
      const callState = await getCallState(callId);
      if (callState) supplierId = callState.supplierId;
    } catch { /* best effort — '' is acceptable fallback */ }

    commanderState.activeCalls[callId] = {
      supplierId,
      supplierName,
      status: 'active',
      phase: 'GATHER',
    };
  }

  // 2. Build the OverseerEvent from job data
  const event: OverseerEvent = {
    callId,
    quoteRequestId,
    supplierName,
    eventType: eventType as OverseerEvent['eventType'],
    timestamp,
    data,
  };

  // 3. Always update state with event data (non-LLM path)
  commanderState = updateStateFromEvent(event, commanderState);

  // 4. Run LLM analysis if this event type warrants it
  if (shouldAnalyze(eventType)) {
    try {
      const llmClient = await OpenRouterClient.fromOrganization(organizationId);

      const { directives, updatedState } = await analyzeEvent(
        llmClient,
        event,
        commanderState,
      );

      commanderState = updatedState;

      // 5. Stage directives to target Overseers (fault-tolerant — one failure doesn't block others)
      for (const directive of directives) {
        // Only send to active calls (not the source call unless targeted)
        if (commanderState.activeCalls[directive.targetCallId]?.status === 'active') {
          try {
            await stageDirective(directive.targetCallId, directive);
            logger.info(
              {
                quoteRequestId,
                targetCallId: directive.targetCallId,
                directiveType: directive.directiveType,
              },
              'Commander directive staged',
            );
          } catch (stageError: any) {
            logger.error(
              {
                quoteRequestId,
                targetCallId: directive.targetCallId,
                directiveType: directive.directiveType,
                error: stageError.message,
              },
              'Failed to stage directive — continuing with remaining',
            );
          }
        } else {
          logger.warn(
            {
              quoteRequestId,
              targetCallId: directive.targetCallId,
              directiveType: directive.directiveType,
            },
            'Skipping directive — target call not active',
          );
        }
      }
    } catch (llmError: any) {
      logger.error(
        { quoteRequestId, eventType, error: llmError.message },
        'Commander LLM analysis failed — state still updated',
      );
    }
  } else {
    logger.debug(
      { quoteRequestId, eventType },
      'Event type does not warrant LLM analysis — state updated only',
    );
  }

  // 6. Save updated Commander state
  await saveCommanderState(quoteRequestId, commanderState);

  logger.info(
    {
      quoteRequestId,
      eventType,
      eventsProcessed: commanderState.eventsProcessed,
      activeCallCount: Object.values(commanderState.activeCalls).filter(c => c.status === 'active').length,
    },
    'Commander event processed',
  );
}

/**
 * Start the Commander worker.
 */
export function startCommanderWorker() {
  const worker = new Worker<CommanderEventJobData>(
    QUEUE_NAMES.COMMANDER_EVENTS,
    async (job) => {
      await processCommanderEvent(job);
    },
    {
      connection: redisConnection,
      concurrency: 1, // Sequential processing — Commander must see events in order
    },
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job?.id }, 'Commander event job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, error: err.message },
      'Commander event job failed',
    );
  });

  logger.info('Commander worker started');
  return worker;
}

// Export for standalone usage
export const commanderWorker = startCommanderWorker;
