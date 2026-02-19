import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// Mock dependencies
vi.mock('@/lib/voip/state-manager', () => ({
  getCallState: vi.fn(),
  saveCallState: vi.fn(),
  acquireCallLock: vi.fn(() => Promise.resolve(true)),
  releaseCallLock: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/voip/call-graph', () => ({
  processCallTurn: vi.fn(),
  streamConversationalResponse: vi.fn(),
  routeFromConversationalResponse: vi.fn(),
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

vi.mock('@/lib/logger', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => mockLogger,
  };
  return {
    workerLogger: mockLogger,
    queueLogger: mockLogger,
  };
});

vi.mock('@/lib/voip/overseer', () => ({
  runOverseerAsync: vi.fn(() => Promise.resolve()),
  consumeNudge: vi.fn(() => Promise.resolve(null)),
  initOverseerState: vi.fn(),
  saveOverseerState: vi.fn(),
}));

/** Helper: build a Vapi-style OpenAI request body */
function buildVapiRequestBody(userContent: string, callLogId: string) {
  return {
    model: 'langgraph-state-machine',
    messages: [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: userContent },
    ],
    stream: false,
    call: {
      id: 'vapi_call_123',
      metadata: { callLogId },
    },
  };
}

/** Helper: build a POST request to the handler */
function buildPostRequest(body: any) {
  return new NextRequest(
    'http://localhost:3000/api/voip/langgraph-handler/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-webhook-secret',
      },
      body: JSON.stringify(body),
    },
  );
}

