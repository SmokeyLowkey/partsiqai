/**
 * VOIP Call Flow Tests
 *
 * Tests the LangGraph state machine conversation flow without making actual calls.
 * Tests individual nodes and routing functions directly for reliability.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeCallState,
  greetingNode,
  quoteRequestNode,
  confirmationNode,
  routeFromGreeting,
  routeFromQuoteRequest,
} from '../call-graph';
import { addMessage } from '../helpers';
import { CallState } from '../types';

// Create a mock LLM client
function createMockLLM(overrides?: Partial<Record<string, (prompt: string) => string>>) {
  const defaultHandler = (prompt: string): string => {
    // Intent classification — extract the supplier response from the prompt
    if (prompt.includes('Classify this supplier phone response')) {
      // Extract just the supplier's response text from the prompt
      const match = prompt.match(/Supplier said: "([^"]+)"/);
      const response = match ? match[1].toLowerCase() : '';

      if (response.includes('voicemail') || response.includes('leave a message')) return 'voicemail';
      if (response.includes('hold on') || response.includes('let me transfer')) return 'transfer_needed';
      if (response.includes('not interested')) return 'not_interested';
      if (response.includes('speaking to parts') || response.includes('this is parts') || response.includes('can help')) return 'yes_can_help';
      return 'yes_can_help';
    }

    // Price extraction
    if (prompt.includes('Extract pricing from this supplier response')) {
      if (prompt.includes('$245.50')) {
        return JSON.stringify([{
          partNumber: 'T478319',
          price: 245.50,
          availability: 'in_stock',
          leadTimeDays: 0,
          notes: 'OEM part'
        }]);
      }
      if (prompt.includes('$350')) {
        return JSON.stringify([{
          partNumber: 'EXPENSIVE-001',
          price: 350,
          availability: 'in_stock',
        }]);
      }
      return '[]';
    }

    // Question detection
    if (prompt.includes('Does this contain a question')) {
      return prompt.includes('?') ? 'yes' : 'no';
    }

    if (prompt.includes('Generate a natural')) {
      return 'Thank you for that information.';
    }

    return 'yes_can_help';
  };

  return {
    generateCompletion: vi.fn((prompt: string) => {
      if (overrides?.generateCompletion) {
        return overrides.generateCompletion(prompt);
      }
      return defaultHandler(prompt);
    }),
  } as any;
}

describe('VOIP Call Flow - Initialization', () => {
  it('should start with greeting node', () => {
    const state = initializeCallState({
      callId: 'test-call-123',
      quoteRequestId: 'qr-123',
      supplierId: 'supplier-456',
      supplierName: 'Test Parts Supply',
      supplierPhone: '+12345678900',
      organizationId: 'org-789',
      callerId: 'user-001',
      parts: [{ partNumber: 'T478319', description: 'Cab door window pane', quantity: 1 }],
    });

    expect(state.currentNode).toBe('greeting');
    expect(state.conversationHistory).toHaveLength(0);
  });
});

describe('VOIP Call Flow - Greeting Node', () => {
  it('should produce a natural greeting mentioning parts department', () => {
    const state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
    });

    const result = greetingNode(state);
    expect(result.conversationHistory).toHaveLength(1);
    expect(result.conversationHistory[0].speaker).toBe('ai');
    expect(result.conversationHistory[0].text.toLowerCase()).toContain('parts department');
  });

  it('should NOT include custom context verbatim in greeting', () => {
    const state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
      customContext: 'Company: ACME\nQuote Request: #123\nVehicle: 2022 Tractor',
    });

    const result = greetingNode(state);
    const greeting = result.conversationHistory[0].text;
    expect(greeting).not.toContain('Company: ACME');
    expect(greeting).not.toContain('Quote Request: #123');
  });
});

describe('VOIP Call Flow - Routing from Greeting', () => {
  it('should route to quote_request when supplier can help', async () => {
    const mockLLM = createMockLLM();
    let state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
    });

    state = greetingNode(state);
    state = addMessage(state, 'supplier', "Yes, you're speaking to parts.");

    const nextNode = await routeFromGreeting(mockLLM, state);
    expect(nextNode).toBe('quote_request');
  });

  it('should route to transfer when supplier says hold on', async () => {
    const mockLLM = createMockLLM();
    let state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
    });

    state = greetingNode(state);
    state = addMessage(state, 'supplier', "Hold on, let me transfer you to parts.");

    const nextNode = await routeFromGreeting(mockLLM, state);
    // Supplier is already transferring — acknowledge and wait, don't ask to be transferred
    expect(nextNode).toBe('hold_acknowledgment');
  });

  it('should route to voicemail when detected', async () => {
    const mockLLM = createMockLLM();
    let state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
    });

    state = greetingNode(state);
    state = addMessage(state, 'supplier', "You've reached the voicemail of Test Parts Supply.");

    const nextNode = await routeFromGreeting(mockLLM, state);
    expect(nextNode).toBe('voicemail');
  });

  it('should route to polite_end when not interested', async () => {
    const mockLLM = createMockLLM();
    let state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
    });

    state = greetingNode(state);
    state = addMessage(state, 'supplier', "Sorry, we're not interested in phone quote requests.");

    const nextNode = await routeFromGreeting(mockLLM, state);
    expect(nextNode).toBe('polite_end');
  });
});

describe('VOIP Call Flow - Quote Request Node', () => {
  it('should use natural description on first mention', () => {
    let state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'T478319', description: 'Cab door window pane', quantity: 1 }],
    });

    state = greetingNode(state);
    state = addMessage(state, 'supplier', 'Yes, this is parts.');
    state.currentNode = 'quote_request';
    state = quoteRequestNode(state);

    const lastAiMsg = state.conversationHistory.filter(m => m.speaker === 'ai').pop();
    expect(lastAiMsg?.text).toContain('Cab door window pane');
    // Should NOT contain raw part number on first mention
    expect(lastAiMsg?.text).not.toContain('T478319');
  });

  it('should include part numbers on second mention', () => {
    let state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'T478319', description: 'Cab door window pane', quantity: 1 }],
    });

    // First mention
    state = greetingNode(state);
    state = addMessage(state, 'supplier', 'Yes, this is parts.');
    state.currentNode = 'quote_request';
    state = quoteRequestNode(state);

    // Supplier asks for part numbers
    state = addMessage(state, 'supplier', 'Sure, what are the part numbers?');
    state = quoteRequestNode(state);

    const lastAiMsg = state.conversationHistory.filter(m => m.speaker === 'ai').pop();
    // Second mention should include spelled-out part number (one at a time)
    expect(lastAiMsg?.text).toContain('4 7 8 3 1 9');
    expect(lastAiMsg?.text).toContain('part number');
  });
});

describe('VOIP Call Flow - Routing from Quote Request', () => {
  it('should extract pricing and route forward', async () => {
    const mockLLM = createMockLLM();
    let state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'T478319', description: 'Cab door window pane', quantity: 1 }],
    });

    state = greetingNode(state);
    state = addMessage(state, 'supplier', 'Yes, this is parts.');
    state.currentNode = 'quote_request';
    state = quoteRequestNode(state);
    state = addMessage(state, 'supplier', 'T478319 is in stock for $245.50, ships same day.');

    const nextNode = await routeFromQuoteRequest(mockLLM, state);
    // Should route to confirmation (or misc_costs_inquiry if hasMiscCosts)
    expect(nextNode).toBe('confirmation');
  });

  it('should route to negotiate when price exceeds budget', async () => {
    const mockLLM = createMockLLM();
    let state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'EXPENSIVE-001', description: 'Expensive part', quantity: 1, budgetMax: 200 }],
    });

    state = greetingNode(state);
    state = addMessage(state, 'supplier', 'Yes, this is parts.');
    state.currentNode = 'quote_request';
    state = quoteRequestNode(state);
    state = addMessage(state, 'supplier', 'That part is $350.');

    const nextNode = await routeFromQuoteRequest(mockLLM, state);
    expect(nextNode).toBe('negotiate');
  });

  it('should route to clarification when supplier asks a question', async () => {
    const mockLLM = createMockLLM();
    let state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
    });

    state = greetingNode(state);
    state = addMessage(state, 'supplier', 'Yes, this is parts.');
    state.currentNode = 'quote_request';
    state = quoteRequestNode(state);
    state = addMessage(state, 'supplier', 'What machine is this for?');

    const nextNode = await routeFromQuoteRequest(mockLLM, state);
    // "What machine" is a verification question → conversational_response
    expect(nextNode).toBe('conversational_response');
  });
});

describe('State Persistence', () => {
  it('should maintain conversation history across nodes', () => {
    let state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
    });

    // Turn 1: Greeting
    state = greetingNode(state);
    expect(state.conversationHistory).toHaveLength(1);

    // Turn 2: Supplier
    state = addMessage(state, 'supplier', 'Yes, this is parts.');
    expect(state.conversationHistory).toHaveLength(2);

    // Turn 3: Quote request
    state.currentNode = 'quote_request';
    state = quoteRequestNode(state);
    expect(state.conversationHistory).toHaveLength(3);

    // Verify speakers
    expect(state.conversationHistory[0].speaker).toBe('ai');
    expect(state.conversationHistory[1].speaker).toBe('supplier');
    expect(state.conversationHistory[2].speaker).toBe('ai');
  });
});

describe('Custom Context Integration', () => {
  it('should include custom context in state', () => {
    const customContext = `Company: ACME Construction
Quote Request: #REQ-123
Vehicle: 2015 John Deere 160GLC`;

    const state = initializeCallState({
      callId: 'test',
      quoteRequestId: 'qr',
      supplierId: 's1',
      supplierName: 'Acme',
      supplierPhone: '+15551234567',
      organizationId: 'org1',
      callerId: 'c1',
      parts: [
        { partNumber: 'T478319', description: 'Cab door window pane', quantity: 1 },
        { partNumber: 'RE506428', description: 'Engine oil filter', quantity: 3 },
      ],
      customContext,
      customInstructions: 'Be extra friendly. This is a VIP customer.',
    });

    expect(state.customContext).toBe(customContext);
    expect(state.customInstructions).toContain('VIP customer');
    expect(state.parts).toHaveLength(2);
  });
});
