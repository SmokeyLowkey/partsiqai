// Commander Analyzer — Cross-Call LLM Analysis + Directive Generation
// Analyzes events from Overseers, compares quotes across suppliers,
// and issues directives to optimize the overall procurement outcome.

import { z } from 'zod';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { CommanderState, CommanderDirective } from './types';
import { OverseerEvent } from '../overseer/types';
import { workerLogger } from '@/lib/logger';

// Zod schema for validating Commander LLM output
const CommanderAnalysisSchema = z.object({
  analysis: z.string().default('No analysis provided'),
  directives: z.array(z.object({
    directiveType: z.enum(['leverage_update', 'deprioritize', 'wrap_up', 'escalate', 'award']),
    targetCallId: z.string().min(1),
    message: z.string().min(1),
  })).default([]),
}).passthrough(); // Allow extra fields the LLM may add (we just ignore them)

const logger = workerLogger.child({ module: 'commander-analyzer' });

// Events that warrant full LLM analysis
const ANALYZE_EVENTS = new Set([
  'quote_received',
  'quote_rejected',
  'negotiation_stalled',
  'supplier_wants_callback',
  'call_ended',
]);

/**
 * Determine if a Commander LLM analysis should run for this event.
 * Simple events (like transfer_in_progress) just update state without LLM.
 */
export function shouldAnalyze(eventType: string): boolean {
  return ANALYZE_EVENTS.has(eventType);
}

/**
 * Build the Commander analysis prompt.
 */
function buildCommanderPrompt(
  event: OverseerEvent,
  commanderState: CommanderState,
): string {
  // Format best quotes across all suppliers
  const quotesOverview = Object.entries(commanderState.bestQuotes)
    .map(([partNumber, q]) => {
      const priceStr = q.bestPrice !== null ? `$${q.bestPrice.toFixed(2)} (${q.bestSupplier})` : 'no quotes yet';
      const leadStr = q.bestLeadTimeDays !== null ? `${q.bestLeadTimeDays} days (${q.bestLeadTimeSupplier})` : 'unknown';
      const budget = commanderState.budgets[partNumber];
      const budgetStr = budget?.budgetCeiling ? ` | ceiling: $${budget.budgetCeiling}` : '';
      return `- ${partNumber}: best price ${priceStr}, lead time ${leadStr}, ${q.quotesReceived} quote(s)${budgetStr}`;
    })
    .join('\n');

  // Format active calls
  const callsOverview = Object.entries(commanderState.activeCalls)
    .map(([callId, call]) => {
      return `- ${call.supplierName} [${callId}]: ${call.status}, phase: ${call.phase}`;
    })
    .join('\n');

  // Format the triggering event
  const eventDataStr = Object.entries(event.data)
    .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
    .join('\n');

  return `You are a Procurement Commander coordinating multiple supplier calls for the same quote request.
Your job is to compare quotes across suppliers and issue directives to optimize the overall procurement outcome.

## Current Best Quotes:
${quotesOverview || 'No quotes collected yet.'}

## Active Calls:
${callsOverview || 'No active calls.'}

## Triggering Event:
Type: ${event.eventType}
From: ${event.supplierName} [${event.callId}]
Data:
${eventDataStr || '  (none)'}

## Your Task:
Analyze this event in the context of all active calls and decide what directives to issue.

Available directive types:
- **leverage_update**: Share competitive intelligence with another call. Use when a new quote beats the current best — tell the other supplier's Overseer to use it as leverage. Example: "Another supplier quoted $850 for this part — explore if they can match or beat it."
- **deprioritize**: A part is well-covered across suppliers. Tell a call to shift focus to other parts where we still need quotes or better prices.
- **wrap_up**: A supplier is uncompetitive and shows no flexibility. End the call politely to save time.
- **escalate**: Supplier demands deviate from policy (e.g., requires 50% deposit, unusual terms). Hand off to human.
- **award**: Best overall package found. Confirm terms with the winning supplier.

## Key Behaviors:
- Only issue leverage_update when the price difference is meaningful (>5% improvement).
- Don't issue wrap_up too aggressively — give suppliers at least 2 chances to compete.
- Consider the TOTAL package: price + lead time + availability. A slightly more expensive supplier with better lead time may be preferable.
- If only one call is active, leverage_update has no target. Focus on tracking best quotes.
- If a call just ended, update tracking and consider if remaining calls need new instructions.

Respond with valid JSON matching this structure:
{
  "analysis": "Brief 1-2 sentence assessment of the situation",
  "directives": [
    {
      "directiveType": "leverage_update|deprioritize|wrap_up|escalate|award",
      "targetCallId": "full call ID to send directive to",
      "message": "Specific instruction for the Overseer"
    }
  ]
}

IMPORTANT: For directives, use the FULL call ID from the Active Calls list, not a truncated version.
If no directives are needed, return an empty array.
Do NOT include an "updatedBestQuotes" field — quote tracking is handled automatically.`;
}

