/**
 * LangGraph-based VOIP Call Orchestration
 * 
 * This module manages the state machine for supplier phone calls.
 * Each node represents a step in the conversation flow.
 */

import { CallState } from './types';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';
import {
  getLastSupplierResponse,
  addMessage,
  classifyIntent,
  extractPricing,
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
  // If waiting for transfer, check if we're hearing hold music/ads
  if (state.waitingForTransfer) {
    const lastResponse = getLastSupplierResponse(state);
    if (isHoldAudio(lastResponse)) {
      // Stay silent — don't greet the hold music. Keep waiting.
      return state;
    }
    // Real person picked up — clear the flag and re-introduce
    return {
      ...addMessage({ ...state, waitingForTransfer: false }, 'ai',
        `Hi there! Thanks for taking my call. I'm looking to get pricing on some parts.`
      ),
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
      msg.text.toLowerCase().includes("part number is")
    )
  );

  if (alreadyInQuoteFlow) {
    return addMessage(state, 'ai',
      `Hi there! Thanks for taking my call. I'm looking to get pricing on some parts.`
    );
  }

  const alreadyGreeted = state.conversationHistory.some(
    msg => msg.speaker === 'ai' && msg.text.includes('parts department')
  );

  if (!alreadyGreeted) {
    return addMessage(state, 'ai',
      `Hi, good morning! Could I speak to someone in your parts department?`
    );
  }

  // After transfer — re-introduce, don't repeat the same greeting
  return addMessage(state, 'ai',
    `Hi there! Thanks for taking my call. I'm looking to get pricing on some parts.`
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
    msg => msg.speaker === 'ai' && msg.text.toLowerCase().includes("i'm looking for")
  );

  if (!alreadyMentionedParts) {
    // First time - just mention descriptions naturally, no part numbers
    const descriptions = state.parts
      .map(p => describePartNaturally(p.description, p.quantity))
      .join(', and ');

    const hasUnverifiedParts = state.parts.some(p => p.source === 'WEB_SEARCH');

    let request = `Great, thanks! I'm looking for ${descriptions}. Whenever you're ready, I have the part numbers.`;
    if (hasUnverifiedParts) {
      request += ` I should mention, I found some of these part numbers online so I'll need to verify they're correct for my machine.`;
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
      request = `Sure! The first part number is... ${partNum}. That's the ${nextPart.description}.`;
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
 * Price Extract Node - Record prices from supplier
 */
export async function priceExtractNode(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<CallState> {
  const lastResponse = getLastSupplierResponse(state);
  const recentHistory = state.conversationHistory.slice(-6);
  const extractedQuotes = await extractPricing(llmClient, lastResponse, state.parts, recentHistory);

  if (extractedQuotes.length === 0) {
    return state;
  }

  // Use mergeExtractedQuotes to handle substitutes — adds new part numbers
  // to state.parts and deduplicates quotes
  const mergedState = mergeExtractedQuotes(state, extractedQuotes);

  return {
    ...mergedState,
    status: extractedQuotes.some(q => q.price) ? 'in_progress' : mergedState.status,
  };
}

/**
 * Negotiate Node - Counter-offer if price too high
 */
export function negotiateNode(state: CallState): CallState {
  const quote = state.quotes[0];
  const budget = state.parts[0]?.budgetMax;

  if (!budget || !quote?.price) {
    return state;
  }

  if (quote.price <= budget) {
    return state; // No negotiation needed
  }

  const counterOffer = Math.max(quote.price * 0.8, budget * 0.95);
  
  const negotiationScript =
    state.negotiationAttempts === 0
      ? `That's a bit higher than our budget of $${budget}. Any flexibility on price? We're looking at around $${counterOffer.toFixed(2)}.`
      : `I understand. We have other quotes in the $${budget} range. Can you match that to win this order?`;

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
      return `${partNum}${substituteNote} at $${q.price?.toFixed(2)}, ${q.availability === 'in_stock' ? 'in stock' : q.availability}`;
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
 * Only sets waitingForTransfer when coming from greeting/transfer (actual transfer).
 * When coming from quote_request (supplier looking something up), just acknowledge.
 */
export function holdAcknowledgmentNode(state: CallState): CallState {
  // If we came from greeting or transfer, supplier is transferring us — set flag
  const isTransfer = state.currentNode === 'greeting' || state.currentNode === 'transfer';

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
 * Determine next node when pricing is complete
 */
function nextNodeAfterPricing(state: CallState): string {
  if (shouldAskMiscCosts(state)) return 'misc_costs_inquiry';
  return 'confirmation';
}

/**
 * Conversational Response Node - Handle follow-up questions and clarifications
 * Uses LLM to generate contextually appropriate responses based on conversation history
 */
export async function conversationalResponseNode(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<CallState> {
  const lastResponse = getLastSupplierResponse(state);
  
  // Build conversation context for the LLM
  const conversationContext = state.conversationHistory
    .slice(-6) // Only last 6 messages to keep prompt focused
    .map(msg => `${msg.speaker === 'ai' ? 'You' : 'Supplier'}: ${msg.text}`)
    .join('\n');
  
  // Build parts context
  const partsContext = state.parts
    .map(p => `${p.partNumber} (${p.description}) - Qty: ${p.quantity}`)
    .join(', ');
  
  // Build custom context if available
  const additionalContext = state.customContext || '';
  
  const prompt = `You are on a phone call getting quotes for parts. Answer the supplier's question naturally.

Context: ${additionalContext}

Parts you need quotes for: ${partsContext}

Recent conversation:
${conversationContext}

Supplier just said: "${lastResponse}"

IMPORTANT RULES:
- If the supplier says a part number is wrong, doesn't fit, or needs to be purchased separately — accept their correction gracefully ("Okay, no problem") and ask for the correct part numbers or individual parts instead. Do NOT re-request the original part number.
- If the supplier is looking something up or asks you to wait, acknowledge patiently ("Sure, take your time").
- If the supplier is giving you pricing or part information, acknowledge it and ask for the next item.
- Be specific about part numbers if they ask.

Respond in 1-2 sentences. Don't add meta-commentary — just give the direct response.`;

  try {
    let response = await llmClient.generateCompletion(prompt, {
      temperature: 0.4,
      model: 'anthropic/claude-3.5-sonnet', // Upgrade for better context awareness
      maxTokens: 150,
    });

    // Clean up meta-commentary more aggressively (must be done BEFORE adding to state)
    response = response
      .replace(/^(here'?s? my (response|result|answer):?|my (response|result|answer):?)\\s*/i, '')
      .trim();

    // Replace any raw part numbers with TTS-safe formatted versions.
    // The LLM may output "AT331812" or "AT510302" which TTS will mangle.
    // We find anything that looks like a part number and format it for speech.
    response = formatPartNumbersInText(response, state.parts);

    return addMessage(state, 'ai', response);
  } catch (error) {
    console.error('Conversational response generation error:', error);
    // Fallback response
    return addMessage(
      state,
      'ai',
      "Could you repeat that?"
    );
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

  // Check if supplier says the part doesn't fit, is wrong, or must be purchased differently
  if (detectFitmentRejection(lastResponse)) {
    return 'conversational_response'; // LLM will ask for correct part/alternatives
  }

  // Check if supplier is providing a substitute/superseded part number.
  // Route through price_extract to capture the substitute and any associated pricing.
  if (detectSubstitute(lastResponse)) {
    return 'price_extract';
  }

  // Check if the response likely contains pricing info (quick heuristic).
  // Supplier may give a price AND ask a question in the same message
  // (e.g., "$130.58 each. Do you have an account?"). We must capture
  // the price even when a question is present. But if there's no pricing
  // hint, check questions first — "Do you have an account?" is a normal
  // pre-pricing question the agent needs to answer.
  const looksLikePricing = /\$|\d+\.\d{2}|\b(each|per unit|per piece|apiece|a piece|price is|cost is|that'?s? going to be|that'?ll be|runs? about|looking at)\b/i.test(lastResponse);

  if (looksLikePricing) {
    // Response likely has pricing — route to price_extract to persist quotes.
    // Previously we extracted here but discarded the results; price_extract
    // will re-extract AND save to state.
    const recentHistory = state.conversationHistory.slice(-6);
    const extractedQuotes = await extractPricing(llmClient, lastResponse, state.parts, recentHistory);

    if (extractedQuotes.length > 0 && extractedQuotes.some(q => q.price)) {
      // Got pricing — always route through price_extract so quotes are persisted
      return 'price_extract';
    }
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
  // (supplier may describe availability or pricing without obvious markers)
  if (!looksLikePricing) {
    const recentHistory = state.conversationHistory.slice(-6);
    const extractedQuotes = await extractPricing(llmClient, lastResponse, state.parts, recentHistory);

    if (extractedQuotes.length > 0 && extractedQuotes.some(q => q.price)) {
      // Route through price_extract so quotes are persisted to state
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
 * Route from negotiation
 */
export async function routeFromNegotiation(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<string> {
  if (state.negotiationAttempts >= state.maxNegotiationAttempts) {
    return 'confirmation';
  }

  const lastResponse = getLastSupplierResponse(state);

  if (containsRefusal(lastResponse)) {
    return 'confirmation';
  }

  // Check if they came down in price
  const extractedQuotes = await extractPricing(llmClient, lastResponse, state.parts,
    state.conversationHistory.slice(-6));
  if (extractedQuotes.length > 0 && extractedQuotes.some(q => q.price)) {
    return 'confirmation';
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

  // Correction patterns — supplier disagrees or corrects
  const correctionPatterns = [
    'that\'s wrong', 'that\'s not right', 'incorrect', 'actually',
    'i said', 'they are available', 'it is available', 'in stock',
    'not unavailable', 'we have them', 'i have them', 'they\'re available',
    'let me correct', 'that\'s not correct',
  ];

  if (correctionPatterns.some(p => lower.includes(p))) {
    // Clear stale quotes so we can re-extract with full context
    return 'price_extract';
  }

  // "No" at the start likely means disagreement with the confirmation
  if (/^no[\s,.]/.test(lower) || lower === 'no') {
    return 'price_extract';
  }

  // Agreement patterns
  const agreePatterns = [
    'yes', 'yeah', 'yep', 'correct', 'that\'s right', 'sounds good',
    'that\'s it', 'perfect', 'mhm', 'uh-huh', 'you got it',
  ];

  if (agreePatterns.some(p => lower.includes(p))) {
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
 * Simple graph execution - processes one turn at a time
 */
export async function processCallTurn(
  llmClient: OpenRouterClient,
  state: CallState
): Promise<CallState> {
  // Already completed or escalated — don't process more turns
  if (state.status === 'completed' || state.status === 'escalated') {
    return state;
  }

  const currentNode = state.currentNode;

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
      newState = await conversationalResponseNode(llmClient, state);
      break;
    case 'end':
      // If we're at end but receiving more input, use conversational response
      newState = await conversationalResponseNode(llmClient, state);
      break;
    default:
      console.warn(`Unknown node: ${currentNode}`);
      // Fall back to conversational response for unknown nodes
      newState = await conversationalResponseNode(llmClient, state);
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
      // After extracting pricing, check if negotiation is needed
      const needsNegotiation = newState.quotes.some(
        (q, idx) => q.price && newState.parts[idx]?.budgetMax && q.price > newState.parts[idx].budgetMax!
      );
      if (needsNegotiation && newState.negotiationAttempts < newState.maxNegotiationAttempts) {
        nextNode = 'negotiate';
      } else if (hasPricingForAllParts(newState)) {
        nextNode = nextNodeAfterPricing(newState);
      } else {
        // Still missing pricing for some parts — go back to quote_request
        // or stay conversational if all parts have been mentioned
        nextNode = newState.allPartsRequested ? 'conversational_response' : 'quote_request';
      }
      break;
    }
    case 'negotiate':
      nextNode = await routeFromNegotiation(llmClient, newState);
      break;
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
    case 'hold_acknowledgment':
      // If we're waiting for a transfer, go to greeting for the new person.
      // Otherwise, supplier was just looking something up — stay conversational.
      nextNode = newState.waitingForTransfer ? 'greeting' : 'conversational_response';
      break;
    case 'conversational_response': {
      // After a conversational response, detect what to do next
      const lastSupplierMsg = getLastSupplierResponse(newState);
      const lastSupplierLower = lastSupplierMsg.toLowerCase();

      // Hold/wait patterns — supplier is looking something up
      const convHoldPatterns = [
        'one moment', 'just a moment', 'hold on', 'hold please',
        'one second', 'just a sec', 'hang on', 'one sec',
        'give me a moment', 'give me a sec', 'give me a minute',
        'bear with me', 'hang tight', 'just a minute',
      ];
      if (convHoldPatterns.some(p => lastSupplierLower.includes(p))) {
        nextNode = 'hold_acknowledgment';
        break;
      }

      // Check if supplier is wrapping up the call
      const isWrappingUp = /\b(bye|goodbye|thanks|thank you|have a (good|great|nice) day)\b/i.test(lastSupplierMsg);
      if (isWrappingUp) {
        nextNode = 'polite_end';
        break;
      }

      // If we already have pricing for all parts, move forward — don't loop
      if (hasPricingForAllParts(newState)) {
        nextNode = nextNodeAfterPricing(newState);
        break;
      }

      // Try to extract pricing from current response (with conversation context).
      // Include substitute parts in extraction by passing all known parts.
      const convQuotes = await extractPricing(llmClient, lastSupplierMsg, newState.parts,
        newState.conversationHistory.slice(-6));
      if (convQuotes.length > 0 && convQuotes.some(q => q.price)) {
        // Merge extracted quotes into state (handles substitutes too)
        const mergedState = mergeExtractedQuotes(newState, convQuotes);
        // Save the merged state so pricing isn't lost
        newState = mergedState;
        nextNode = nextNodeAfterPricing(mergedState);
        break;
      }

      // If supplier mentioned a substitute part, try to capture the new part number
      // and add it to state.parts so we can track pricing for it
      if (detectSubstitute(lastSupplierMsg)) {
        const subQuotes = await extractPricing(llmClient, lastSupplierMsg, newState.parts,
          newState.conversationHistory.slice(-8));
        if (subQuotes.length > 0) {
          newState = mergeExtractedQuotes(newState, subQuotes);
        }
        nextNode = 'conversational_response';
        break;
      }

      // Only go back to quote_request if early AND no pricing collected yet
      if (newState.conversationHistory.length <= 4 && newState.quotes.length === 0) {
        nextNode = 'quote_request';
        break;
      }

      const isQuestion = await detectQuestion(lastSupplierMsg);

      // If supplier is asking a verification question (serial number, fitment),
      // always stay in conversation regardless of turn count
      if (isVerificationQuestion(lastSupplierMsg)) {
        nextNode = 'conversational_response';
        break;
      }

      // If supplier is asking to repeat, go back to quote_request for phonetic spelling
      if (isAskingToRepeat(lastSupplierMsg)) {
        nextNode = 'quote_request';
        break;
      }

      // If supplier says part doesn't fit, stay conversational to get alternatives
      if (detectFitmentRejection(lastSupplierMsg)) {
        nextNode = 'conversational_response';
        break;
      }

      // If supplier is actively offering help or looking something up, NEVER end
      const stillEngaged = /\b(let me|i('ll| will) (give|get|look|check|pull)|give you|here('s| is)|look(ing)? (it |that )?up|one moment|give me a (sec|moment|minute)|checking|pulling (it |that )?up|hold on|just a (sec|moment|minute))\b/i.test(lastSupplierMsg);
      if (stillEngaged) {
        nextNode = 'conversational_response';
        break;
      }

      if (isQuestion && newState.conversationHistory.length > 24) {
        // Only end after many exchanges (24+), not 14
        nextNode = 'polite_end';
        break;
      }

      // Check if supplier seems stuck/confused
      const seemsStuck = /\b(what|huh|repeat|again|didn'?t (catch|hear|get) that)\b/i.test(lastSupplierMsg);
      if (seemsStuck && newState.clarificationAttempts < 2) {
        nextNode = 'clarification';
      } else {
        nextNode = 'conversational_response';
      }
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

  return {
    ...params,
    organizationName,
    quoteReference,
    currentNode: 'greeting',
    conversationHistory: [],
    quotes: [],
    needsTransfer: false,
    needsHumanEscalation: false,
    negotiationAttempts: 0,
    maxNegotiationAttempts: 2,
    clarificationAttempts: 0,
    botScreeningDetected: false,
    botScreeningAttempts: 0,
    botScreeningMaxAttempts: 3,
    allPartsRequested: false,
    hasMiscCosts: params.hasMiscCosts ?? false,
    miscCostsAsked: false,
    waitingForTransfer: false,
    status: 'in_progress',
  };
}
