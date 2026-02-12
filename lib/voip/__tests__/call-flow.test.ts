/**
 * VOIP Call Flow Tests
 * 
 * Tests the LangGraph state machine conversation flow without making actual calls.
 * Simulates different supplier responses and validates AI behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeCallState, processCallTurn } from '../call-graph';
import { addMessage } from '../helpers';
import { CallState } from '../types';
import { OpenRouterClient } from '@/lib/services/llm/openrouter-client';

// Mock OpenRouter client
vi.mock('@/lib/services/llm/openrouter-client', () => ({
  OpenRouterClient: {
    fromOrganization: vi.fn(() => ({
      complete: vi.fn((messages) => {
        // Mock LLM responses based on the conversation context
        const lastMessage = messages[messages.length - 1]?.content || '';
        
        // Intent classification
        if (lastMessage.includes('classify the intent')) {
          if (lastMessage.includes('speaking to parts')) return 'yes_can_help';
          if (lastMessage.includes('hold on')) return 'transfer_needed';
          if (lastMessage.includes('not interested')) return 'not_interested';
          return 'yes_can_help';
        }
        
        // Price extraction
        if (lastMessage.includes('extract pricing')) {
          return JSON.stringify([{
            partNumber: 'T478319',
            price: 245.50,
            availability: 'in_stock',
            leadTimeDays: 0,
            notes: 'OEM part'
          }]);
        }
        
        // Question detection
        if (lastMessage.includes('Does this contain a question')) {
          return lastMessage.includes('what') || lastMessage.includes('which') ? 'yes' : 'no';
        }
        
        return 'yes_can_help';
      }),
    })),
  },
}));

describe('VOIP Call Flow - Happy Path', () => {
  let initialState: CallState;
  let mockLLM: any;

  beforeEach(async () => {
    // Initialize a test call
    initialState = initializeCallState({
      callId: 'test-call-123',
      quoteRequestId: 'qr-123',
      supplierId: 'supplier-456',
      supplierName: 'Test Parts Supply',
      supplierPhone: '+12345678900',
      organizationId: 'org-789',
      callerId: 'user-001',
      parts: [
        {
          partNumber: 'T478319',
          description: 'Cab door window pane',
          quantity: 1,
          budgetMax: 300,
        },
      ],
      customContext: `Company: ACME Construction
Quote Request: #REQ-123
Vehicle: 2022 John Deere 333 (Serial: F4215444)

Parts Needed (1 part):
1. T478319 - Cab door window pane`,
      customInstructions: `Be natural and friendly. Ask for parts department first.`,
    });

    mockLLM = await OpenRouterClient.fromOrganization('org-789');
  });

  it('should start with greeting node', () => {
    expect(initialState.currentNode).toBe('greeting');
    expect(initialState.conversationHistory).toHaveLength(0);
  });

  it('should flow: greeting → quote_request → price_extract → confirmation', async () => {
    // Turn 1: AI sends greeting
    let state = await processCallTurn(mockLLM, initialState);
    expect(state.currentNode).toBe('greeting');
    expect(state.conversationHistory).toHaveLength(1);
    expect(state.conversationHistory[0].speaker).toBe('ai');
    expect(state.conversationHistory[0].text).toContain('parts department');

    // Turn 2: Supplier confirms they're in parts dept
    state = addMessage(state, 'supplier', "Yes, you're speaking to parts. How can I help you?");
    state = await processCallTurn(mockLLM, state);
    
    // Should route to quote_request
    expect(state.currentNode).toBe('quote_request');
    expect(state.conversationHistory).toHaveLength(3);
    const quoteRequestMsg = state.conversationHistory[2].text;
    expect(quoteRequestMsg).toContain('T478319');
    expect(quoteRequestMsg).toContain('Cab door window pane');

    // Turn 3: Supplier provides pricing
    state = addMessage(
      state,
      'supplier',
      "Sure! Part number T478319, the cab door window pane - we have that in stock for $245.50. It's the OEM part and ships same day."
    );
    state = await processCallTurn(mockLLM, state);

    // Should extract pricing and move to confirmation
    expect(state.currentNode).toBe('confirmation');
    expect(state.quotes.length).toBeGreaterThan(0);
    expect(state.quotes[0]).toMatchObject({
      partNumber: 'T478319',
      price: 245.50,
      availability: 'in_stock',
    });
  });

  it('should handle transfer request', async () => {
    // AI sends greeting
    let state = await processCallTurn(mockLLM, initialState);

    // Receptionist asks to hold
    state = addMessage(state, 'supplier', "Hold on, let me transfer you to parts.");
    state = await processCallTurn(mockLLM, state);

    // Should route to transfer node
    expect(state.currentNode).toBe('transfer');
    expect(state.needsTransfer).toBe(true);
  });
});

describe('VOIP Call Flow - Edge Cases', () => {
  let mockLLM: any;

  beforeEach(async () => {
    mockLLM = await OpenRouterClient.fromOrganization('org-789');
  });

  it('should handle voicemail detection', async () => {
    const state = initializeCallState({
      callId: 'test-call-voicemail',
      quoteRequestId: 'qr-123',
      supplierId: 'supplier-456',
      supplierName: 'Test Parts Supply',
      supplierPhone: '+12345678900',
      organizationId: 'org-789',
      callerId: 'user-001',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
    });

    // Mock voicemail detection
    mockLLM.complete = vi.fn(() => 'voicemail');

    let newState = await processCallTurn(mockLLM, state);
    newState = addMessage(newState, 'supplier', "You've reached the voicemail of...");
    newState = await processCallTurn(mockLLM, newState);

    expect(newState.currentNode).toBe('voicemail');
  });

  it('should handle not interested response', async () => {
    const state = initializeCallState({
      callId: 'test-call-not-interested',
      quoteRequestId: 'qr-123',
      supplierId: 'supplier-456',
      supplierName: 'Test Parts Supply',
      supplierPhone: '+12345678900',
      organizationId: 'org-789',
      callerId: 'user-001',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
    });

    mockLLM.complete = vi.fn(() => 'not_interested');

    let newState = await processCallTurn(mockLLM, state);
    newState = addMessage(newState, 'supplier', "Sorry, we're not interested in new quote requests.");
    newState = await processCallTurn(mockLLM, newState);

    expect(newState.currentNode).toBe('polite_end');
  });

  it('should handle negotiation when price exceeds budget', async () => {
    const state = initializeCallState({
      callId: 'test-call-negotiate',
      quoteRequestId: 'qr-123',
      supplierId: 'supplier-456',
      supplierName: 'Test Parts Supply',
      supplierPhone: '+12345678900',
      organizationId: 'org-789',
      callerId: 'user-001',
      parts: [
        {
          partNumber: 'EXPENSIVE-001',
          description: 'Expensive part',
          quantity: 1,
          budgetMax: 200, // Budget is $200
        },
      ],
    });

    // Mock price extraction returning $350 (over budget)
    mockLLM.complete = vi.fn((messages) => {
      const lastMessage = messages[messages.length - 1]?.content || '';
      
      if (lastMessage.includes('extract pricing')) {
        return JSON.stringify([{
          partNumber: 'EXPENSIVE-001',
          price: 350, // Over budget!
          availability: 'in_stock',
        }]);
      }
      return 'yes_can_help';
    });

    // Process through quote request
    let newState = await processCallTurn(mockLLM, state);
    newState = addMessage(newState, 'supplier', "Yes, speaking.");
    newState = await processCallTurn(mockLLM, newState);
    newState = addMessage(newState, 'supplier', "That part is $350.");
    newState = await processCallTurn(mockLLM, newState);

    // Should attempt negotiation
    expect(newState.currentNode).toBe('negotiate');
    expect(newState.negotiationAttempts).toBeGreaterThan(0);
  });
});

describe('Custom Context Integration', () => {
  it('should include custom context in state', () => {
    const customContext = `Company: ACME Construction
Quote Request: #REQ-123
Vehicle: 2015 John Deere 160GLC (Serial: 1FF160GXAFD056160)

Parts Needed (2 parts):
1. T478319 - Cab door window pane (Qty: 1)
2. RE506428 - Engine oil filter (Qty: 3)`;

    const state = initializeCallState({
      callId: 'test-call-custom',
      quoteRequestId: 'qr-123',
      supplierId: 'supplier-456',
      supplierName: 'Test Parts Supply',
      supplierPhone: '+12345678900',
      organizationId: 'org-789',
      callerId: 'user-001',
      parts: [
        { partNumber: 'T478319', description: 'Cab door window pane', quantity: 1 },
        { partNumber: 'RE506428', description: 'Engine oil filter', quantity: 3 },
      ],
      customContext: customContext,
      customInstructions: 'Be extra friendly. This is a VIP customer.',
    });

    expect(state.customContext).toBe(customContext);
    expect(state.customInstructions).toContain('VIP customer');
    expect(state.parts).toHaveLength(2);
  });

  it('should NOT speak custom context verbatim in greeting', async () => {
    const mockLLM = await OpenRouterClient.fromOrganization('org-789');
    
    const state = initializeCallState({
      callId: 'test-call-no-verbatim',
      quoteRequestId: 'qr-123',
      supplierId: 'supplier-456',
      supplierName: 'Test Parts Supply',
      supplierPhone: '+12345678900',
      organizationId: 'org-789',
      callerId: 'user-001',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
      customContext: `Company: ACME
Quote Request: #123
Vehicle: 2022 Tractor`,
    });

    const newState = await processCallTurn(mockLLM, state);
    const greetingMessage = newState.conversationHistory[0]?.text || '';

    // Should NOT contain the structured data format
    expect(greetingMessage).not.toContain('Company: ACME');
    expect(greetingMessage).not.toContain('Quote Request: #123');
    
    // Should contain natural language
    expect(greetingMessage.toLowerCase()).toContain('parts department');
  });
});

describe('State Persistence', () => {
  it('should maintain conversation history across turns', async () => {
    const mockLLM = await OpenRouterClient.fromOrganization('org-789');
    
    let state = initializeCallState({
      callId: 'test-call-history',
      quoteRequestId: 'qr-123',
      supplierId: 'supplier-456',
      supplierName: 'Test Parts Supply',
      supplierPhone: '+12345678900',
      organizationId: 'org-789',
      callerId: 'user-001',
      parts: [{ partNumber: 'TEST-001', description: 'Test part', quantity: 1 }],
    });

    // Turn 1
    state = await processCallTurn(mockLLM, state);
    expect(state.conversationHistory).toHaveLength(1);

    // Turn 2
    state = addMessage(state, 'supplier', 'Yes, this is parts.');
    expect(state.conversationHistory).toHaveLength(2);

    // Turn 3
    state = await processCallTurn(mockLLM, state);
    expect(state.conversationHistory).toHaveLength(3);

    // Verify all speakers are tracked
    expect(state.conversationHistory[0].speaker).toBe('ai');
    expect(state.conversationHistory[1].speaker).toBe('supplier');
    expect(state.conversationHistory[2].speaker).toBe('ai');
  });
});
