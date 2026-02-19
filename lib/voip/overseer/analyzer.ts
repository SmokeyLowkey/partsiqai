// Overseer Analyzer — Core LLM Analysis + Nudge Generation
// Analyzes each call turn and produces nudges for the voice agent.

import { z } from 'zod';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { CallState } from '../types';
import {
  OverseerState,
  OverseerNudge,
  OverseerEvent,
  OverseerPhase,
} from './types';
import { CommanderDirective } from '../commander/types';
import { workerLogger } from '@/lib/logger';

// Zod schema for validating Overseer LLM output
const OverseerAnalysisSchema = z.object({
  analysis: z.string().default('No analysis provided'),
  nudge: z.object({
    priority: z.enum(['P0', 'P1', 'P2']),
    text: z.string().min(1),
  }).nullable().default(null),
  phaseTransition: z.enum(['NEGOTIATE', 'FINALIZE']).nullable().default(null),
  event: z.object({
    eventType: z.enum([
      'quote_received', 'quote_rejected', 'negotiation_stalled',
      'transfer_in_progress', 'supplier_wants_callback', 'call_ended', 'error_detected',
    ]),
    data: z.record(z.any()).default({}),
  }).nullable().default(null),
  updatedTracking: z.object({
    unitPrices: z.enum(['pending', 'partial', 'collected']).default('pending'),
    leadTime: z.enum(['pending', 'collected', 'not_applicable']).default('pending'),
    stockStatus: z.enum(['pending', 'collected', 'not_applicable']).default('pending'),
    allPartsAddressed: z.boolean().default(false),
    infoTheyWant: z.object({
      quantity: z.enum(['not_asked', 'asked', 'answered']).default('not_asked'),
      companyName: z.enum(['not_asked', 'asked', 'answered']).default('not_asked'),
      accountNumber: z.enum(['not_asked', 'asked', 'answered']).default('not_asked'),
    }).optional(),
  }).optional(),
  flaggedIssue: z.string().nullable().default(null),
}).passthrough();

const logger = workerLogger.child({ module: 'overseer-analyzer' });

/**
 * Build the Overseer analysis prompt.
 */
