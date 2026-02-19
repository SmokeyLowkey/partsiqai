// Overseer Gating Logic (Rules-Based Fast Layer)
// Decides whether the Overseer LLM should fire for a given turn.
// This cuts LLM costs by 60-80% on routine turns where the Overseer adds no value.

import { CallState } from '../types';
import { OverseerState } from './types';
import { getLastSupplierResponse, detectSubstitute, detectFitmentRejection } from '../helpers';

// Pricing indicators — supplier may be quoting or discussing prices
const PRICING_REGEX = /\$|\d+\.\d{2}|\b(price|cost|each|per unit|dollars|cents|bucks|per piece|apiece)\b/i;

// Supplier deflecting to email instead of giving verbal quote
const EMAIL_DEFLECTION_REGEX = /\b(email|send (you|it) over|formal quote|shoot.*over|fax|send.*quote)\b/i;

// Negative sentiment — supplier refusing, declining, or unable
const NEGATIVE_SENTIMENT_REGEX = /\b(can't|cannot|don't have|won't|unavailable|out of stock|no longer|discontinued|not available|not in stock)\b/i;

/**
 * Determine if the Overseer LLM should fire for this turn.
 * Returns true to GATE IN (fire), false to GATE OUT (skip).
 */
export function shouldOverseerFire(callState: CallState, overseerState: OverseerState): boolean {
  // === GATE OUT conditions (skip Overseer) ===

  // Call already completed/escalated — nothing to oversee
  if (callState.status === 'completed' || callState.status === 'escalated') {
    return false;
  }

  // Too early — first turn or two are just greetings
  const turnNumber = callState.turnNumber || 0;
  if (turnNumber <= 1) {
    return false;
  }

  // Hold/wait — supplier just said "one moment", no analysis needed
  if (callState.currentNode === 'hold_acknowledgment') {
    return false;
  }

  // Bot screening — automated call screening, Overseer can't help
  if (callState.currentNode === 'bot_screening') {
    return false;
  }

  // === GATE IN conditions (fire Overseer) ===

  const lastSupplierMsg = getLastSupplierResponse(callState);

  // 1. Price/money mentioned — always analyze pricing turns
  if (PRICING_REGEX.test(lastSupplierMsg)) {
    return true;
  }

  // 2. Uncovered parts remain AND enough turns have passed
  const supplierTurnCount = callState.conversationHistory.filter(m => m.speaker === 'supplier').length;
  if (!overseerState.infoWeNeed.allPartsAddressed && supplierTurnCount > 4) {
    return true;
  }

  // 3. Negotiation phase — every turn matters during negotiation
  if (overseerState.phase === 'NEGOTIATE') {
    return true;
  }

  // 4. Substitute or fitment rejection — important to track
  if (detectSubstitute(lastSupplierMsg) || detectFitmentRejection(lastSupplierMsg)) {
    return true;
  }

  // 5. Supplier deflecting to email — need to pin down verbal range
  if (EMAIL_DEFLECTION_REGEX.test(lastSupplierMsg)) {
    return true;
  }

  // 6. Conversation stalling — same node for many consecutive turns
  const recentAiMessages = callState.conversationHistory
    .filter(m => m.speaker === 'ai')
    .slice(-4);
  if (recentAiMessages.length >= 3) {
    // Check if the node hasn't changed in the last few turns
    // A stalling conversation often means the agent is stuck
    const stuckInConversationalResponse = callState.currentNode === 'conversational_response' && supplierTurnCount > 8;
    if (stuckInConversationalResponse) {
      return true;
    }
  }

  // 7. Call approaching end — verify everything before closing
  if (callState.currentNode === 'confirmation' || callState.currentNode === 'polite_end') {
    return true;
  }

  // 8. Negative sentiment — supplier refusing or unable to help
  if (NEGATIVE_SENTIMENT_REGEX.test(lastSupplierMsg)) {
    return true;
  }

  // Default: skip the Overseer for routine turns (chit-chat, acknowledgments, etc.)
  return false;
}
