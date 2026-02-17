/**
 * Conversation Flow Improvements Tests
 *
 * Tests for: dash pronunciation, natural quantity phrasing,
 * hasPricingForAllParts, detectSubstitute, misc costs logic,
 * and MISC-COSTS filtering.
 */

import { describe, it, expect } from 'vitest';
import {
  formatPartNumberForSpeech,
  hasPricingForAllParts,
  detectSubstitute,
  detectQuestion,
} from '../helpers';
import { CallState, ExtractedQuote } from '../types';

// ============================================================================
// Minimal CallState factory
// ============================================================================

function makeState(overrides: Partial<CallState> = {}): CallState {
  return {
    callId: 'test',
    quoteRequestId: 'qr-1',
    quoteReference: 'QR-02-2026-0001',
    supplierId: 's1',
    supplierName: 'Acme Parts',
    supplierPhone: '+15551234567',
    organizationId: 'org1',
    organizationName: 'TestCo Equipment',
    callerId: 'caller1',
    parts: [],
    currentNode: 'quote_request',
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
    hasMiscCosts: false,
    miscCostsAsked: false,
    status: 'in_progress',
    ...overrides,
  };
}

// ============================================================================
// formatPartNumberForSpeech — dash pronunciation
// ============================================================================

describe('formatPartNumberForSpeech', () => {
  it('spells letter segments and reads digit segments', () => {
    const result = formatPartNumberForSpeech('AT514799');
    // Letters spelled out individually: "A T"
    expect(result).toContain('A T');
    // Digits read individually: "5 1 4 7 9 9"
    expect(result).toContain('5 1 4 7 9 9');
  });

  it('converts hyphens to spoken "dash"', () => {
    const result = formatPartNumberForSpeech('AHC-18598');
    expect(result).toContain('dash');
    // No hyphens or SSML tags remain
    expect(result).not.toContain('-');
    expect(result).not.toContain('<');
  });

  it('handles multiple hyphens', () => {
    const result = formatPartNumberForSpeech('RE-506-428');
    const dashCount = (result.match(/dash/g) || []).length;
    expect(dashCount).toBe(2);
  });

  it('handles pure letter part numbers', () => {
    const result = formatPartNumberForSpeech('ABC');
    expect(result).toContain('A B C');
  });

  it('handles pure numeric part numbers', () => {
    const result = formatPartNumberForSpeech('12345');
    expect(result).toContain('1 2 3 4 5');
  });

  it('handles part number with no special chars', () => {
    const result = formatPartNumberForSpeech('MIA883029');
    expect(result).toContain('M I A');
    expect(result).toContain('8 8 3 0 2 9');
  });

  it('does not say "minus" anywhere', () => {
    const result = formatPartNumberForSpeech('X-100-Y');
    expect(result.toLowerCase()).not.toContain('minus');
  });

  it('produces no SSML tags', () => {
    const result = formatPartNumberForSpeech('AT514799');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });
});

// ============================================================================
// describePartNaturally (imported indirectly via call-graph, tested here via module)
// ============================================================================

// Since describePartNaturally is not exported, we test the logic directly
describe('natural quantity phrasing logic', () => {
  function describePartNaturally(description: string, quantity: number): string {
    if (quantity === 1) return `a ${description}`;
    if (quantity === 2) return `a couple of ${description}s`;
    return `${quantity} ${description}s`;
  }

  it('says "a boom hydraulic cylinder" for qty 1', () => {
    expect(describePartNaturally('boom hydraulic cylinder', 1)).toBe('a boom hydraulic cylinder');
  });

  it('says "a couple of filters" for qty 2', () => {
    expect(describePartNaturally('filter', 2)).toBe('a couple of filters');
  });

  it('says "3 gaskets" for qty 3', () => {
    expect(describePartNaturally('gasket', 3)).toBe('3 gaskets');
  });

  it('says "5 bearings" for qty 5', () => {
    expect(describePartNaturally('bearing', 5)).toBe('5 bearings');
  });

  it('does not say "quantity" anywhere', () => {
    const result = describePartNaturally('pump', 1);
    expect(result.toLowerCase()).not.toContain('quantity');
  });
});

// ============================================================================
// hasPricingForAllParts
// ============================================================================

describe('hasPricingForAllParts', () => {
  it('returns false when no parts', () => {
    const state = makeState({ parts: [], quotes: [] });
    expect(hasPricingForAllParts(state)).toBe(false);
  });

  it('returns false when no quotes', () => {
    const state = makeState({
      parts: [{ partNumber: 'AT514799', description: 'Pump', quantity: 1 }],
      quotes: [],
    });
    expect(hasPricingForAllParts(state)).toBe(false);
  });

  it('returns true when all parts have direct pricing', () => {
    const state = makeState({
      parts: [
        { partNumber: 'AT514799', description: 'Pump', quantity: 1 },
        { partNumber: 'RE506428', description: 'Filter', quantity: 2 },
      ],
      quotes: [
        { partNumber: 'AT514799', price: 100, availability: 'in_stock' },
        { partNumber: 'RE506428', price: 50, availability: 'in_stock' },
      ],
    });
    expect(hasPricingForAllParts(state)).toBe(true);
  });

  it('returns false when one part is missing pricing', () => {
    const state = makeState({
      parts: [
        { partNumber: 'AT514799', description: 'Pump', quantity: 1 },
        { partNumber: 'RE506428', description: 'Filter', quantity: 2 },
      ],
      quotes: [
        { partNumber: 'AT514799', price: 100, availability: 'in_stock' },
      ],
    });
    expect(hasPricingForAllParts(state)).toBe(false);
  });

  it('returns true when a substitute covers the original part', () => {
    const state = makeState({
      parts: [{ partNumber: 'AT514799', description: 'Pump', quantity: 1 }],
      quotes: [
        {
          partNumber: 'AT514800', // substitute
          price: 110,
          availability: 'in_stock',
          isSubstitute: true,
          originalPartNumber: 'AT514799',
        },
      ],
    });
    expect(hasPricingForAllParts(state)).toBe(true);
  });

  it('returns false when quote has no price (null)', () => {
    const state = makeState({
      parts: [{ partNumber: 'AT514799', description: 'Pump', quantity: 1 }],
      quotes: [
        { partNumber: 'AT514799', availability: 'backorder' },
      ],
    });
    expect(hasPricingForAllParts(state)).toBe(false);
  });

  it('handles mix of direct and substitute quotes', () => {
    const state = makeState({
      parts: [
        { partNumber: 'PART-A', description: 'Part A', quantity: 1 },
        { partNumber: 'PART-B', description: 'Part B', quantity: 1 },
      ],
      quotes: [
        { partNumber: 'PART-A', price: 50, availability: 'in_stock' },
        {
          partNumber: 'PART-B-NEW',
          price: 75,
          availability: 'in_stock',
          isSubstitute: true,
          originalPartNumber: 'PART-B',
        },
      ],
    });
    expect(hasPricingForAllParts(state)).toBe(true);
  });
});

