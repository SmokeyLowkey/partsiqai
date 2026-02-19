/**
 * LangGraph-based VOIP Call Orchestration
 * 
 * This module manages the state machine for supplier phone calls.
 * Each node represents a step in the conversation flow.
 */

import { CallState, ExtractedQuote } from './types';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import { OverseerNudge } from './overseer/types';
import {
  getLastSupplierResponse,
  addMessage,
  classifyIntent,
  extractPricing,
  extractSubstituteInfo,
  detectQuestion,
  containsRefusal,
  generateClarification,
  determineOutcome,
  formatPartNumberForSpeech,
  formatPartNumberPhonetic,
  formatPartNumbersInText,
  isAskingToRepeat,
  isVerificationQuestion,
  isHoldAudio,
  detectBotScreening,
  generateScreeningResponse,
  hasPricingForAllParts,
  detectSubstitute,
  detectFitmentRejection,
} from './helpers';

// ============================================================================
// NODE IMPLEMENTATIONS
// ============================================================================

/**
 * Greeting Node - Initial message to supplier
 * If this is the first greeting, ask for parts department.
 * If we've already greeted (e.g., after a transfer), re-introduce briefly.
 * If we're waiting for a transfer and hear hold audio, stay silent.
 */
export function greetingNode(state: CallState): CallState {
  const orgName = state.organizationName || '';
  const orgIntro = orgName ? ` I'm calling from ${orgName}.` : '';

  // If waiting for transfer, check if we're hearing hold music/ads
  if (state.waitingForTransfer) {
    const lastResponse = getLastSupplierResponse(state);
    if (isHoldAudio(lastResponse)) {
      // Stay silent — don't greet the hold music. Keep waiting.
      return state;
    }
    // Real person picked up — clear the flag and re-introduce
    const transferIntro = state.isFollowUp
      ? `Hi there! Thanks for taking my call.${orgIntro} I'm calling to follow up on a parts quote we requested recently.`
      : `Hi there! Thanks for taking my call.${orgIntro} I'm looking to get pricing on some parts.`;
    return {
      ...addMessage({ ...state, waitingForTransfer: false }, 'ai', transferIntro),
    };
  }

  // If we've already progressed past greeting (been to quote_request), NEVER
  // re-ask for parts department. Use a brief re-intro instead.
  // This prevents the agent from asking "Could I speak to parts?" 3x in a row
  // after hold/transfer cycles.
  const alreadyInQuoteFlow = state.conversationHistory.some(
    msg => msg.speaker === 'ai' && (
      msg.text.toLowerCase().includes("i'm looking for") ||
      msg.text.toLowerCase().includes("i have the part numbers") ||
      msg.text.toLowerCase().includes("part number is") ||
      msg.text.toLowerCase().includes("following up")
    )
  );

  if (alreadyInQuoteFlow) {
    const reintro = state.isFollowUp
      ? `Hi there! Thanks for taking my call.${orgIntro} I'm calling to follow up on a parts quote we requested recently.`
      : `Hi there! Thanks for taking my call.${orgIntro} I'm looking to get pricing on some parts.`;
    return addMessage(state, 'ai', reintro);
  }

  const alreadyGreeted = state.conversationHistory.some(
    msg => msg.speaker === 'ai' && msg.text.includes('parts department')
  );

  if (!alreadyGreeted) {
    return addMessage(state, 'ai',
      `Hi, good morning!${orgIntro} Could I speak to someone in your parts department?`
    );
  }

  // After transfer — re-introduce. For follow-up calls, reference the previous interaction.
  if (state.isFollowUp) {
    return addMessage(state, 'ai',
      `Hi there! Thanks for taking my call.${orgIntro} I'm calling to follow up on a parts quote we requested recently.`
    );
  }

  return addMessage(state, 'ai',
    `Hi there! Thanks for taking my call.${orgIntro} I'm looking to get pricing on some parts.`
  );
}

/**
 * Quote Request Node - Ask for pricing on specific parts
 * Delivers parts one at a time for clarity:
 * 1st visit: mention descriptions naturally
 * 2nd visit: give first part number
 * 3rd+ visit: give next part number (or recap if all given)
 */
export function quoteRequestNode(state: CallState): CallState {
  const lastSupplierMsg = getLastSupplierResponse(state);

  // Guard: if we've already given all parts and recapped, don't repeat the recap.
  // Produce a brief, contextual acknowledgment instead.
  if (state.allPartsRequested) {
    return addMessage(state, 'ai', "Yes, that's right. Take your time.");
  }

  // If supplier is asking us to repeat, use phonetic alphabet
  if (isAskingToRepeat(lastSupplierMsg)) {
    // Find the last part number we mentioned
    const lastPartMsg = [...state.conversationHistory]
      .reverse()
      .find(msg => msg.speaker === 'ai' && state.parts.some(p =>
        msg.text.toLowerCase().includes(p.partNumber.toLowerCase().slice(0, 4))
      ));

    // Find which part was being discussed
    const currentPart = state.parts.find(p =>
      lastPartMsg?.text.toLowerCase().includes(p.partNumber.toLowerCase().slice(0, 4))
    ) || state.parts[0];

    const phonetic = formatPartNumberPhonetic(currentPart.partNumber);
    return addMessage(state, 'ai',
      `Sure, let me spell that out for you. ${phonetic}. That's for the ${currentPart.description}.`
    );
  }

  // Check if we've already mentioned what we're looking for
  const alreadyMentionedParts = state.conversationHistory.some(
    msg => msg.speaker === 'ai' && (
      msg.text.toLowerCase().includes("i'm looking for") ||
      msg.text.toLowerCase().includes("recently got a quote")
    )
  );

  if (!alreadyMentionedParts) {
    // First time - mention what we need

    // For follow-up calls, reference the previous interaction and explain purpose
    if (state.isFollowUp && state.customInstructions) {
      const descriptions = state.parts
        .filter(p => p.partNumber !== 'MISC-COSTS')
        .map(p => describePartNaturally(p.description, p.quantity))
        .join(', and ');

      const isSinglePart = state.parts.filter(p => p.partNumber !== 'MISC-COSTS').length === 1;
      const request = `Great, thanks! We recently got a quote for ${descriptions} and I'm following up on ${isSinglePart ? 'it' : 'those'}. I have the part ${isSinglePart ? 'number' : 'numbers'} if that helps.`;
      return addMessage(state, 'ai', request);
    }

    // Standard first-call flow
    const descriptions = state.parts
      .map(p => describePartNaturally(p.description, p.quantity))
      .join(', and ');

    const hasUnverifiedParts = state.parts.some(p => p.source === 'WEB_SEARCH');

    const isSinglePart = state.parts.length === 1;
    let request = `Great, thanks! I'm looking for ${descriptions}. Whenever you're ready, I have the part ${isSinglePart ? 'number' : 'numbers'}.`;
    if (hasUnverifiedParts) {
      if (isSinglePart) {
        request += ` I should mention, I found this part number online so I'll need to verify it's correct for my machine.`;
      } else {
        request += ` I should mention, I found some of these part numbers online so I'll need to verify they're correct for my machine.`;
      }
    }
    return addMessage(state, 'ai', request);
  }

  // Determine how many part numbers we've already given
  const givenPartNumbers = state.parts.filter(p =>
    state.conversationHistory.some(
      msg => msg.speaker === 'ai' && msg.text.includes(formatPartNumberForSpeech(p.partNumber))
    )
  );

  const nextPart = state.parts.find(p => !givenPartNumbers.includes(p));

  if (nextPart) {
    const partNum = formatPartNumberForSpeech(nextPart.partNumber);
    const isFirst = givenPartNumbers.length === 0;
    const remaining = state.parts.length - givenPartNumbers.length - 1;
    const isUnverified = nextPart.source === 'WEB_SEARCH';

    let request: string;
    if (isFirst) {
      const isSinglePart = state.parts.length === 1;
      request = isSinglePart
        ? `Sure! The part number is... ${partNum}. That's the ${nextPart.description}.`
        : `Sure! The first part number is... ${partNum}. That's the ${nextPart.description}.`;
      if (isUnverified) {
        request += ` Now, I found this one online so could you verify it's the right fit for my machine?`;
      }
      if (remaining > 0) {
        request += ` I have ${remaining} more after this one.`;
      }
    } else {
      request = `Next one is... ${partNum}. That's the ${nextPart.description}.`;
      if (isUnverified) {
        request += ` This one also needs to be verified for my machine.`;
      }
    }

    return addMessage(state, 'ai', request);
  }

  // All part numbers given - recap (only sent once).
  // Use the latest part numbers — if a substitute was provided, use that instead of the original.
  const substitutedOriginals = new Set(
    state.quotes.filter(q => q.isSubstitute && q.originalPartNumber).map(q => q.originalPartNumber!)
  );
  const activeParts = state.parts.filter(p => !substitutedOriginals.has(p.partNumber));

  const allParts = activeParts
    .map(p => formatPartNumberForSpeech(p.partNumber))
    .join('... and ');

  return {
    ...addMessage(state, 'ai',
      `So those were: ${allParts}. Can you check pricing and availability on all of those?`
    ),
    allPartsRequested: true,
  };
}

