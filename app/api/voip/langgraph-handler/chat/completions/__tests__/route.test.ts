import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// Mock dependencies
vi.mock('@/lib/voip/state-manager', () => ({
  getCallState: vi.fn(),
  saveCallState: vi.fn(),
}));

vi.mock('@/lib/voip/call-graph', () => ({
  processCallTurn: vi.fn(),
}));

vi.mock('@/lib/voip/helpers', () => ({
  getLastAIMessage: vi.fn(),
  addMessage: vi.fn((state, speaker, text) => ({
    ...state,
    conversationHistory: [
      ...state.conversationHistory,
      { speaker, text, timestamp: new Date() },
    ],
  })),
}));

vi.mock('@/lib/services/llm/openrouter-client', () => ({
  OpenRouterClient: {
    fromOrganization: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('@/lib/logger', () => ({
  workerLogger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

describe('LangGraph Handler API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOIP_WEBHOOK_SECRET = 'test-webhook-secret';
  });

  describe('POST /api/voip/langgraph-handler', () => {
    it('should process supplier response through LangGraph', async () => {
      const { getCallState, saveCallState } = await import('@/lib/voip/state-manager');
      const { processCallTurn } = await import('@/lib/voip/call-graph');
      const { getLastAIMessage, addMessage } = await import('@/lib/voip/helpers');

      // Mock call state
      const mockState = {
        callId: 'call_123',
        quoteRequestId: 'qr_456',
        supplierId: 'sup_789',
        supplierName: 'Test Supplier',
        supplierPhone: '+15551234567',
        organizationId: 'org_abc',
        callerId: 'user_def',
        parts: [
          {
            partNumber: 'ABC123',
            description: 'Test Part',
            quantity: 2,
          },
        ],
        currentNode: 'greeting',
        conversationHistory: [],
        quotes: [],
        needsTransfer: false,
        needsHumanEscalation: false,
        negotiationAttempts: 0,
        maxNegotiationAttempts: 2,
        negotiatedParts: [],
        clarificationAttempts: 0,
        status: 'in_progress' as const,
      };

      const newState = {
        ...mockState,
        currentNode: 'quote_request',
        conversationHistory: [
          { speaker: 'ai' as const, text: 'Hi, can you help?', timestamp: new Date() },
          { speaker: 'supplier' as const, text: 'Yes, I can help', timestamp: new Date() },
        ],
      };

      (getCallState as any).mockResolvedValue(mockState);
      (addMessage as any).mockReturnValue({
        ...mockState,
        conversationHistory: [
          { speaker: 'supplier' as const, text: 'Yes, I can help', timestamp: new Date() },
        ],
      });
      (processCallTurn as any).mockResolvedValue(newState);
      (getLastAIMessage as any).mockReturnValue('Great! Let me get your quote request.');
      (saveCallState as any).mockResolvedValue(undefined);

      // Create request
      const request = new NextRequest('http://localhost:3000/api/voip/langgraph-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-webhook-secret',
        },
        body: JSON.stringify({
          message: {
            role: 'user',
            content: 'Yes, I can help',
          },
          call: {
            id: 'vapi_call_123',
            metadata: {
              callLogId: 'call_123',
            },
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data.message.role).toBe('assistant');
      expect(data.message.content).toBe('Great! Let me get your quote request.');
      expect(data.endCall).toBe(false);
      expect(data.metadata.currentNode).toBe('quote_request');
      expect(data.metadata.status).toBe('in_progress');
      expect(data.metadata.needsEscalation).toBe(false);

      // Verify state manager was called
      expect(getCallState).toHaveBeenCalledWith('call_123');
      expect(saveCallState).toHaveBeenCalledWith('call_123', newState);
      expect(processCallTurn).toHaveBeenCalled();
    });

    it('should end call when status is completed', async () => {
      const { getCallState, saveCallState } = await import('@/lib/voip/state-manager');
      const { processCallTurn } = await import('@/lib/voip/call-graph');
      const { getLastAIMessage, addMessage } = await import('@/lib/voip/helpers');

      const completedState = {
        callId: 'call_123',
        quoteRequestId: 'qr_456',
        supplierId: 'sup_789',
        supplierName: 'Test Supplier',
        supplierPhone: '+15551234567',
        organizationId: 'org_abc',
        callerId: 'user_def',
        parts: [],
        currentNode: 'confirmation',
        conversationHistory: [],
        quotes: [{ partNumber: 'ABC123', price: 450, availability: 'in_stock' as const }],
        needsTransfer: false,
        needsHumanEscalation: false,
        negotiationAttempts: 1,
        maxNegotiationAttempts: 2,
        negotiatedParts: [],
        clarificationAttempts: 0,
        status: 'completed' as const,
      };

      (getCallState as any).mockResolvedValue(completedState);
      (addMessage as any).mockReturnValue(completedState);
      (processCallTurn as any).mockResolvedValue(completedState);
      (getLastAIMessage as any).mockReturnValue('Perfect! We\'ll send a formal quote request. Thank you!');
      (saveCallState as any).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/voip/langgraph-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-webhook-secret',
        },
        body: JSON.stringify({
          message: { role: 'user', content: 'That sounds good' },
          call: { metadata: { callLogId: 'call_123' } },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.endCall).toBe(true);
      expect(data.metadata.status).toBe('completed');
      expect(data.metadata.quotesExtracted).toBe(1);
    });

    it('should end call when escalation is needed', async () => {
      const { getCallState } = await import('@/lib/voip/state-manager');
      const { processCallTurn } = await import('@/lib/voip/call-graph');
      const { getLastAIMessage, addMessage } = await import('@/lib/voip/helpers');

      const escalatedState = {
        callId: 'call_123',
        quoteRequestId: 'qr_456',
        supplierId: 'sup_789',
        supplierName: 'Test Supplier',
        supplierPhone: '+15551234567',
        organizationId: 'org_abc',
        callerId: 'user_def',
        parts: [],
        currentNode: 'human_escalation',
        conversationHistory: [],
        quotes: [],
        needsTransfer: false,
        needsHumanEscalation: true,
        negotiationAttempts: 0,
        maxNegotiationAttempts: 2,
        clarificationAttempts: 3,
        status: 'escalated' as const,
      };

      (getCallState as any).mockResolvedValue(escalatedState);
      (addMessage as any).mockReturnValue(escalatedState);
      (processCallTurn as any).mockResolvedValue(escalatedState);
      (getLastAIMessage as any).mockReturnValue('Let me connect you with one of our team members.');

      const request = new NextRequest('http://localhost:3000/api/voip/langgraph-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-webhook-secret',
        },
        body: JSON.stringify({
          message: { role: 'user', content: 'I need to speak to someone' },
          call: { metadata: { callLogId: 'call_123' } },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.endCall).toBe(true);
      expect(data.metadata.needsEscalation).toBe(true);
      expect(data.metadata.status).toBe('escalated');
    });

    it('should reject unauthorized requests in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const request = new NextRequest('http://localhost:3000/api/voip/langgraph-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer wrong-secret',
        },
        body: JSON.stringify({
          message: { role: 'user', content: 'Test' },
          call: { metadata: { callLogId: 'call_123' } },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);

      process.env.NODE_ENV = originalEnv;
    });

    it('should return 404 when call state not found', async () => {
      const { getCallState } = await import('@/lib/voip/state-manager');

      (getCallState as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/voip/langgraph-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-webhook-secret',
        },
        body: JSON.stringify({
          message: { role: 'user', content: 'Test' },
          call: { metadata: { callLogId: 'nonexistent_call' } },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Call state not found');
    });

    it('should handle errors gracefully', async () => {
      const { getCallState } = await import('@/lib/voip/state-manager');

      (getCallState as any).mockRejectedValue(new Error('Redis connection failed'));

      const request = new NextRequest('http://localhost:3000/api/voip/langgraph-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-webhook-secret',
        },
        body: JSON.stringify({
          message: { role: 'user', content: 'Test' },
          call: { metadata: { callLogId: 'call_123' } },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Should return 200 with graceful error message to keep call going
      expect(response.status).toBe(200);
      expect(data.endCall).toBe(true);
      expect(data.message.content).toContain('technical difficulties');
      expect(data.metadata.error).toBe(true);
    });
  });

  describe('GET /api/voip/langgraph-handler', () => {
    it('should return health check', async () => {
      const request = new NextRequest('http://localhost:3000/api/voip/langgraph-handler', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.endpoint).toBe('langgraph-handler');
      expect(data.timestamp).toBeDefined();
    });
  });
});
