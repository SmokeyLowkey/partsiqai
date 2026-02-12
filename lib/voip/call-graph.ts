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
} from './helpers';

// ============================================================================
// NODE IMPLEMENTATIONS
// ============================================================================

/**
 * Greeting Node - Initial message to supplier
 */
export function greetingNode(state: CallState): CallState {
  // Use custom context if provided, otherwise use default greeting
  const greeting = state.voiceAgentContext || 
    `Hi, this is the virtual assistant calling on behalf of ${state.organizationId}. 
We're helping their maintenance team source parts for heavy equipment. 
Am I speaking with someone who can provide pricing?`;

  return addMessage(state, 'ai', greeting);
}

/**
 * Quote Request Node - Ask for pricing on specific parts
 */
export function quoteRequestNode(state: CallState): CallState {
  const partsDescription = state.parts
    .map(p => `${p.partNumber} - ${p.description}, quantity ${p.quantity}`)
    .join(', and ');

  const request = `Great. We need pricing and availability for the following: ${partsDescription}. 
Do you have these items in stock, or can you source them?`;

  return addMessage(state, 'ai', request);
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
We're calling on behalf of ${state.organizationId} to request pricing for equipment parts. 
The quote reference is QR-${state.quoteRequestId.slice(-6)}. 
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
  const message = `Of course. The quote reference is QR-${state.quoteRequestId.slice(-6)}. 
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

  // Check for questions
  const hasQuestion = await detectQuestion(lastResponse);
  if (hasQuestion) {
    if (state.clarificationAttempts >= 2) {
      return 'human_escalation';
    }
    return 'clarification';
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
    return 'confirmation';
  }

  // Check for unavailable/out of stock
  if (lastResponse.toLowerCase().includes('don\'t have') ||
      lastResponse.toLowerCase().includes('out of stock') ||
      lastResponse.toLowerCase().includes('unavailable')) {
    return 'confirmation'; // Still end gracefully
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
    default:
      console.warn(`Unknown node: ${currentNode}`);
      return state;
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
      nextNode = 'quote_request';
      break;
    case 'transfer':
      nextNode = 'greeting'; // Back to greeting after transfer
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
  voiceAgentContext?: string;
}): CallState {
  return {
    ...params,
    currentNode: 'greeting',
    conversationHistory: [],
    quotes: [],
    needsTransfer: false,
    needsHumanEscalation: false,
    negotiationAttempts: 0,
    maxNegotiationAttempts: 2,
    clarificationAttempts: 0,
    status: 'in_progress',
  };
}