/**
 * Analyze an Overseer event and produce directives for other calls.
 */
export async function analyzeEvent(
  llmClient: OpenRouterClient,
  event: OverseerEvent,
  commanderState: CommanderState,
): Promise<{
  directives: CommanderDirective[];
  updatedState: CommanderState;
}> {
  try {
    const prompt = buildCommanderPrompt(event, commanderState);

    const rawAnalysis = await llmClient.generateStructuredOutput<z.infer<typeof CommanderAnalysisSchema>>(
      prompt,
      null,
      {
        model: llmClient.getOverseerModel(), // Commander uses same model as Overseer
        temperature: 0.2,
        maxTokens: 1000,
      },
    );

    // Validate LLM output with Zod — coerce to safe defaults on malformed output
    const analysis = CommanderAnalysisSchema.parse(rawAnalysis);

    logger.info(
      {
        quoteRequestId: commanderState.quoteRequestId,
        eventType: event.eventType,
        fromSupplier: event.supplierName,
        analysis: analysis.analysis,
        directiveCount: analysis.directives?.length ?? 0,
      },
      'Commander analysis complete',
    );

    // Build directives
    const directives: CommanderDirective[] = (analysis.directives || []).map(d => ({
      directiveType: d.directiveType,
      targetCallId: d.targetCallId,
      message: d.message,
      timestamp: Date.now(),
    }));

    // Do NOT replace bestQuotes from LLM analysis — deterministic tracking
    // in updateStateFromEvent is the source of truth. The LLM may hallucinate
    // prices or drop entries. Don't increment eventsProcessed here — the caller
    // (commander-worker) runs updateStateFromEvent first which handles that.
    const updatedState: CommanderState = { ...commanderState };

    return { directives, updatedState };
  } catch (error: any) {
    logger.error(
      {
        quoteRequestId: commanderState.quoteRequestId,
        eventType: event.eventType,
        error: error.message,
      },
      'Commander analysis failed',
    );

    // Return no directives on error — don't disrupt active calls.
    // Don't increment eventsProcessed — updateStateFromEvent already did.
    return {
      directives: [],
      updatedState: commanderState,
    };
  }
}

/**
 * Update Commander state with event data without running LLM analysis.
 * Used for simple events like transfer_in_progress.
 */
export function updateStateFromEvent(
  event: OverseerEvent,
  commanderState: CommanderState,
): CommanderState {
  const updated = { ...commanderState };

  switch (event.eventType) {
    case 'call_ended': {
      if (updated.activeCalls[event.callId]) {
        updated.activeCalls = {
          ...updated.activeCalls,
          [event.callId]: {
            ...updated.activeCalls[event.callId],
            status: 'ended',
          },
        };
      }
      break;
    }

    case 'quote_received': {
      const { partNumber, price, leadTimeDays, supplierName } = event.data;
      if (partNumber) {
        // Auto-create entry if part wasn't in bestQuotes (empty-init race condition)
        if (!updated.bestQuotes[partNumber]) {
          updated.bestQuotes = {
            ...updated.bestQuotes,
            [partNumber]: {
              bestPrice: null,
              bestSupplier: null,
              bestLeadTimeDays: null,
              bestLeadTimeSupplier: null,
              quotesReceived: 0,
            },
          };
        }
        const current = updated.bestQuotes[partNumber];
        const newQuotes = { ...current, quotesReceived: current.quotesReceived + 1 };

        const resolvedSupplier = supplierName || event.supplierName || 'unknown';
        if (price != null && (current.bestPrice === null || price < current.bestPrice)) {
          newQuotes.bestPrice = price;
          newQuotes.bestSupplier = resolvedSupplier;
        }
        if (leadTimeDays != null && (current.bestLeadTimeDays === null || leadTimeDays < current.bestLeadTimeDays)) {
          newQuotes.bestLeadTimeDays = leadTimeDays;
          newQuotes.bestLeadTimeSupplier = resolvedSupplier;
        }

        updated.bestQuotes = {
          ...updated.bestQuotes,
          [partNumber]: newQuotes,
        };
      }
      break;
    }

    case 'transfer_in_progress':
    case 'error_detected':
    default:
      break;
  }

  updated.eventsProcessed += 1;
  updated.lastEventTimestamp = Date.now();

  return updated;
}
