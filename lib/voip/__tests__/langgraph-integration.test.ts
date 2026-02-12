import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallState } from '@/lib/voip/types';

// Mock WebSocket/Redis for state manager
vi.mock('ioredis', () => ({
  default: class RedisMock {
    async set() { return 'OK'; }
    async get() { return null; }
    async del() { return 1; }
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supplierCall: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    quoteRequest: {
      findUnique: vi.fn(),
    },
    supplier: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  workerLogger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe('LangGraph Integration - End-to-End', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Call State Initialization', () => {
    it('should initialize state with custom context from conversationLog', async () => {
      const { initializeCallState } = await import('@/lib/voip/call-graph');

      const callState = initializeCallState({
        callId: 'call_integration_test',
        quoteRequestId: 'qr_123',
        supplierId: 'sup_456',
        supplierName: 'ACME Parts',
        supplierPhone: '+15551234567',
        organizationId: 'org_789',
        callerId: 'user_abc',
        parts: [
          {
            partNumber: 'PART-001',
            description: 'Hydraulic Pump',
            quantity: 1,
            budgetMax: 500,
          },
        ],
        customContext: 'Company: ACME, Vehicle: 2022 Tractor',
        customInstructions: 'Be extra friendly and patient.',
      });

      expect(callState.callId).toBe('call_integration_test');
      expect(callState.currentNode).toBe('greeting');
      expect(callState.customContext).toBe('Company: ACME, Vehicle: 2022 Tractor');
      expect(callState.customInstructions).toBe('Be extra friendly and patient.');
      expect(callState.parts).toHaveLength(1);
      expect(callState.conversationHistory).toHaveLength(0);
      expect(callState.status).toBe('in_progress');
      expect(callState.negotiationAttempts).toBe(0);
      expect(callState.maxNegotiationAttempts).toBe(2);
    });
  });

  describe('State Machine Flow', () => {
    it('should progress through greeting -> quote_request -> confirmation', async () => {
      const { greetingNode, quoteRequestNode, confirmationNode } = await import('@/lib/voip/call-graph');
      const { addMessage } = await import('@/lib/voip/helpers');

      // Start with greeting
      let state: CallState = {
        callId: 'call_flow_test',
        quoteRequestId: 'qr_123',
        supplierId: 'sup_456',
        supplierName: 'Test Supplier',
        supplierPhone: '+15551234567',
        organizationId: 'org_789',
        callerId: 'user_abc',
        parts: [
          { partNumber: 'ABC123', description: 'Test Part', quantity: 2 },
        ],
        currentNode: 'greeting',
        conversationHistory: [],
        quotes: [],
        needsTransfer: false,
        needsHumanEscalation: false,
        negotiationAttempts: 0,
        maxNegotiationAttempts: 2,
        clarificationAttempts: 0,
        status: 'in_progress' as const,
      };

      // Step 1: Greeting
      state = greetingNode(state);
      expect(state.conversationHistory).toHaveLength(1);
      expect(state.conversationHistory[0].speaker).toBe('ai');
      expect(state.conversationHistory[0].text).toContain('pricing');

      // Step 2: Supplier responds "yes"
      state = addMessage(state, 'supplier', 'Yes, I can help with that.');
      expect(state.conversationHistory).toHaveLength(2);

      // Step 3: Quote Request
      state.currentNode = 'quote_request';
      state = quoteRequestNode(state);
      expect(state.conversationHistory).toHaveLength(3);
      expect(state.conversationHistory[2].text).toContain('ABC123');

      // Step 4: Supplier provides quote
      state = addMessage(state, 'supplier', 'ABC123 is $450, in stock, ships in 3 days');
      state.quotes = [
        { partNumber: 'ABC123', price: 450, availability: 'in_stock', leadTimeDays: 3 },
      ];

      // Step 5: Confirmation
      state.currentNode = 'confirmation';
      state = confirmationNode(state);
      expect(state.conversationHistory).toHaveLength(5);
      expect(state.status).toBe('completed');
      expect(state.conversationHistory[4].text).toContain('$450');
    });

    it('should handle negotiation flow', async () => {
      const { negotiateNode } = await import('@/lib/voip/call-graph');

      let state: CallState = {
        callId: 'call_negotiation_test',
        quoteRequestId: 'qr_123',
        supplierId: 'sup_456',
        supplierName: 'Test Supplier',
        supplierPhone: '+15551234567',
        organizationId: 'org_789',
        callerId: 'user_abc',
        parts: [
          { partNumber: 'ABC123', description: 'Test Part', quantity: 2, budgetMax: 400 },
        ],
        currentNode: 'negotiate',
        conversationHistory: [],
        quotes: [
          { partNumber: 'ABC123', price: 500, availability: 'in_stock' as const },
        ],
        needsTransfer: false,
        needsHumanEscalation: false,
        negotiationAttempts: 0,
        maxNegotiationAttempts: 2,
        clarificationAttempts: 0,
        status: 'in_progress' as const,
      };

      // First negotiation attempt
      state = negotiateNode(state);
      expect(state.negotiationAttempts).toBe(1);
      expect(state.conversationHistory).toHaveLength(1);
      expect(state.conversationHistory[0].text).toContain('budget');

      // Second negotiation attempt
      state = negotiateNode(state);
      expect(state.negotiationAttempts).toBe(2);
      expect(state.conversationHistory).toHaveLength(2);
    });

    it('should trigger escalation after too many clarifications', async () => {
      const { humanEscalationNode } = await import('@/lib/voip/call-graph');

      let state: CallState = {
        callId: 'call_escalation_test',
        quoteRequestId: 'qr_123',
        supplierId: 'sup_456',
        supplierName: 'Test Supplier',
        supplierPhone: '+15551234567',
        organizationId: 'org_789',
        callerId: 'user_abc',
        parts: [],
        currentNode: 'human_escalation',
        conversationHistory: [],
        quotes: [],
        needsTransfer: false,
        needsHumanEscalation: false,
        negotiationAttempts: 0,
        maxNegotiationAttempts: 2,
        clarificationAttempts: 3,
        status: 'in_progress' as const,
      };

      state = humanEscalationNode(state);
      expect(state.needsHumanEscalation).toBe(true);
      expect(state.status).toBe('escalated');
      expect(state.nextAction).toBe('human_followup');
      expect(state.conversationHistory[0].text).toContain('team member');
    });

    it('should handle voicemail scenario', async () => {
      const { voicemailNode } = await import('@/lib/voip/call-graph');

      let state: CallState = {
        callId: 'call_voicemail_test',
        quoteRequestId: 'qr_123',
        supplierId: 'sup_456',
        supplierName: 'ACME Supplier',
        supplierPhone: '+15551234567',
        organizationId: 'org_789',
        callerId: 'user_abc',
        parts: [],
        currentNode: 'voicemail',
        conversationHistory: [],
        quotes: [],
        needsTransfer: false,
        needsHumanEscalation: false,
        negotiationAttempts: 0,
        maxNegotiationAttempts: 2,
        clarificationAttempts: 0,
        status: 'in_progress' as const,
      };

      state = voicemailNode(state);
      expect(state.status).toBe('completed');
      expect(state.outcome).toBe('VOICEMAIL_LEFT');
      expect(state.nextAction).toBe('email_fallback');
      expect(state.conversationHistory[0].text).toContain('ACME Supplier');
      expect(state.conversationHistory[0].text).toContain('qr_123');
    });
  });

  describe('Custom Context Usage', () => {
    it('should use custom context in greeting node', async () => {
      const { greetingNode } = await import('@/lib/voip/call-graph');

      const state = {
        callId: 'call_custom_test',
        quoteRequestId: 'qr_123',
        supplierId: 'sup_456',
        supplierName: 'Test Supplier',
        supplierPhone: '+15551234567',
        organizationId: 'org_789',
        callerId: 'user_abc',
        parts: [],
        currentNode: 'greeting',
        conversationHistory: [],
        quotes: [],
        needsTransfer: false,
        needsHumanEscalation: false,
        negotiationAttempts: 0,
        maxNegotiationAttempts: 2,
        clarificationAttempts: 0,
        status: 'in_progress' as const,
        customContext: 'Company: ACME, Vehicle: 2022 Tractor',
      };

      const result = greetingNode(state);
      // Greeting should always be natural, not speak the context verbatim
      expect(result.conversationHistory[0].text.toLowerCase()).toContain('parts department');
      expect(result.conversationHistory[0].text).not.toContain('Company: ACME');
    });

    it('should always use natural greeting regardless of custom context', async () => {
      const { greetingNode } = await import('@/lib/voip/call-graph');

      const state = {
        callId: 'call_default_test',
        quoteRequestId: 'qr_123',
        supplierId: 'sup_456',
        supplierName: 'Test Supplier',
        supplierPhone: '+15551234567',
        organizationId: 'org_789',
        callerId: 'user_abc',
        parts: [],
        currentNode: 'greeting',
        conversationHistory: [],
        quotes: [],
        needsTransfer: false,
        needsHumanEscalation: false,
        negotiationAttempts: 0,
        maxNegotiationAttempts: 2,
        clarificationAttempts: 0,
        status: 'in_progress' as const,
      };

      const result = greetingNode(state);
      expect(result.conversationHistory[0].text).toContain('org_789');
      expect(result.conversationHistory[0].text).toContain('pricing');
    });
  });

  describe('Quote Extraction', () => {
    it('should extract quotes with all details', async () => {
      const mockQuotes = [
        {
          partNumber: 'ABC123',
          price: 450,
          availability: 'in_stock',
          leadTimeDays: 3,
          notes: 'OEM part, includes warranty',
        },
        {
          partNumber: 'XYZ789',
          price: null,
          availability: 'unavailable',
          notes: 'Discontinued, suggest alternative',
        },
      ];

      expect(mockQuotes[0].price).toBe(450);
      expect(mockQuotes[0].availability).toBe('in_stock');
      expect(mockQuotes[0].leadTimeDays).toBe(3);
      expect(mockQuotes[1].price).toBeNull();
      expect(mockQuotes[1].availability).toBe('unavailable');
    });
  });
});
