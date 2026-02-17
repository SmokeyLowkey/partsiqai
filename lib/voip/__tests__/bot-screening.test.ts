/**
 * Bot Screening Detection & Response Tests
 */

import { describe, it, expect } from 'vitest';
import {
  detectBotScreening,
  solveCaptcha,
  generateScreeningResponse,
} from '../helpers';
import { CallState } from '../types';

// Minimal state for testing generateScreeningResponse
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
    parts: [{ partNumber: 'AT514799', description: 'Hydraulic pump', quantity: 1 }],
    currentNode: 'bot_screening',
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
    status: 'in_progress',
    ...overrides,
  };
}

// ============================================================================
// detectBotScreening
// ============================================================================

describe('detectBotScreening', () => {
  describe('call_screen patterns', () => {
    it.each([
      'Hi, the person you are calling is using a screening service. Go ahead and say your name and why you are calling.',
      "The person you're calling is screening calls. Please say your name.",
      'This is Google Assistant. Who is calling?',
      'Go ahead and say your name and the reason for your call.',
      'Please state your name and the reason for calling.',
    ])('detects call screen: %s', (input) => {
      expect(detectBotScreening(input)).toBe('call_screen');
    });
  });

  describe('captcha patterns', () => {
    it.each([
      'To connect your call, please solve this puzzle: What is 5 plus 2?',
      'What is 10 minus 3?',
      'Please verify you are human before we connect you.',
      "Are you a real person? Prove you're not a robot.",
      'What is 4 times 6?',
    ])('detects captcha: %s', (input) => {
      expect(detectBotScreening(input)).toBe('captcha');
    });
  });

  describe('urgency_check patterns', () => {
    it.each([
      'Is this urgent?',
      'Do you need to get a hold of them urgently?',
      'Is this an emergency?',
      'Can this wait until tomorrow?',
    ])('detects urgency check: %s', (input) => {
      expect(detectBotScreening(input)).toBe('urgency_check');
    });
  });

  describe('spam_rejection patterns', () => {
    it.each([
      'Please remove this number from your mailing list. Goodbye.',
      'Do not call this number again.',
      'Stop calling us.',
      'This call has been rejected.',
      'The person you are calling does not wish to speak with you.',
      'This number is not accepting calls at this time.',
    ])('detects spam rejection: %s', (input) => {
      expect(detectBotScreening(input)).toBe('spam_rejection');
    });
  });

  describe('human responses (no detection)', () => {
    it.each([
      'Yeah, this is parts, what do you need?',
      'Hello?',
      'Sure, go ahead.',
      'We have that in stock, $45.99.',
      "Let me check on that for you.",
      'Can you spell the part number?',
    ])('returns null for human response: %s', (input) => {
      expect(detectBotScreening(input)).toBeNull();
    });
  });
});

// ============================================================================
// solveCaptcha
// ============================================================================

describe('solveCaptcha', () => {
  it('solves addition', () => {
    expect(solveCaptcha('What is 5 plus 2?')).toBe('7');
  });

  it('solves addition with "added to"', () => {
    expect(solveCaptcha('What is 10 added to 3?')).toBe('13');
  });

  it('solves addition with + symbol', () => {
    expect(solveCaptcha('What is 8 + 4?')).toBe('12');
  });

  it('solves subtraction', () => {
    expect(solveCaptcha('What is 10 minus 3?')).toBe('7');
  });

  it('solves subtraction with - symbol', () => {
    expect(solveCaptcha('What is 20 - 5?')).toBe('15');
  });

  it('solves multiplication with "times"', () => {
    expect(solveCaptcha('What is 4 times 6?')).toBe('24');
  });

  it('solves multiplication with "multiplied by"', () => {
    expect(solveCaptcha('What is 7 multiplied by 3?')).toBe('21');
  });

  it('solves multiplication with x', () => {
    expect(solveCaptcha('What is 5 x 9?')).toBe('45');
  });

  it('solves division', () => {
    expect(solveCaptcha('What is 20 divided by 4?')).toBe('5');
  });

  it('returns null for unsolvable input', () => {
    expect(solveCaptcha('Please verify you are human.')).toBeNull();
  });

  it('returns null for non-math text', () => {
    expect(solveCaptcha('Hi, this is the parts department.')).toBeNull();
  });
});

// ============================================================================
// generateScreeningResponse
// ============================================================================

describe('generateScreeningResponse', () => {
  const state = makeState();

  it('generates call screen response with org name', () => {
    const response = generateScreeningResponse('call_screen', state);
    expect(response).toContain('TestCo Equipment');
    expect(response).toContain('parts inquiry');
  });

  it('generates captcha response with math answer', () => {
    const stateWithCaptcha = makeState({
      conversationHistory: [
        { speaker: 'supplier', text: 'What is 5 plus 2?', timestamp: new Date() },
      ],
    });
    const response = generateScreeningResponse('captcha', stateWithCaptcha);
    expect(response).toBe('7');
  });

  it('generates captcha fallback for unsolvable captcha', () => {
    const stateWithBadCaptcha = makeState({
      conversationHistory: [
        { speaker: 'supplier', text: 'Verify you are human.', timestamp: new Date() },
      ],
    });
    const response = generateScreeningResponse('captcha', stateWithBadCaptcha);
    expect(response).toContain('TestCo Equipment');
  });

  it('generates urgency check response', () => {
    const response = generateScreeningResponse('urgency_check', state);
    expect(response).toContain('not urgent');
    expect(response).toContain('parts department');
  });

  it('generates spam rejection response', () => {
    const response = generateScreeningResponse('spam_rejection', state);
    expect(response).toContain('Goodbye');
  });
});
