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
  isAskingToRepeat,
  isVerificationQuestion,
  detectBotScreening,
  generateScreeningResponse,
  hasPricingForAllParts,
  detectSubstitute,
} from './helpers';

// ============================================================================
// NODE IMPLEMENTATIONS
// ============================================================================

/**
 * Greeting Node - Initial message to supplier
 * Always uses a natural greeting - context is provided separately to LLM
 */
export function greetingNode(state: CallState): CallState {
  // Always use natural greeting - don't speak the context verbatim!
  const greeting = `Hi, good morning! Could I speak to someone in your parts department?`;

  return addMessage(state, 'ai', greeting);
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
      `Sure, let me spell that out for you. <break time="400ms"/> ${phonetic}. <break time="300ms"/> That's for the ${currentPart.description}.`
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

    const request = `Great, thanks! I'm looking for ${descriptions}. Whenever you're ready, I have the part numbers.`;
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

    let request: string;
    if (isFirst) {
      request = `Sure! The first part number is <break time="300ms"/> ${partNum} <break time="300ms"/> — that's the ${nextPart.description}.`;
      if (remaining > 0) {
        request += ` I have ${remaining} more after this one.`;
      }
    } else {
      request = `Next one is <break time="300ms"/> ${partNum} <break time="300ms"/> — ${nextPart.description}.`;
    }

    return addMessage(state, 'ai', request);
  }

  // All part numbers given - recap
  const allParts = state.parts
    .map(p => `${formatPartNumberForSpeech(p.partNumber)}`)
    .join(', <break time="500ms"/> ');

  return addMessage(state, 'ai',
    `So those were: <break time="300ms"/> ${allParts}. <break time="300ms"/> Can you check pricing and availability on all of those?`
  );
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
  const extractedQuotes = await extractPricing(llmClient, lastResponse, state.parts);

  return {
    ...state,
    quotes: [...state.quotes, ...extractedQuotes],
    status: extractedQuotes.length > 0 ? 'in_progress' : state.status,
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
 */
export function confirmationNode(state: CallState): CallState {
  const quotes = state.quotes.filter(q => q.price);

  if (quotes.length === 0) {
    return addMessage(
      state,
      'ai',
      "Thank you for your time. We'll follow up via email with the details."
    );
  }

  const quotesSummary = quotes
    .map(q => `${q.partNumber} at $${q.price}, ${q.availability}`)
    .join(', ');

  const message = `Perfect. Just to confirm: ${quotesSummary}. 
We'll send a formal quote request via email to finalize. Thank you!`;

  return {
    ...addMessage(state, 'ai', message),
    status: 'completed',
  };
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
 */
export function transferNode(state: CallState): CallState {
  const message = `I understand. Could you transfer me to someone who handles parts pricing, or provide their direct number?`;

  return {
    ...addMessage(state, 'ai', message),
    needsTransfer: true,
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
 */
export function politeEndNode(state: CallState): CallState {
  const message = `I understand. Thank you for your time. Have a great day!`;

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

Respond in a single sentence. Be specific about the part numbers if they ask. Don't add "Here's my response" or other meta-commentary - just give the direct response.`;

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

  // Check for bot screening BEFORE the LLM call
  const screeningType = detectBotScreening(lastResponse);
  if (screeningType) return 'bot_screening';

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

  // Check for callback request
  if (lastResponse.toLowerCase().includes('call back') || 
      lastResponse.toLowerCase().includes('call you back')) {
    return 'callback';
  }

  // Check if supplier is asking to repeat part numbers
  if (isAskingToRepeat(lastResponse)) {
    return 'quote_request'; // Will trigger phonetic spelling
  }

  // Check if supplier is asking a verification question (serial number, machine, fitment)
  if (isVerificationQuestion(lastResponse)) {
    return 'conversational_response'; // Answer their question, don't end
  }

  // Check for questions
  const hasQuestion = await detectQuestion(lastResponse);
  if (hasQuestion) {
    if (state.clarificationAttempts >= 2) {
      return 'human_escalation';
    }
    return 'conversational_response'; // Use conversational response for questions
  }

  // Try to extract pricing
  const extractedQuotes = await extractPricing(llmClient, lastResponse, state.parts);

  if (extractedQuotes.length > 0 && extractedQuotes.some(q => q.price)) {
    // Got pricing, check if negotiation needed
    const needsNegotiation = extractedQuotes.some(
      (q, idx) => q.price && state.parts[idx]?.budgetMax && q.price > state.parts[idx].budgetMax!
    );

    if (needsNegotiation && state.negotiationAttempts < state.maxNegotiationAttempts) {
      return 'negotiate';
    }
    return nextNodeAfterPricing(state);
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

  // Didn't understand
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
  const extractedQuotes = await extractPricing(llmClient, lastResponse, state.parts);
  if (extractedQuotes.length > 0 && extractedQuotes.some(q => q.price)) {
    return 'confirmation';
  }

  return 'negotiate'; // Try again
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
    case 'misc_costs_inquiry':
      // After asking about misc costs, try to extract any amounts then confirm
      nextNode = 'confirmation';
      break;
    case 'transfer':
      nextNode = 'greeting'; // Back to greeting after transfer
      break;
    case 'conversational_response': {
      // After a conversational response, detect what to do next
      const lastSupplierMsg = getLastSupplierResponse(newState);

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

      // Try to extract pricing from current response
      const convQuotes = await extractPricing(llmClient, lastSupplierMsg, newState.parts);
      if (convQuotes.length > 0) {
        nextNode = 'price_extract';
        break;
      }

      // Only go back to quote_request if early AND no pricing collected yet
      if (newState.conversationHistory.length <= 4 && newState.quotes.length === 0) {
        nextNode = 'quote_request';
        break;
      }

      // If supplier mentioned a substitute, stay conversational to capture details
      if (detectSubstitute(lastSupplierMsg)) {
        nextNode = 'conversational_response';
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

      if (isQuestion && newState.conversationHistory.length > 14) {
        // Only end after many exchanges (14+), not 8
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
    hasMiscCosts: params.hasMiscCosts ?? false,
    miscCostsAsked: false,
    status: 'in_progress',
  };
}