function buildOverseerPrompt(
  callState: CallState,
  overseerState: OverseerState,
  directive: CommanderDirective | null,
): string {
  const recentHistory = callState.conversationHistory
    .slice(-8)
    .map(msg => {
      const speaker = msg.speaker === 'ai' ? 'Voice Agent' : msg.speaker === 'supplier' ? 'Supplier' : 'System';
      return `${speaker}: ${msg.text}`;
    })
    .join('\n');

  const partsContext = callState.parts
    .map(p => {
      const budget = p.budgetMax ? ` (budget ceiling: $${p.budgetMax})` : '';
      return `- ${p.partNumber}: ${p.description}, qty ${p.quantity}${budget}`;
    })
    .join('\n');

  const quotesContext = callState.quotes.length > 0
    ? callState.quotes.map(q => {
      const price = q.price ? `$${q.price.toFixed(2)}` : 'no price yet';
      const sub = q.isSubstitute ? ` (substitute for ${q.originalPartNumber})` : '';
      return `- ${q.partNumber}${sub}: ${price}, ${q.availability}`;
    }).join('\n')
    : 'No quotes extracted yet.';

  const directiveContext = directive
    ? `\nCOMMANDER DIRECTIVE (from procurement coordinator — incorporate into your analysis):\n[${directive.directiveType.toUpperCase()}] ${directive.message}\n`
    : '';

  return `You are an Overseer agent monitoring a procurement phone call. Your job is to analyze each turn and provide coaching nudges to the voice agent.

## Current Phase: ${overseerState.phase}

## Parts Being Quoted:
${partsContext}

## Quotes Collected So Far:
${quotesContext}

## Information Tracking:
- Unit prices: ${overseerState.infoWeNeed.unitPrices}
- Lead time: ${overseerState.infoWeNeed.leadTime}
- Stock status: ${overseerState.infoWeNeed.stockStatus}
- All parts addressed: ${overseerState.infoWeNeed.allPartsAddressed}
- Supplier asked for quantity: ${overseerState.infoTheyWant.quantity}
- Supplier asked for company name: ${overseerState.infoTheyWant.companyName}
- Supplier asked for account: ${overseerState.infoTheyWant.accountNumber}

## Previous Issues Flagged:
${overseerState.flaggedIssues.length > 0 ? overseerState.flaggedIssues.slice(-5).map(i => `- ${i}`).join('\n') : 'None'}
${directiveContext}
## Recent Conversation:
${recentHistory}

## Your Task:
Analyze the most recent turn and decide:

1. **Nudge**: Should the voice agent be coached for its next response?
   - P0 (CRITICAL): Agent MUST address this (wrong price stated, premature acceptance, missing critical info)
   - P1 (STEERING): Agent SHOULD address this (uncovered parts, missed opportunity, supplier deflecting)
   - P2 (SUGGESTION): Nice-to-have if natural (negotiation tip, relationship building)
   - null if no guidance needed

2. **Phase Transition**: Should we move to the next phase?
   - GATHER → NEGOTIATE: All parts have been quoted (prices received for all or marked unavailable)
   - NEGOTIATE → FINALIZE: Price agreed within budget bounds, ready to confirm terms
   - null if staying in current phase

3. **Event**: Should we report something to the procurement coordinator?
   - quote_received: A new price quote was extracted
   - quote_rejected: Supplier can't provide a part
   - negotiation_stalled: No progress for multiple turns
   - supplier_wants_callback: Supplier wants to call back later
   - call_ended: Call is wrapping up
   - null if nothing to report

4. **Tracking Updates**: Update the information tracking fields based on what happened this turn.

5. **Flagged Issue**: Any new concern to flag (contradictions, agent errors, manipulation tactics).

## Key Behaviors:
- If the agent said "great price" or "I'll take it" to ANY price — that's a P0 correction. Walk it back.
- If the supplier is deflecting to email without giving a verbal range — nudge to pin down a ballpark.
- If parts remain unquoted after several turns — nudge to ask about them.
- If the supplier asked a question the agent hasn't answered — track it.
- If the agent is accepting the first price without any pushback — nudge to explore flexibility.
- During NEGOTIATE: provide specific negotiation angles based on budget gaps and competing quotes.
- During FINALIZE: verify all terms match what was discussed. Flag any discrepancies.

Respond with valid JSON matching this structure:
{
  "analysis": "Brief 1-2 sentence assessment",
  "nudge": { "priority": "P0|P1|P2", "text": "guidance text" } | null,
  "phaseTransition": "NEGOTIATE" | "FINALIZE" | null,
  "event": { "eventType": "quote_received|...", "data": { ... } } | null,
  "updatedTracking": {
    "unitPrices": "pending|partial|collected",
    "leadTime": "pending|collected|not_applicable",
    "stockStatus": "pending|collected|not_applicable",
    "allPartsAddressed": true|false,
    "infoTheyWant": {
      "quantity": "not_asked|asked|answered",
      "companyName": "not_asked|asked|answered",
      "accountNumber": "not_asked|asked|answered"
    }
  },
  "flaggedIssue": "string" | null
}`;
}

/**
 * Analyze a call turn and produce a nudge, updated state, and optional event.
 */