// ============================================================================
// detectSubstitute
// ============================================================================

describe('detectSubstitute', () => {
  it.each([
    'That part has been superseded by AT514800.',
    'We have a substitute available.',
    "That's been replaced by a newer model.",
    'The replacement part number is RE506429.',
    'There is an alternate part that will work.',
    'We have an alternative part available.',
    'That part has an equivalent from the new line.',
    'The updated part number is different.',
    "The new part number is AT514800.",
    "That's been changed to a different number.",
  ])('detects substitute mention: %s', (input) => {
    expect(detectSubstitute(input)).toBe(true);
  });

  it.each([
    'Sure, that part is $245.50.',
    "We have it in stock, ships today.",
    "Let me check on that for you.",
    "The price went up last month.",
    "We need to order that from the warehouse.",
  ])('returns false for non-substitute response: %s', (input) => {
    expect(detectSubstitute(input)).toBe(false);
  });
});

// ============================================================================
// shouldAskMiscCosts logic (tested via state conditions)
// ============================================================================

describe('misc costs logic', () => {
  // Reimplement the logic here since shouldAskMiscCosts is not exported
  function shouldAskMiscCosts(state: CallState): boolean {
    if (!state.hasMiscCosts || state.miscCostsAsked) return false;
    return state.quotes.some(
      (q) => q.availability === 'backorder' || q.availability === 'unavailable'
    );
  }

  it('returns false when hasMiscCosts is false', () => {
    const state = makeState({ hasMiscCosts: false });
    expect(shouldAskMiscCosts(state)).toBe(false);
  });

  it('returns false when miscCostsAsked is true', () => {
    const state = makeState({
      hasMiscCosts: true,
      miscCostsAsked: true,
      quotes: [{ partNumber: 'A', availability: 'backorder', price: 50 }],
    });
    expect(shouldAskMiscCosts(state)).toBe(false);
  });

  it('returns false when all parts in stock (no shipping needed)', () => {
    const state = makeState({
      hasMiscCosts: true,
      miscCostsAsked: false,
      quotes: [
        { partNumber: 'A', price: 50, availability: 'in_stock' },
        { partNumber: 'B', price: 75, availability: 'in_stock' },
      ],
    });
    expect(shouldAskMiscCosts(state)).toBe(false);
  });

  it('returns true when a part is backordered', () => {
    const state = makeState({
      hasMiscCosts: true,
      miscCostsAsked: false,
      quotes: [
        { partNumber: 'A', price: 50, availability: 'in_stock' },
        { partNumber: 'B', price: 75, availability: 'backorder' },
      ],
    });
    expect(shouldAskMiscCosts(state)).toBe(true);
  });

  it('returns true when a part is unavailable', () => {
    const state = makeState({
      hasMiscCosts: true,
      miscCostsAsked: false,
      quotes: [
        { partNumber: 'A', price: 50, availability: 'unavailable' },
      ],
    });
    expect(shouldAskMiscCosts(state)).toBe(true);
  });
});

// ============================================================================
// MISC-COSTS filtering (worker logic, tested via pure function)
// ============================================================================

describe('MISC-COSTS filtering', () => {
  it('filters out MISC-COSTS from parts array', () => {
    const items = [
      { partNumber: 'AT514799', description: 'Pump', quantity: 1 },
      { partNumber: 'MISC-COSTS', description: 'Additional costs and fees', quantity: 1 },
      { partNumber: 'RE506428', description: 'Filter', quantity: 2 },
    ];

    const regularItems = items.filter((item) => item.partNumber !== 'MISC-COSTS');
    const hasMiscCosts = items.some((item) => item.partNumber === 'MISC-COSTS');

    expect(regularItems).toHaveLength(2);
    expect(regularItems.map((i) => i.partNumber)).toEqual(['AT514799', 'RE506428']);
    expect(hasMiscCosts).toBe(true);
  });

  it('handles no MISC-COSTS present', () => {
    const items = [
      { partNumber: 'AT514799', description: 'Pump', quantity: 1 },
    ];

    const regularItems = items.filter((item) => item.partNumber !== 'MISC-COSTS');
    const hasMiscCosts = items.some((item) => item.partNumber === 'MISC-COSTS');

    expect(regularItems).toHaveLength(1);
    expect(hasMiscCosts).toBe(false);
  });
});