/**
 * Describe a part with natural quantity phrasing
 * qty 1 → "a boom hydraulic cylinder"
 * qty 2 → "a couple of boom hydraulic cylinders"
 * qty 3+ → "3 boom hydraulic cylinders"
 */
function describePartNaturally(description: string, quantity: number): string {
  if (quantity === 1) return `a ${description}`;
  if (quantity === 2) return `a couple of ${description}s`;
  return `${quantity} ${description}s`;
}

/**
 * Price Extract Node - Record prices from supplier.
 * Also handles substitute part numbers without pricing by falling back
 * to extractSubstituteInfo() when extractPricing() returns nothing.
 */
export async function priceExtractNode(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<CallState> {
  const lastResponse = getLastSupplierResponse(state);
  const recentHistory = state.conversationHistory.slice(-8);
  const extractedQuotes = await extractPricing(llmClient, lastResponse, state.parts, recentHistory);

  if (extractedQuotes.length > 0) {
    // Use mergeExtractedQuotes to handle substitutes — adds new part numbers
    // to state.parts and deduplicates quotes
    const mergedState = mergeExtractedQuotes(state, extractedQuotes);
    return {
      ...mergedState,
      status: extractedQuotes.some(q => q.price) ? 'in_progress' : mergedState.status,
    };
  }

  // extractPricing returned nothing — but the supplier may have offered a substitute
  // part number WITHOUT pricing (e.g., "the new part number is D27-1016-0160P").
  // Try extractSubstituteInfo() to capture just the part number.
  if (detectSubstitute(lastResponse) || detectFitmentRejection(lastResponse)) {
    const subInfo = await extractSubstituteInfo(llmClient, lastResponse, state.parts, recentHistory);
    if (subInfo) {
      // Record the substitute as a quote entry (no price yet)
      const substituteQuote = {
        partNumber: subInfo.substitutePartNumber,
        availability: 'in_stock' as const,
        isSubstitute: true,
        originalPartNumber: subInfo.originalPartNumber,
        notes: subInfo.notes || 'Substitute offered by supplier — awaiting pricing',
      };
      return mergeExtractedQuotes(state, [substituteQuote]);
    }
  }

  return state;
}

/**
 * Negotiate Node - Counter-offer if price too high.
 * Strategy: Bundle first (when multiple parts over budget), then per-part fallback.
 * Never reveals actual target price or budget numbers.
 */
export function negotiateNode(state: CallState): CallState {
  const NEGOTIATION_THRESHOLD = 0.20;

  // Find all quotes that exceed their part's budget by >20%
  const overBudgetParts: Array<{ quote: ExtractedQuote; partNumber: string }> = [];

  for (const q of state.quotes) {
    if (!q.price) continue;
    const matchingPart = state.parts.find(p =>
      p.partNumber === q.partNumber || p.partNumber === q.originalPartNumber
    );
    if (matchingPart?.budgetMax && q.price > matchingPart.budgetMax * (1 + NEGOTIATION_THRESHOLD)) {
      overBudgetParts.push({ quote: q, partNumber: q.partNumber });
    }
  }

  if (overBudgetParts.length === 0) {
    return state; // No negotiation needed
  }

  let negotiationScript: string;

  if (state.negotiationAttempts === 0) {
    // First attempt: bundle if multiple, single-part if one
    if (overBudgetParts.length >= 2) {
      negotiationScript = "The pricing is coming in a bit higher than what we've been seeing in the market. " +
        "If we're placing the full order with you, is there any flexibility on the overall pricing?";
    } else {
      const pn = formatPartNumberForSpeech(overBudgetParts[0].partNumber);
      negotiationScript = `The price on ${pn} is a bit higher than what we've been seeing. Any flexibility there?`;
    }
  } else {
    // Retry: per-part fallback — pick the most over-budget part
    const pn = formatPartNumberForSpeech(overBudgetParts[0].partNumber);
    negotiationScript = `I understand. What about on ${pn} — any room to come down on that one?`;
  }

  // NOTE: Don't populate negotiatedParts here — that happens when negotiation
  // concludes (in processCallTurn after routeFromNegotiation exits to confirmation).
  // Populating it here would prevent the retry attempt from finding any parts.

  return {
    ...addMessage(state, 'ai', negotiationScript),
    negotiationAttempts: state.negotiationAttempts + 1,
  };
}

/**
 * Confirmation Node - Confirm the quote details
 * Does NOT set status to 'completed' — waits for supplier acknowledgment.
 * If supplier corrects, routeFromConfirmation will re-extract pricing.
 */
export function confirmationNode(state: CallState): CallState {
  const quotes = state.quotes.filter(q => q.price);

  if (quotes.length === 0) {
    // Before giving up, check if the supplier was engaged and providing info.
    // If we've had more than 6 exchanges, the supplier was likely helping —
    // ask if they can send a quote via email rather than abruptly hanging up.
    const supplierMessages = state.conversationHistory.filter(m => m.speaker === 'supplier');
    if (supplierMessages.length > 3) {
      return {
        ...addMessage(state, 'ai',
          "I appreciate all your help. Could you send us a formal quote via email with the pricing details? That would be great."
        ),
        status: 'completed',
      };
    }

    return {
      ...addMessage(state, 'ai',
        "Thank you for your time. We'll follow up via email with the details."
      ),
      status: 'completed',
    };
  }

  const quotesSummary = quotes
    .map(q => {
      const partNum = formatPartNumberForSpeech(q.partNumber);
      const substituteNote = q.isSubstitute && q.originalPartNumber
        ? ` (replacing ${formatPartNumberForSpeech(q.originalPartNumber)})`
        : '';
      const availText = q.availability === 'in_stock' ? 'in stock'
        : q.availability === 'backorder' ? 'on back order'
        : q.availability === 'unavailable' ? 'unavailable'
        : q.availability;
      return `${partNum}${substituteNote} at $${q.price?.toFixed(2)}, ${availText}`;
    })
    .join(', and ');

  return addMessage(state, 'ai',
    `Perfect. Just to confirm: ${quotesSummary}. Does that all sound right?`
  );
}

/**
 * Voicemail Node - Leave a voicemail message
 */
export function voicemailNode(state: CallState): CallState {
  const message = `Hi, this is a message for the parts procurement team at ${state.supplierName}. 
We're calling on behalf of ${state.organizationName} to request pricing for equipment parts. 
The quote reference is ${state.quoteReference}. 
Please call us back or we'll follow up via email with the full details. Thank you.`;

  return {
    ...addMessage(state, 'ai', message),
    status: 'completed',
    outcome: 'VOICEMAIL_LEFT',
    nextAction: 'email_fallback',
  };
}

/**
 * Transfer Node - Ask to be transferred to right person
 * Used when we need to REQUEST a transfer (e.g., wrong department)
 */
export function transferNode(state: CallState): CallState {
  const message = `I understand. Could you transfer me to someone who handles parts pricing, or provide their direct number?`;

  return {
    ...addMessage(state, 'ai', message),
    needsTransfer: true,
  };
}

/**
 * Hold Acknowledgment Node - Supplier is transferring us or putting us on hold.
 * Only sets waitingForTransfer when the hold is actually a transfer (detected from
 * the last AI message being a greeting or transfer request).
 * When the supplier is just looking something up, acknowledge without the flag.
 */
export function holdAcknowledgmentNode(state: CallState): CallState {
  // Detect if this hold is actually a transfer by checking the last AI message.
  // Note: we can't use state.currentNode — by the time this node runs, currentNode
  // is already 'hold_acknowledgment' (set by the previous turn's routing).
  const lastAiMsg = (state.conversationHistory
    .filter(m => m.speaker === 'ai')
    .pop()?.text || '').toLowerCase();
  const isTransfer = lastAiMsg.includes('parts department') ||
    lastAiMsg.includes('transfer me') ||
    lastAiMsg.includes('direct number') ||
    state.needsTransfer;

  return {
    ...addMessage(state, 'ai', `Sure, no problem! Take your time.`),
    waitingForTransfer: isTransfer,
  };
}

/**
 * Human Escalation Node - Too complex for AI
 */
export function humanEscalationNode(state: CallState): CallState {
  const message = `I appreciate your patience. This request requires some additional details. 
Let me connect you with one of our team members who can help. 
Please hold for just a moment, or we can have someone call you back within the hour.`;

  return {
    ...addMessage(state, 'ai', message),
    status: 'escalated',
    needsHumanEscalation: true,
    nextAction: 'human_followup',
  };
}

/**
 * Clarification Node - Restate request when supplier is confused
 */
export async function clarificationNode(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<CallState> {
  const lastResponse = getLastSupplierResponse(state);
  const clarification = await generateClarification(llmClient, lastResponse, state.parts);

  return {
    ...addMessage(state, 'ai', clarification),
    clarificationAttempts: state.clarificationAttempts + 1,
  };
}

/**
 * Callback Node - Supplier will call back
 */
export function callbackNode(state: CallState): CallState {
  const message = `Of course. The quote reference is ${state.quoteReference}. 
We'll also send you an email with the part details. 
If we don't hear back by end of day, we'll give you a follow-up call. Thank you!`;

  return {
    ...addMessage(state, 'ai', message),
    status: 'completed',
    outcome: 'CALLBACK_REQUESTED',
    nextAction: 'email_fallback',
  };
}

/**
 * Polite End Node - End call gracefully
 * This is the only node that sets status to 'completed' (besides no-quotes confirmation).
 */
export function politeEndNode(state: CallState): CallState {
  const hasQuotes = state.quotes.some(q => q.price);
  const message = hasQuotes
    ? "Great! We'll send a formal quote request via email to finalize. Thank you so much for your help, have a great day!"
    : "I understand. Thank you for your time. Have a great day!";

  return {
    ...addMessage(state, 'ai', message),
    status: 'completed',
  };
}

/**
 * Bot Screening Node - Respond to automated call screening bots
 */
export function botScreeningNode(state: CallState): CallState {
  const lastResponse = getLastSupplierResponse(state);
  const screeningType = detectBotScreening(lastResponse);

  if (!screeningType) {
    // No bot detected — shouldn't reach here, but safe fallback
    return state;
  }

  // Spam rejection → end the call
  if (screeningType === 'spam_rejection') {
    const response = generateScreeningResponse(screeningType, state);
    return {
      ...addMessage(state, 'ai', response),
      botScreeningDetected: true,
      botScreeningAttempts: state.botScreeningAttempts + 1,
      outcome: 'BOT_REJECTED',
      nextAction: 'email_fallback',
    };
  }

  const response = generateScreeningResponse(screeningType, state);
  return {
    ...addMessage(state, 'ai', response),
    botScreeningDetected: true,
    botScreeningAttempts: state.botScreeningAttempts + 1,
  };
}

/**
 * Misc Costs Inquiry Node - Ask about shipping/freight after main quotes collected
 * Only triggered when parts are backordered/being shipped
 */
export function miscCostsInquiryNode(state: CallState): CallState {
  const message = "One more thing — would the parts need to be shipped out, and if so, are there any freight or shipping costs we should know about?";
  return {
    ...addMessage(state, 'ai', message),
    miscCostsAsked: true,
  };
}

/**
 * Merge extracted quotes into state, handling substitute parts.
 * If a quote has isSubstitute=true and a new part number, the substitute
 * is added to state.parts so the recap and confirmation nodes know about it.
 */
function mergeExtractedQuotes(
  state: CallState,
  extractedQuotes: Array<{
    partNumber: string;
    price?: number;
    availability: 'in_stock' | 'backorder' | 'unavailable';
    leadTimeDays?: number;
    notes?: string;
    isSubstitute?: boolean;
    originalPartNumber?: string;
  }>
): CallState {
  let updatedParts = [...state.parts];
  const updatedQuotes = [...state.quotes];

  for (const quote of extractedQuotes) {
    // Add or update the quote
    const existingIdx = updatedQuotes.findIndex(q => q.partNumber === quote.partNumber);
    if (existingIdx >= 0) {
      updatedQuotes[existingIdx] = { ...updatedQuotes[existingIdx], ...quote };
    } else {
      updatedQuotes.push(quote);
    }

    // If this is a substitute part not yet in our parts list, add it
    if (quote.isSubstitute && quote.originalPartNumber) {
      const alreadyTracked = updatedParts.some(p => p.partNumber === quote.partNumber);
      if (!alreadyTracked) {
        // Find the original part to copy description/quantity from
        const originalPart = updatedParts.find(p => p.partNumber === quote.originalPartNumber);
        if (originalPart) {
          updatedParts.push({
            ...originalPart,
            partNumber: quote.partNumber,
            source: originalPart.source,
          });
        }
      }
    }
  }

  return {
    ...state,
    parts: updatedParts,
    quotes: updatedQuotes,
  };
}

/**
 * Check if we should ask about misc costs (shipping/freight)
 * Only relevant when parts need shipping (not in-stock at branch)
 */
function shouldAskMiscCosts(state: CallState): boolean {
  if (!state.hasMiscCosts || state.miscCostsAsked) return false;
  return state.quotes.some(q =>
    q.availability === 'backorder' || q.availability === 'unavailable'
  );
}

/**
 * Determine next node when pricing is complete (or we think it is).
 * Checks for uncovered parts before allowing confirmation.
 */
function nextNodeAfterPricing(state: CallState): string {
  // Check for parts that have NO quotes at all (not even unavailable/substitute).
  // Exclude MISC-COSTS as that's a virtual part for shipping fees.
  const uncoveredParts = state.parts.filter(part =>
    part.partNumber !== 'MISC-COSTS' &&
    !state.quotes.some(q =>
      q.partNumber === part.partNumber || q.originalPartNumber === part.partNumber
    )
  );
  const alreadyAskedAboutUncovered = state.conversationHistory.some(
    msg => msg.speaker === 'ai' && msg.text.toLowerCase().includes('before we wrap up')
  );
  if (uncoveredParts.length > 0 && !alreadyAskedAboutUncovered) {
    // Route to conversational_response — the LLM will ask about the uncovered parts
    // (their context is injected via the prompt). Don't use confirmationNode because
    // routeFromConfirmation can't handle pricing/hold responses from the supplier.
    return 'conversational_response';
  }

  if (shouldAskMiscCosts(state)) return 'misc_costs_inquiry';
  return 'confirmation';
}

/**
 * Conversational Response Node - Handle follow-up questions and clarifications
 * Uses LLM to generate contextually appropriate responses based on conversation history
 */
/**
 * Build the prompt for conversational response generation.
 * Shared by both streaming and non-streaming paths.
 */
function buildConversationalPrompt(state: CallState, lastResponse: string, nudge?: OverseerNudge | null): string {
  const conversationContext = state.conversationHistory
    .slice(-6)
    .map(msg => `${msg.speaker === 'ai' ? 'You' : 'Supplier'}: ${msg.text}`)
    .join('\n');

  const partsContext = state.parts
    .map(p => `${p.partNumber} (${p.description}) - Qty: ${p.quantity}`)
    .join(', ');

  const substituteQuotes = state.quotes.filter(q => q.isSubstitute && q.originalPartNumber);
  let substituteContext = '';
  if (substituteQuotes.length > 0) {
    substituteContext = '\n\nSUBSTITUTE PARTS ALREADY IDENTIFIED:\n' +
      substituteQuotes.map(q => {
        const priceNote = q.price != null ? ` — quoted at $${q.price.toFixed(2)}` : ' — AWAITING PRICING';
        return `- ${q.partNumber} replaces ${q.originalPartNumber}${priceNote}`;
      }).join('\n') +
      '\nDo NOT ask about the original part numbers listed above — they have been superseded. Ask for pricing on the substitute if not yet quoted.\n';
  }

  const uncoveredParts = state.parts.filter(part =>
    part.partNumber !== 'MISC-COSTS' &&
    !state.quotes.some(q =>
      q.partNumber === part.partNumber || q.originalPartNumber === part.partNumber
    )
  );
  let uncoveredContext = '';
  if (uncoveredParts.length > 0) {
    uncoveredContext = '\n\nPARTS STILL NEEDING QUOTES:\n' +
      uncoveredParts.map(p => `- ${p.partNumber}: ${p.description}`).join('\n') +
      '\nYou MUST ask the supplier about these parts if they haven\'t been discussed yet. Say something like "Could you also check on [part number]?"\n';
  }

  const additionalContext = state.customContext || '';
  const followUpContext = state.isFollowUp && state.customInstructions
    ? `\nFOLLOW-UP CALL PURPOSE: ${state.customInstructions}\nThis is a follow-up call. Reference the previous quote when relevant. Focus on the follow-up objectives.\n`
    : '';

  return `You are on a phone call getting quotes for parts. Answer the supplier's question naturally.

Context: ${additionalContext}
${followUpContext}
Parts you need quotes for: ${partsContext}${substituteContext}${uncoveredContext}

Recent conversation:
${conversationContext}

Supplier just said: "${lastResponse}"

IMPORTANT RULES:
- If the supplier says a part number is wrong, doesn't fit, or has been superseded — ACCEPT their correction immediately. Say something like "Got it, so the new part number is [what they said]. What's the price on that one?" Do NOT re-request or re-verify the original part number.
- If the supplier is giving you a NEW/SUBSTITUTE part number, acknowledge it clearly and ask for pricing on it.
- If the supplier is looking something up or asks you to wait, acknowledge patiently ("Sure, take your time").
- If the supplier is giving you pricing or part information, acknowledge it and confirm.
- If you already know about a substitute (listed above), use the SUBSTITUTE part number, not the original.
- NEVER ask the supplier to "write down" or "email" a part number — you are on a phone call, just ask them to repeat it slowly if needed.
- NEVER commit to purchasing or ordering. You are ONLY collecting price quotes. Do NOT say "I'll take it", "I'll order that", "put me down for one", "let's go ahead with that", etc. Instead say "Got it, thanks" or "That's helpful, thank you."
- If the supplier asks about an account, say you're not sure and the team will follow up via email.
- If the supplier asks for your name, who you are, or who's calling: say you're calling on behalf of ${state.callerName ? `${state.callerName} at ${state.organizationName}` : state.organizationName}. If they ask for a phone number, say they can reach us at the number you're calling from.
- If the supplier asks for a shipping address or destination, say you'll confirm the exact address via email but ask if they can give a ballpark shipping estimate.
- ONE THING AT A TIME: If the supplier asks you a question (name, account, etc.), answer ONLY that question. Do NOT bundle a part number request into the same response — wait for the next turn to continue with parts. Keep each response focused on one topic.

PART NUMBER FORMATTING — CRITICAL:
- When referencing part numbers, write them in their EXACT alphanumeric format (e.g., AT495366, AT514800).
- NEVER attempt to spell out part numbers using words — the system will format them for speech automatically.
- NEVER read digit sequences as whole numbers (e.g., do NOT say "five hundred fourteen thousand eight hundred" for 514800).
- Keep part number references short and exact. Example: "AT495366" not "alpha tango four nine five three six six".

Respond in 1-2 sentences. Don't add meta-commentary — just give the direct response.${nudge ? formatNudgeForPrompt(nudge) : ''}`;
}

/** Format an Overseer nudge for injection into the voice agent prompt */
function formatNudgeForPrompt(nudge: OverseerNudge): string {
  const priorityLabels: Record<string, string> = {
    P0: 'CRITICAL — you MUST address this in your next response',
    P1: 'IMPORTANT — you SHOULD address this',
    P2: 'SUGGESTION — consider this if natural',
  };
  const label = priorityLabels[nudge.priority] || nudge.priority;
  const phaseNote = nudge.phaseTransition
    ? `\nPHASE TRANSITION: Move to ${nudge.phaseTransition} phase.`
    : '';

  return `

SUPERVISOR GUIDANCE (from your call supervisor — follow these instructions):
[${nudge.priority}] ${label}: ${nudge.text}${phaseNote}`;
}

/** Clean meta-commentary from LLM response */
function cleanMetaCommentary(response: string): string {
  return response
    .replace(/^(here'?s? my (response|result|answer):?|my (response|result|answer):?)\s*/i, '')
    .trim();
}

export async function conversationalResponseNode(
  llmClient: OpenRouterClient,
  state: CallState,
  nudge?: OverseerNudge | null,
): Promise<CallState> {
  const lastResponse = getLastSupplierResponse(state);
  const prompt = buildConversationalPrompt(state, lastResponse, nudge);

  try {
    let response = await llmClient.generateCompletion(prompt, {
      temperature: 0.4,
      model: llmClient.getVoiceModel(),
      maxTokens: 150,
    });

    response = cleanMetaCommentary(response);
    response = formatPartNumbersInText(response, state.parts);

    return addMessage(state, 'ai', response);
  } catch (error) {
    console.error('Conversational response generation error:', error);
    return addMessage(state, 'ai', "Could you repeat that?");
  }
}

/**
 * Streaming variant of conversationalResponseNode.
 * Yields processed sentence chunks via callback for real-time SSE to VAPI.
 * Uses sentence-level buffering so part number formatting works correctly.
 */
export async function streamConversationalResponse(
  llmClient: OpenRouterClient,
  state: CallState,
  onSentence: (sentence: string) => void,
  nudge?: OverseerNudge | null,
): Promise<CallState> {
  const lastResponse = getLastSupplierResponse(state);
  const prompt = buildConversationalPrompt(state, lastResponse, nudge);

  try {
    const messages: Array<{ role: 'user'; content: string }> = [
      { role: 'user', content: prompt },
    ];

    let fullResponse = '';
    let sentenceBuffer = '';
    let isFirstSentence = true;

    const SENTENCE_TERMINATORS = /[.?!]\s*$/;
    const MAX_BUFFER_TOKENS = 50;
    let bufferTokenCount = 0;

    for await (const token of llmClient.streamChat(messages, {
      temperature: 0.4,
      model: llmClient.getVoiceModel(),
      maxTokens: 150,
    })) {
      fullResponse += token;
      sentenceBuffer += token;
      bufferTokenCount++;

      const hasSentenceEnd = SENTENCE_TERMINATORS.test(sentenceBuffer);
      const bufferOverflow = bufferTokenCount >= MAX_BUFFER_TOKENS;

      if (hasSentenceEnd || bufferOverflow) {
        let processed = sentenceBuffer;
        if (isFirstSentence) {
          processed = cleanMetaCommentary(processed);
          isFirstSentence = false;
        }
        processed = formatPartNumbersInText(processed.trim(), state.parts);

        if (processed.length > 0) {
          onSentence(processed);
        }

        sentenceBuffer = '';
        bufferTokenCount = 0;
      }
    }

    // Flush remaining buffer
    if (sentenceBuffer.trim().length > 0) {
      let processed = sentenceBuffer;
      if (isFirstSentence) {
        processed = cleanMetaCommentary(processed);
      }
      processed = formatPartNumbersInText(processed.trim(), state.parts);
      if (processed.length > 0) {
        onSentence(processed);
      }
    }

    // Store cleaned full response in state
    fullResponse = cleanMetaCommentary(fullResponse);
    fullResponse = formatPartNumbersInText(fullResponse, state.parts);

    return addMessage(state, 'ai', fullResponse);
  } catch (error) {
    console.error('Streaming conversational response error:', error);
    throw error;
  }
}

// ============================================================================
// ROUTING LOGIC
// ============================================================================

/**
 * Route from greeting based on supplier response
 */
export async function routeFromGreeting(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<string> {
  const lastResponse = getLastSupplierResponse(state);
  const lower = lastResponse.toLowerCase();

  // Check for bot screening BEFORE the LLM call
  const screeningType = detectBotScreening(lastResponse);
  if (screeningType) return 'bot_screening';

  // Fast path: supplier is ALREADY transferring — just acknowledge and wait
  const holdPatterns = [
    'one moment', 'just a moment', 'hold on', 'hold please',
    'let me transfer', 'i\'ll transfer', 'i will transfer',
    'transferring you', 'putting you through', 'one second',
    'just a sec', 'hang on', 'one sec',
  ];
  if (holdPatterns.some(p => lower.includes(p))) {
    return 'hold_acknowledgment';
  }

  // Fast path: obvious engagement patterns — skip LLM classification
  const engagementPatterns = [
    'speaking', 'this is parts', 'parts department', 'how can i help',
    'what do you need', 'go ahead', 'what can i do for you',
    'yes this is', 'yeah this is',
  ];
  if (engagementPatterns.some(p => lower.includes(p))) {
    return 'quote_request';
  }

  // Fast path: receptionist/gatekeeper asking for caller info — answer their
  // question so they can transfer us to the right person.
  const receptionistPatterns = [
    'who\'s calling', 'who is calling', 'who am i speaking',
    'your name', 'who are you', 'what company', 'calling from',
    'what is this regarding', 'what\'s this about', 'what is this about',
    'what are you calling about', 'reason for your call',
    'may i ask who', 'can i ask who',
  ];
  if (receptionistPatterns.some(p => lower.includes(p))) {
    return 'conversational_response';
  }

  const intent = await classifyIntent(llmClient, lastResponse, [
    'yes_can_help',
    'transfer_needed',
    'not_interested',
    'voicemail',
  ]);

  switch (intent) {
    case 'yes_can_help':
      return 'quote_request';
    case 'transfer_needed':
      return 'transfer';
    case 'not_interested':
      return 'polite_end';
    case 'voicemail':
      return 'voicemail';
    default:
      return 'clarification';
  }
}

/**
 * Route from bot screening based on next supplier response
 */
export async function routeFromBotScreening(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<string> {
  // Check if the last response was a spam rejection (already handled in node)
  if (state.outcome === 'BOT_REJECTED') return 'polite_end';

  // Max attempts exceeded — give up
  if (state.botScreeningAttempts >= state.botScreeningMaxAttempts) return 'polite_end';

  const lastResponse = getLastSupplierResponse(state);
  const screeningType = detectBotScreening(lastResponse);

  // Still being screened → loop back
  if (screeningType) return 'bot_screening';

  // No bot pattern → human is now on the line, delegate to normal routing
  return routeFromGreeting(llmClient, state);
}

/**
 * Route from quote request based on supplier response
 */
export async function routeFromQuoteRequest(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<string> {
  const lastResponse = getLastSupplierResponse(state);
  const lower = lastResponse.toLowerCase();

  // Check for callback request
  if (lower.includes('call back') || lower.includes('call you back')) {
    return 'callback';
  }

  // Contact info request — supplier asks for name, phone, account, email, etc.
  // Must be checked EARLY so the agent doesn't ignore it and blurt out a part number.
  const contactInfoPatterns = [
    'your name', 'your phone', 'your number', 'phone number',
    'who am i speaking', 'who is this', 'who\'s calling',
    'account number', 'your account', 'your email', 'email address',
    'company name', 'calling from',
  ];
  if (contactInfoPatterns.some(p => lower.includes(p))) {
    return 'conversational_response';
  }

  // Hold/wait patterns — supplier is looking something up or asks us to wait.
  // Must be checked EARLY to avoid re-requesting parts while they're working.
  const holdPatterns = [
    'one moment', 'just a moment', 'hold on', 'hold please',
    'one second', 'just a sec', 'hang on', 'one sec',
    'give me a moment', 'give me a sec', 'give me a minute',
    'let me check', 'let me look', 'let me pull', 'let me see',
    'let me find', 'let me get', 'let me grab',
    'bear with me', 'hang tight', 'just a minute',
    'looking that up', 'checking on that', 'pulling that up',
  ];
  if (holdPatterns.some(p => lower.includes(p))) {
    return 'hold_acknowledgment';
  }

  // Check if supplier is asking a verification question (serial number, machine, fitment).
  // Must be checked BEFORE repeat detection — "what machine is this going on?"
  // contains "what" which could false-match repeat patterns, but it's a verification question.
  if (isVerificationQuestion(lastResponse)) {
    return 'conversational_response'; // Answer their question, don't end
  }

  // Check if supplier is asking to repeat part numbers
  if (isAskingToRepeat(lastResponse)) {
    return 'quote_request'; // Will trigger phonetic spelling
  }

  // Check if supplier says the part doesn't fit, is wrong, or must be purchased differently.
  // Also check for substitutes — fitment rejection often comes WITH a substitute offer.
  if (detectFitmentRejection(lastResponse) || detectSubstitute(lastResponse)) {
    // Route to price_extract — it will try extractPricing() first, and if that
    // returns nothing, fall back to extractSubstituteInfo() to capture the
    // substitute part number even without pricing.
    return 'price_extract';
  }

  // Check if the response likely contains pricing info (quick heuristic).
  // Supplier may give a price AND ask a question in the same message
  // (e.g., "$130.58 each. Do you have an account?"). We must capture
  // the price even when a question is present. But if there's no pricing
  // hint, check questions first — "Do you have an account?" is a normal
  // pre-pricing question the agent needs to answer.
  const looksLikePricing = /\$|\d+\.\d{2}|\b(each|per unit|per piece|apiece|a piece|price is|cost is|that'?s? going to be|that'?ll be|runs? about|looking at|dollars|cents|bucks)\b/i.test(lastResponse);

  if (looksLikePricing) {
    // Heuristic strongly suggests pricing — route directly to price_extract
    // which will call extractPricing() and persist quotes to state.
    // Previously this also called extractPricing() here to confirm, but that
    // was wasteful: the results were discarded and price_extract re-extracted.
    return 'price_extract';
  }

  // Check for questions (when no pricing was found or response doesn't look like pricing)
  const hasQuestion = await detectQuestion(lastResponse);
  if (hasQuestion) {
    if (state.clarificationAttempts >= 2) {
      return 'human_escalation';
    }
    return 'conversational_response';
  }

  // No question and no pricing hint — try extractPricing as fallback
  // (supplier may describe availability or pricing without obvious markers).
  // This is the only extractPricing call in the router; it's needed here because
  // the regex heuristic didn't match, so we use the LLM to check for subtle pricing.
  // If pricing IS found, price_extract will re-extract — acceptable tradeoff for
  // this rare edge case vs. adding state complexity to cache the result.
  {
    const recentHistory = state.conversationHistory.slice(-6);
    const extractedQuotes = await extractPricing(llmClient, lastResponse, state.parts, recentHistory);

    if (extractedQuotes.length > 0 && extractedQuotes.some(q => q.price)) {
      return 'price_extract';
    }
  }

  // Check for unavailable/out of stock — but only end if supplier is NOT still
  // checking (e.g., asking for serial number to verify fitment)
  const lowerResponse = lastResponse.toLowerCase();
  if (lowerResponse.includes('don\'t have') ||
      lowerResponse.includes('out of stock') ||
      lowerResponse.includes('unavailable')) {
    // If the same message also contains a question, they're still engaged
    if (await detectQuestion(lastResponse)) {
      return 'conversational_response';
    }
    return nextNodeAfterPricing(state);
  }

  // Check if supplier wants us to give the next part number
  const readyForNext = /\b(next|go ahead|ready|okay|got it|next one|what else|another)\b/i.test(lastResponse);
  if (readyForNext) {
    // Check if there are more parts to give
    const givenParts = state.parts.filter(p =>
      state.conversationHistory.some(
        msg => msg.speaker === 'ai' && msg.text.includes(formatPartNumberForSpeech(p.partNumber))
      )
    );
    if (givenParts.length < state.parts.length) {
      return 'quote_request'; // Give next part number
    }
  }

  // If all parts have been requested, the supplier is likely engaged but
  // saying something we can't neatly categorize. Use conversational response
  // instead of clarification to avoid sounding confused.
  if (state.allPartsRequested) {
    return 'conversational_response';
  }

  // Didn't understand and still early in conversation
  if (state.clarificationAttempts < 2) {
    return 'clarification';
  }

  return 'human_escalation';
}

/**
 * Route from negotiation.
 * Checks for firm-price signals first (accept immediately), then refusal, then new price.
 */
export async function routeFromNegotiation(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<string> {
  if (state.negotiationAttempts >= state.maxNegotiationAttempts) {
    return 'confirmation';
  }

  const lastResponse = getLastSupplierResponse(state);
  const lower = lastResponse.toLowerCase();

  // Firm-price signals — supplier says price is non-negotiable. Accept immediately.
  // Patterns must be specific enough to avoid false matches (e.g., "firm" alone
  // could match "our firm" or "law firm").
  const firmPricePatterns = [
    'best price', 'best i can do', 'price is firm', 'prices are firm',
    'can\'t go lower', 'cannot go lower', 'can\'t go any lower', 'cannot go any lower',
    'that\'s the price', 'that is the price', 'lowest i can go', 'lowest we can go',
    'already discounted', 'already giving you', 'best we can do', 'non-negotiable',
    'set price', 'can\'t budge', 'cannot budge', 'final price',
    'not negotiable', 'price is what it is', 'as low as i can go',
    'as low as we can go', 'no wiggle room', 'no room to move',
  ];
  if (firmPricePatterns.some(p => lower.includes(p))) {
    return 'confirmation';
  }

  if (containsRefusal(lastResponse)) {
    return 'confirmation';
  }

  // Check if they came down in price — route to price_extract so the new price is persisted
  const extractedQuotes = await extractPricing(llmClient, lastResponse, state.parts,
    state.conversationHistory.slice(-6));
  if (extractedQuotes.length > 0 && extractedQuotes.some(q => q.price)) {
    return 'price_extract';
  }

  return 'negotiate'; // Try again
}

/**
 * Route from confirmation - detect agreement vs correction
 * If supplier corrects info, re-extract pricing. If they agree, wrap up.
 */
export async function routeFromConfirmation(
  _llmClient: OpenRouterClient,
  state: CallState
): Promise<string> {
  const lastResponse = getLastSupplierResponse(state);
  const lower = lastResponse.toLowerCase();

  // "No" at the start likely means disagreement with the confirmation
  if (/^no[\s,.]/.test(lower) || lower === 'no') {
    return 'price_extract';
  }

  // Agreement patterns — check BEFORE correction patterns because words like
  // "actually" and "i said" appear in both contexts:
  //   "That's actually correct" → agreement, not correction
  //   "Like I said, sounds good" → agreement, not correction
  const agreePatterns = [
    'yes', 'yeah', 'yep', 'correct', 'that\'s right', 'sounds good',
    'that\'s it', 'perfect', 'mhm', 'uh-huh', 'you got it',
  ];

  const hasAgreement = agreePatterns.some(p => lower.includes(p));

  // Correction patterns — only check when there's NO agreement signal
  if (!hasAgreement) {
    const correctionPatterns = [
      'that\'s wrong', 'that\'s not right', 'incorrect', 'actually',
      'i said', 'they are available', 'it is available', 'in stock',
      'not unavailable', 'we have them', 'i have them', 'they\'re available',
      'let me correct', 'that\'s not correct',
    ];

    if (correctionPatterns.some(p => lower.includes(p))) {
      return 'price_extract';
    }
  }

  if (hasAgreement) {
    // Check if the SAME message also contains a hold/wait signal — supplier
    // confirmed but is still working (e.g., "That sounds correct. Let me get you an ETA. One moment.")
    const holdPatterns = ['one moment', 'hold on', 'let me', 'just a moment', 'one sec', 'give me a', 'bear with'];
    if (holdPatterns.some(p => lower.includes(p))) {
      return 'hold_acknowledgment';
    }

    // Check if the same message ALSO contains a question — supplier confirmed
    // but is asking something (e.g., "Yeah. Do you have an account with us?")
    if (await detectQuestion(lastResponse)) {
      return 'conversational_response';
    }

    return 'polite_end';
  }

  // "Anything else?" type question from supplier — they want to wrap up too
  if (/anything else|is that (all|it|everything)/i.test(lower)) {
    return 'polite_end';
  }

  // Supplier asked a question
  if (await detectQuestion(lastResponse)) {
    return 'conversational_response';
  }

  // Default: assume acknowledgment and wrap up
  return 'polite_end';
}

/**
 * Route from conversational_response node.
 * Extracted so it can be shared by processCallTurn and the streaming handler.
 * May mutate state (e.g., merging extracted quotes).
 */
export async function routeFromConversationalResponse(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<{ nextNode: string; state: CallState }> {
  let newState = state;
  const lastSupplierMsg = getLastSupplierResponse(newState);
  const lastSupplierLower = lastSupplierMsg.toLowerCase();

  // Hold/wait patterns — supplier is looking something up or transferring
  const convHoldPatterns = [
    'one moment', 'just a moment', 'hold on', 'hold please',
    'one second', 'just a sec', 'hang on', 'one sec',
    'give me a moment', 'give me a sec', 'give me a minute',
    'bear with me', 'hang tight', 'just a minute',
    'let me transfer', 'i\'ll transfer', 'i will transfer',
    'transferring you', 'putting you through', 'connect you',
    'let me get', 'let me put you through',
  ];
  if (convHoldPatterns.some(p => lastSupplierLower.includes(p))) {
    return { nextNode: 'hold_acknowledgment', state: newState };
  }

  // Check if supplier is wrapping up the call
  const isWrappingUp = /\b(bye|goodbye|thanks|thank you|have a (good|great|nice) day)\b/i.test(lastSupplierMsg);
  if (isWrappingUp) {
    return { nextNode: 'polite_end', state: newState };
  }

  // If we already have pricing for all parts, move forward — but check if
  // the supplier just asked a question first (shipping address, account, etc.)
  if (hasPricingForAllParts(newState)) {
    if (await detectQuestion(lastSupplierMsg)) {
      return { nextNode: 'conversational_response', state: newState };
    } else {
      return { nextNode: nextNodeAfterPricing(newState), state: newState };
    }
  }

  // Try to extract pricing from current response (with conversation context).
  const convQuotes = await extractPricing(llmClient, lastSupplierMsg, newState.parts,
    newState.conversationHistory.slice(-6));
  if (convQuotes.length > 0 && convQuotes.some(q => q.price)) {
    const mergedState = mergeExtractedQuotes(newState, convQuotes);
    newState = mergedState;
    return { nextNode: nextNodeAfterPricing(mergedState), state: newState };
  }

  // If supplier mentioned a substitute part or fitment rejection, capture it.
  if (detectSubstitute(lastSupplierMsg) || detectFitmentRejection(lastSupplierMsg)) {
    const subHistory = newState.conversationHistory.slice(-8);
    const subQuotes = await extractPricing(llmClient, lastSupplierMsg, newState.parts, subHistory);
    if (subQuotes.length > 0) {
      newState = mergeExtractedQuotes(newState, subQuotes);
    } else {
      const subInfo = await extractSubstituteInfo(llmClient, lastSupplierMsg, newState.parts, subHistory);
      if (subInfo) {
        const substituteQuote = {
          partNumber: subInfo.substitutePartNumber,
          availability: 'in_stock' as const,
          isSubstitute: true,
          originalPartNumber: subInfo.originalPartNumber,
          notes: subInfo.notes || 'Substitute offered by supplier — awaiting pricing',
        };
        newState = mergeExtractedQuotes(newState, [substituteQuote]);
      }
    }
    return { nextNode: 'conversational_response', state: newState };
  }

  // Only go back to quote_request if early AND no pricing collected yet
  if (newState.conversationHistory.length <= 4 && newState.quotes.length === 0) {
    return { nextNode: 'quote_request', state: newState };
  }

  const isQuestion = await detectQuestion(lastSupplierMsg);

  // If supplier is asking a verification question (serial number, fitment),
  // always stay in conversation regardless of turn count
  if (isVerificationQuestion(lastSupplierMsg)) {
    return { nextNode: 'conversational_response', state: newState };
  }

  // If supplier is asking to repeat, go back to quote_request for phonetic spelling
  if (isAskingToRepeat(lastSupplierMsg)) {
    return { nextNode: 'quote_request', state: newState };
  }

  // If supplier says part doesn't fit, stay conversational to get alternatives
  if (detectFitmentRejection(lastSupplierMsg)) {
    return { nextNode: 'conversational_response', state: newState };
  }

  // If supplier is actively offering help or looking something up, NEVER end
  const stillEngaged = /\b(let me|i('ll| will) (give|get|look|check|pull)|give you|here('s| is)|look(ing)? (it |that )?up|one moment|give me a (sec|moment|minute)|checking|pulling (it |that )?up|hold on|just a (sec|moment|minute))\b/i.test(lastSupplierMsg);
  if (stillEngaged) {
    return { nextNode: 'conversational_response', state: newState };
  }

  if (isQuestion && newState.conversationHistory.length > 24) {
    return { nextNode: 'polite_end', state: newState };
  }

  // Check if supplier seems stuck/confused
  const seemsStuck = /\b(what|huh|repeat|again|didn'?t (catch|hear|get) that)\b/i.test(lastSupplierMsg);
  if (seemsStuck && newState.clarificationAttempts < 2) {
    return { nextNode: 'clarification', state: newState };
  }

  return { nextNode: 'conversational_response', state: newState };
}

/**
 * Simple graph execution - processes one turn at a time.
 * Accepts an optional Overseer nudge that is passed through to LLM-powered nodes
 * and checked for phase transition overrides after routing.
 */
export async function processCallTurn(
  llmClient: OpenRouterClient,
  state: CallState,
  nudge?: OverseerNudge | null,
): Promise<CallState> {
  // Already completed or escalated — don't process more turns
  if (state.status === 'completed' || state.status === 'escalated') {
    return state;
  }

  const currentNode = state.currentNode;

  // Pre-routing intercept: scripted nodes (quote_request, confirmation) generate
  // canned responses without considering the supplier's last message. If the supplier
  // just asked a question (name, account, verification, etc.), redirect to
  // conversational_response FIRST so we answer them instead of ignoring their question.
  const lastSupplierMsg = getLastSupplierResponse(state);
  if (lastSupplierMsg && (currentNode === 'quote_request' || currentNode === 'confirmation')) {
    const lower = lastSupplierMsg.toLowerCase();
    const contactInfoPatterns = [
      'your name', 'your phone', 'your number', 'phone number',
      'who am i speaking', 'who is this', 'who\'s calling',
      'account number', 'your account', 'your email', 'email address',
      'company name', 'calling from',
    ];
    if (contactInfoPatterns.some(p => lower.includes(p)) || isVerificationQuestion(lastSupplierMsg)) {
      return {
        ...(await conversationalResponseNode(llmClient, state, nudge)),
        currentNode, // Stay on the same node — we'll resume it next turn
      };
    }
  }

  // Execute current node
  let newState = state;

  switch (currentNode) {
    case 'greeting':
      newState = greetingNode(state);
      break;
    case 'quote_request':
      newState = quoteRequestNode(state);
      break;
    case 'price_extract':
      newState = await priceExtractNode(llmClient, state);
      break;
    case 'negotiate':
      newState = negotiateNode(state);
      // If negotiateNode found nothing to negotiate (all within threshold),
      // it returns state unchanged with no AI message. Fall through to
      // conversational response to avoid a silent turn.
      if (newState.conversationHistory.length === state.conversationHistory.length) {
        newState = await conversationalResponseNode(llmClient, state, nudge);
      }
      break;
    case 'confirmation':
      newState = confirmationNode(state);
      break;
    case 'voicemail':
      newState = voicemailNode(state);
      break;
    case 'transfer':
      newState = transferNode(state);
      break;
    case 'hold_acknowledgment':
      newState = holdAcknowledgmentNode(state);
      break;
    case 'human_escalation':
      newState = humanEscalationNode(state);
      break;
    case 'clarification':
      newState = await clarificationNode(llmClient, state);
      break;
    case 'callback':
      newState = callbackNode(state);
      break;
    case 'polite_end':
      newState = politeEndNode(state);
      break;
    case 'bot_screening':
      newState = botScreeningNode(state);
      break;
    case 'misc_costs_inquiry':
      newState = miscCostsInquiryNode(state);
      break;
    case 'conversational_response':
      newState = await conversationalResponseNode(llmClient, state, nudge);
      break;
    case 'end':
      // If we're at end but receiving more input, use conversational response
      newState = await conversationalResponseNode(llmClient, state, nudge);
      break;
    default:
      console.warn(`Unknown node: ${currentNode}`);
      // Fall back to conversational response for unknown nodes
      newState = await conversationalResponseNode(llmClient, state, nudge);
      break;
  }

  // Determine next node
  let nextNode = 'end';

  switch (currentNode) {
    case 'greeting':
      nextNode = await routeFromGreeting(llmClient, newState);
      break;
    case 'quote_request':
      nextNode = await routeFromQuoteRequest(llmClient, newState);
      break;
    case 'price_extract': {
      // After extracting pricing, check if negotiation is needed (>20% over reference)
      const NEGOTIATION_THRESHOLD = 0.20;
      const needsNegotiation = newState.quotes.some(q => {
        if (!q.price) return false;
        if (newState.negotiatedParts.includes(q.partNumber)) return false;
        const matchingPart = newState.parts.find(p =>
          p.partNumber === q.partNumber || p.partNumber === q.originalPartNumber
        );
        if (!matchingPart?.budgetMax) return false;
        return q.price > matchingPart.budgetMax * (1 + NEGOTIATION_THRESHOLD);
      });
      if (needsNegotiation && newState.negotiationAttempts < newState.maxNegotiationAttempts) {
        nextNode = 'negotiate';
      } else if (hasPricingForAllParts(newState)) {
        // Before jumping to confirmation, check if the supplier just asked a question
        // (e.g., "Do you have an account?"). Answer it first, then confirm next turn.
        const lastSupplierMsgForQ = getLastSupplierResponse(newState);
        if (lastSupplierMsgForQ && await detectQuestion(lastSupplierMsgForQ)) {
          nextNode = 'conversational_response';
        } else {
          nextNode = nextNodeAfterPricing(newState);
        }
      } else {
        // If a substitute was just recorded without pricing, stay conversational
        // so the agent asks for pricing on the substitute — NOT re-state it via quote_request
        const hasUnpricedSubstitute = newState.quotes.some(q => q.isSubstitute && q.price == null);
        if (hasUnpricedSubstitute) {
          nextNode = 'conversational_response';
        } else {
          nextNode = newState.allPartsRequested ? 'conversational_response' : 'quote_request';
        }
      }
      break;
    }
    case 'negotiate': {
      nextNode = await routeFromNegotiation(llmClient, newState);
      // When negotiation concludes (anything other than retry), mark the
      // over-budget parts as negotiated so they don't trigger negotiation
      // again if we re-enter price_extract later (e.g., supplier corrects).
      if (nextNode !== 'negotiate') {
        const NEGOTIATION_THRESHOLD = 0.20;
        const negotiatedNow = newState.quotes
          .filter(q => {
            if (!q.price) return false;
            const mp = newState.parts.find(p =>
              p.partNumber === q.partNumber || p.partNumber === q.originalPartNumber
            );
            return mp?.budgetMax ? q.price > mp.budgetMax * (1 + NEGOTIATION_THRESHOLD) : false;
          })
          .map(q => q.partNumber);
        newState = {
          ...newState,
          negotiatedParts: [...new Set([...newState.negotiatedParts, ...negotiatedNow])],
        };
      }
      break;
    }
    case 'clarification':
      // After clarification, route to conversational_response instead of repeating full quote
      nextNode = 'conversational_response';
      break;
    case 'bot_screening':
      nextNode = await routeFromBotScreening(llmClient, newState);
      break;
    case 'confirmation':
      nextNode = await routeFromConfirmation(llmClient, newState);
      break;
    case 'misc_costs_inquiry':
      // After asking about misc costs, try to extract any amounts then confirm
      nextNode = 'confirmation';
      break;
    case 'transfer':
      nextNode = 'greeting'; // Back to greeting after requesting transfer
      break;
    case 'hold_acknowledgment': {
      // If we're waiting for a transfer, go to greeting for the new person.
      if (newState.waitingForTransfer) {
        nextNode = 'greeting';
        break;
      }
      // Supplier came back from looking something up. Check what they said —
      // they may have returned with a substitute part number, fitment info,
      // or pricing, not just a generic "okay I'm back."
      const holdSupplierMsg = getLastSupplierResponse(newState);
      if (detectSubstitute(holdSupplierMsg) || detectFitmentRejection(holdSupplierMsg)) {
        nextNode = 'price_extract'; // Will try extractPricing, then extractSubstituteInfo
      } else if (/\$|\d+\.\d{2}|\b(price is|cost is|that'?ll be|runs? about|dollars|cents|bucks)\b/i.test(holdSupplierMsg)) {
        nextNode = 'price_extract'; // Pricing detected
      } else {
        nextNode = 'conversational_response';
      }
      break;
    }
    case 'conversational_response': {
      const convResult = await routeFromConversationalResponse(llmClient, newState);
      newState = convResult.state;
      nextNode = convResult.nextNode;
      break;
    }
    case 'voicemail':
      // If we're in voicemail node, the call should end
      // (If supplier responds after voicemail message, they'll trigger a new turn and routing will handle it)
      nextNode = 'end';
      break;
    case 'end':
      // Conversation continuing after end - route based on intent
      nextNode = await routeFromGreeting(llmClient, newState);
      break;
    default:
      nextNode = 'end';
  }

  // Phase transition override: if the Overseer nudge includes a phase transition,
  // override the routing decision to enforce the new phase.
  if (nudge?.phaseTransition) {
    const phaseNodeMap: Record<string, string> = {
      NEGOTIATE: 'negotiate',
      FINALIZE: 'confirmation',
    };
    const overrideNode = phaseNodeMap[nudge.phaseTransition];
    if (overrideNode && nextNode !== 'polite_end' && nextNode !== 'end' &&
        newState.status !== 'completed' && newState.status !== 'escalated') {
      nextNode = overrideNode;
    }
  }

  return {
    ...newState,
    currentNode: nextNode,
  };
}

/**
 * Initialize a new call state
 */
/**
 * Parse human-readable values from customContext string
 */
function parseContextValues(customContext?: string): { organizationName: string; quoteReference: string } {
  if (!customContext) {
    return { organizationName: 'our company', quoteReference: 'QR-UNKNOWN' };
  }
  
  // Extract company name: "Company: {name}\n"
  const companyMatch = customContext.match(/Company:\s*(.+?)(?:\n|$)/i);
  const organizationName = companyMatch?.[1]?.trim() || 'our company';
  
  // Extract quote reference: "Quote Request: {ref}\n" or "Quote Request: #{ref}\n"
  const quoteMatch = customContext.match(/Quote Request:\s*(#?[A-Z0-9-]+)(?:\n|$)/i);
  const quoteReference = quoteMatch?.[1]?.trim() || 'QR-UNKNOWN';
  
  return { organizationName, quoteReference };
}

export function initializeCallState(params: {
  callId: string;
  quoteRequestId: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  organizationId: string;
  callerId: string;
  callerName?: string;
  parts: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    budgetMax?: number;
  }>;
  customContext?: string;
  customInstructions?: string;
  hasMiscCosts?: boolean;
}): CallState {
  const { organizationName, quoteReference } = parseContextValues(params.customContext);

  // Detect follow-up calls from customInstructions
  const instructions = (params.customInstructions || '').toLowerCase();
  const isFollowUp = instructions.includes('follow up') || instructions.includes('follow-up') ||
    instructions.includes('previous quote') || instructions.includes('previous call') ||
    instructions.includes('previous attempt');

  return {
    ...params,
    organizationName,
    quoteReference,
    callerName: params.callerName,
    currentNode: 'greeting',
    conversationHistory: [],
    quotes: [],
    needsTransfer: false,
    needsHumanEscalation: false,
    negotiationAttempts: 0,
    maxNegotiationAttempts: 2,
    negotiatedParts: [],
    clarificationAttempts: 0,
    botScreeningDetected: false,
    botScreeningAttempts: 0,
    botScreeningMaxAttempts: 3,
    allPartsRequested: false,
    hasMiscCosts: params.hasMiscCosts ?? false,
    miscCostsAsked: false,
    waitingForTransfer: false,
    isFollowUp,
    turnNumber: 0,
    status: 'in_progress',
  };
}