export async function analyzeAndNudge(
  llmClient: OpenRouterClient,
  callState: CallState,
  overseerState: OverseerState,
  directive: CommanderDirective | null = null,
): Promise<{
  nudge: OverseerNudge | null;
  updatedState: OverseerState;
  event: OverseerEvent | null;
}> {
  const turnNumber = callState.turnNumber || 0;

  try {
    const prompt = buildOverseerPrompt(callState, overseerState, directive);

    const rawAnalysis = await llmClient.generateStructuredOutput<z.infer<typeof OverseerAnalysisSchema>>(
      prompt,
      null,
      {
        model: llmClient.getOverseerModel(),
        temperature: 0.2,
        maxTokens: 1000,
      },
    );

    // Validate LLM output with Zod — coerce to safe defaults on malformed output
    const analysis = OverseerAnalysisSchema.parse(rawAnalysis);

    logger.info(
      {
        callId: callState.callId,
        turn: turnNumber,
        analysis: analysis.analysis,
        hasNudge: !!analysis.nudge,
        nudgePriority: analysis.nudge?.priority,
        phaseTransition: analysis.phaseTransition,
        hasEvent: !!analysis.event,
      },
      'Overseer analysis complete',
    );

    // Build nudge
    let nudge: OverseerNudge | null = null;
    if (analysis.nudge) {
      const newPhase = analysis.phaseTransition
        ? (analysis.phaseTransition as OverseerPhase)
        : overseerState.phase;

      nudge = {
        priority: analysis.nudge.priority,
        text: analysis.nudge.text,
        turnNumber: turnNumber + 1,
        phase: newPhase,
        timestamp: Date.now(),
        source: directive ? 'commander' : 'overseer',
        phaseTransition: analysis.phaseTransition as OverseerPhase | undefined,
      };
    } else if (analysis.phaseTransition) {
      // Phase transition without explicit nudge text — generate a default P0 nudge
      const transitionText = analysis.phaseTransition === 'NEGOTIATE'
        ? 'PHASE TRANSITION: All required information collected. Move to NEGOTIATE phase. Explore pricing flexibility before accepting.'
        : 'PHASE TRANSITION: Agreement reached within bounds. Move to FINALIZE phase. Read back all terms for confirmation.';

      nudge = {
        priority: 'P0',
        text: transitionText,
        turnNumber: turnNumber + 1,
        phase: analysis.phaseTransition as OverseerPhase,
        timestamp: Date.now(),
        source: 'overseer',
        phaseTransition: analysis.phaseTransition as OverseerPhase,
      };
    }

    // Build event
    let event: OverseerEvent | null = null;
    if (analysis.event) {
      event = {
        callId: callState.callId,
        quoteRequestId: callState.quoteRequestId,
        supplierName: callState.supplierName,
        eventType: analysis.event.eventType,
        timestamp: Date.now(),
        data: analysis.event.data || {},
      };
    }

    // Build updated state
    const updatedState: OverseerState = {
      ...overseerState,
      lastAnalyzedTurn: turnNumber,
      phase: analysis.phaseTransition
        ? (analysis.phaseTransition as OverseerPhase)
        : overseerState.phase,
      infoWeNeed: {
        unitPrices: analysis.updatedTracking?.unitPrices ?? overseerState.infoWeNeed.unitPrices,
        leadTime: analysis.updatedTracking?.leadTime ?? overseerState.infoWeNeed.leadTime,
        stockStatus: analysis.updatedTracking?.stockStatus ?? overseerState.infoWeNeed.stockStatus,
        allPartsAddressed: analysis.updatedTracking?.allPartsAddressed ?? overseerState.infoWeNeed.allPartsAddressed,
      },
      infoTheyWant: analysis.updatedTracking?.infoTheyWant ?? overseerState.infoTheyWant,
      negotiationNotes: overseerState.negotiationNotes,
      // Cap flaggedIssues at 20 most recent to prevent unbounded growth in Redis
      flaggedIssues: analysis.flaggedIssue
        ? [...overseerState.flaggedIssues, analysis.flaggedIssue].slice(-20)
        : overseerState.flaggedIssues,
    };

    return { nudge, updatedState, event };
  } catch (error: any) {
    logger.error(
      { callId: callState.callId, turn: turnNumber, error: error.message },
      'Overseer analysis failed',
    );

    // Return unchanged state on error — never block the call
    return {
      nudge: null,
      updatedState: { ...overseerState, lastAnalyzedTurn: turnNumber },
      event: null,
    };
  }
}