describe('LangGraph Handler API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOIP_WEBHOOK_SECRET = 'test-webhook-secret';
  });

  describe('POST /api/voip/langgraph-handler/chat/completions', () => {
    it('should process supplier response and return OpenAI Chat Completions format', async () => {
      const { getCallState, saveCallState } = await import('@/lib/voip/state-manager');
      const { processCallTurn } = await import('@/lib/voip/call-graph');
      const { getLastAIMessage } = await import('@/lib/voip/helpers');

      const mockState = {
        callId: 'call_123',
        quoteRequestId: 'qr_456',
        supplierId: 'sup_789',
        supplierName: 'Test Supplier',
        supplierPhone: '+15551234567',
        organizationId: 'org_abc',
        callerId: 'user_def',
        parts: [{ partNumber: 'ABC123', description: 'Test Part', quantity: 2 }],
        currentNode: 'greeting',
        conversationHistory: [],
        quotes: [],
        needsTransfer: false,
        needsHumanEscalation: false,
        negotiationAttempts: 0,
        maxNegotiationAttempts: 2,
        negotiatedParts: [],
        clarificationAttempts: 0,
        turnNumber: 0,
        status: 'in_progress' as const,
      };

      const newState = {
        ...mockState,
        currentNode: 'quote_request',
        turnNumber: 1,
        conversationHistory: [
          { speaker: 'ai' as const, text: 'Hi, can you help?', timestamp: new Date() },
          { speaker: 'supplier' as const, text: 'Yes, I can help', timestamp: new Date() },
        ],
      };

      (getCallState as any).mockResolvedValue(mockState);
      (processCallTurn as any).mockResolvedValue(newState);
      (getLastAIMessage as any).mockReturnValue('Great! Let me get your quote request.');
      (saveCallState as any).mockResolvedValue(undefined);

      const request = buildPostRequest(buildVapiRequestBody('Yes, I can help', 'call_123'));
      const response = await POST(request);
      const data = await response.json();

      // OpenAI Chat Completions format
      expect(response.status).toBe(200);
      expect(data.object).toBe('chat.completion');
      expect(data.choices[0].message.role).toBe('assistant');
      expect(data.choices[0].message.content).toBe('Great! Let me get your quote request.');
      expect(data.choices[0].finish_reason).toBe('stop');

      // No endCall tool_call for in-progress calls
      expect(data.choices[0].message.tool_calls).toBeUndefined();

      // Verify state manager was called
      expect(getCallState).toHaveBeenCalledWith('call_123');
      expect(saveCallState).toHaveBeenCalledWith('call_123', newState);
      expect(processCallTurn).toHaveBeenCalled();
    });

    it('should send endCall tool_call when status is completed', async () => {
      const { getCallState, saveCallState } = await import('@/lib/voip/state-manager');
      const { processCallTurn } = await import('@/lib/voip/call-graph');
      const { getLastAIMessage } = await import('@/lib/voip/helpers');

      const mockState = {
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
        turnNumber: 5,
        status: 'in_progress' as const,
      };

      const completedState = {
        ...mockState,
        status: 'completed' as const,
        turnNumber: 6,
      };

      (getCallState as any).mockResolvedValue(mockState);
      (processCallTurn as any).mockResolvedValue(completedState);
      (getLastAIMessage as any).mockReturnValue('Perfect! We\'ll send a formal quote request. Thank you!');
      (saveCallState as any).mockResolvedValue(undefined);

      const request = buildPostRequest(buildVapiRequestBody('That sounds good', 'call_123'));
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.choices[0].message.content).toBe('Perfect! We\'ll send a formal quote request. Thank you!');
      expect(data.choices[0].message.tool_calls).toBeDefined();
      expect(data.choices[0].message.tool_calls[0].function.name).toBe('endCall');
      expect(data.choices[0].finish_reason).toBe('tool_calls');
    });

    it('should send endCall tool_call when escalation is needed', async () => {
      const { getCallState } = await import('@/lib/voip/state-manager');
      const { processCallTurn } = await import('@/lib/voip/call-graph');
      const { getLastAIMessage } = await import('@/lib/voip/helpers');

      const mockState = {
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
        negotiatedParts: [],
        clarificationAttempts: 3,
        turnNumber: 4,
        status: 'in_progress' as const,
      };

      const escalatedState = {
        ...mockState,
        status: 'escalated' as const,
        turnNumber: 5,
      };

      (getCallState as any).mockResolvedValue(mockState);
      (processCallTurn as any).mockResolvedValue(escalatedState);
      (getLastAIMessage as any).mockReturnValue('Let me connect you with one of our team members.');

      const request = buildPostRequest(buildVapiRequestBody('I need to speak to someone', 'call_123'));
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.choices[0].message.tool_calls).toBeDefined();
      expect(data.choices[0].message.tool_calls[0].function.name).toBe('endCall');
      expect(data.choices[0].finish_reason).toBe('tool_calls');
    });

    it('should reject unauthorized requests in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const request = new NextRequest(
        'http://localhost:3000/api/voip/langgraph-handler/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer wrong-secret',
          },
          body: JSON.stringify(buildVapiRequestBody('Test', 'call_123')),
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(401);

      process.env.NODE_ENV = originalEnv;
    });

    it('should return graceful spoken error when call state not found', async () => {
      const { getCallState } = await import('@/lib/voip/state-manager');

      (getCallState as any).mockResolvedValue(null);

      const request = buildPostRequest(buildVapiRequestBody('Test', 'nonexistent_call'));
      const response = await POST(request);
      const data = await response.json();

      // Handler returns 200 with a spoken error to keep Vapi happy
      expect(response.status).toBe(200);
      expect(data.choices[0].message.role).toBe('assistant');
      expect(data.choices[0].message.content).toContain('technical issue');
    });

    it('should handle errors gracefully with spoken fallback', async () => {
      const { getCallState } = await import('@/lib/voip/state-manager');

      (getCallState as any).mockRejectedValue(new Error('Redis connection failed'));

      const request = buildPostRequest(buildVapiRequestBody('Test', 'call_123'));
      const response = await POST(request);
      const data = await response.json();

      // Returns 200 with graceful spoken error message
      expect(response.status).toBe(200);
      expect(data.choices[0].message.role).toBe('assistant');
      expect(data.choices[0].message.content).toContain('technical');
    });
  });

  describe('GET /api/voip/langgraph-handler/chat/completions', () => {
    it('should return health check', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/voip/langgraph-handler/chat/completions',
        { method: 'GET' },
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.endpoint).toBe('/api/voip/langgraph-handler/chat/completions');
      expect(data.timestamp).toBeDefined();
    });
  });
});
