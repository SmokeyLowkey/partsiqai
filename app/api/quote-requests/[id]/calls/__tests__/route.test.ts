import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock Prisma to prevent database operations
vi.mock('@/lib/prisma', () => ({
  prisma: {
    quoteRequest: {
      findUnique: vi.fn(),
    },
    supplierCall: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

describe('Quote Request Calls API', () => {
  const testOrgId = 'test-org-calls-api';
  const testUserId = 'test-user-calls-api';
  const testQuoteRequestId = 'test-qr-calls-api';
  const testSupplierId = 'test-supplier-calls-api';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/quote-requests/[id]/calls', () => {
    it('should transform LangGraph conversationHistory to conversationLog format', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');

      (getServerSession as any).mockResolvedValue({
        user: {
          id: testUserId,
          organizationId: testOrgId,
        },
      });

      // Mock quote request lookup
      (prisma.quoteRequest.findUnique as any).mockResolvedValue({
        id: testQuoteRequestId,
        organizationId: testOrgId,
      });

      // Mock call with LangGraph format
      const mockCall = {
        id: 'call_123',
        quoteRequestId: testQuoteRequestId,
        supplierId: testSupplierId,
        callDirection: 'OUTBOUND',
        callType: 'QUOTE_REQUEST',
        callerId: testUserId,
        phoneNumber: '+15551234567',
        status: 'COMPLETED',
        organizationId: testOrgId,
        duration: 145,
        conversationLog: {
          conversationHistory: [
            {
              speaker: 'ai',
              text: 'Hi, can you help with a quote?',
              timestamp: new Date().toISOString(),
            },
            {
              speaker: 'supplier',
              text: 'Yes, what do you need?',
              timestamp: new Date().toISOString(),
            },
            {
              speaker: 'ai',
              text: 'Part ABC123, quantity 2',
              timestamp: new Date().toISOString(),
            },
          ],
          currentNode: 'confirmation',
          status: 'completed',
          needsHumanEscalation: false,
          negotiationAttempts: 1,
        },
        extractedQuotes: [
          {
            partNumber: 'ABC123',
            price: 450,
            availability: 'in_stock',
            leadTimeDays: 3,
          },
        ],
        supplier: { name: 'Test Supplier' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.supplierCall.findMany as any).mockResolvedValue([mockCall]);
      (prisma.supplierCall.count as any).mockResolvedValue(1);

      const request = new NextRequest(
        `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/calls`,
        { method: 'GET' }
      );

      const response = await GET(request, { params: Promise.resolve({ id: testQuoteRequestId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.calls).toHaveLength(1);
      expect(data.count).toBe(1);

      const transformedCall = data.calls[0];

      // Check conversationLog transformation
      expect(transformedCall.conversationLog).toBeInstanceOf(Array);
      expect(transformedCall.conversationLog).toHaveLength(3);
      expect(transformedCall.conversationLog[0].role).toBe('assistant');
      expect(transformedCall.conversationLog[0].content).toBe('Hi, can you help with a quote?');
      expect(transformedCall.conversationLog[1].role).toBe('user');
      expect(transformedCall.conversationLog[1].content).toBe('Yes, what do you need?');

      // Check langGraphState extraction
      expect(transformedCall.langGraphState).toBeDefined();
      expect(transformedCall.langGraphState.currentNode).toBe('confirmation');
      expect(transformedCall.langGraphState.status).toBe('completed');
      expect(transformedCall.langGraphState.needsHumanEscalation).toBe(false);
      expect(transformedCall.langGraphState.negotiationAttempts).toBe(1);

      // Check extractedQuotes
      expect(transformedCall.extractedQuotes).toHaveLength(1);
      expect(transformedCall.extractedQuotes[0].partNumber).toBe('ABC123');
      expect(transformedCall.extractedQuotes[0].price).toBe(450);
    });

    it('should handle calls without LangGraph state', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');

      (getServerSession as any).mockResolvedValue({
        user: {
          id: testUserId,
          organizationId: testOrgId,
        },
      });

      // Mock quote request lookup
      (prisma.quoteRequest.findUnique as any).mockResolvedValue({
        id: testQuoteRequestId,
        organizationId: testOrgId,
      });

      // Mock call without LangGraph format (old format)
      const mockCall = {
        id: 'call_456',
        quoteRequestId: testQuoteRequestId,
        supplierId: testSupplierId,
        callDirection: 'OUTBOUND',
        callType: 'QUOTE_REQUEST',
        callerId: testUserId,
        phoneNumber: '+15551234567',
        status: 'COMPLETED',
        organizationId: testOrgId,
        duration: 85,
        conversationLog: [
          {
            role: 'assistant',
            content: 'Hello',
            timestamp: new Date().toISOString(),
          },
        ],
        supplier: { name: 'Test Supplier' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.supplierCall.findMany as any).mockResolvedValue([mockCall]);
      (prisma.supplierCall.count as any).mockResolvedValue(1);

      const request = new NextRequest(
        `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/calls`,
        { method: 'GET' }
      );

      const response = await GET(request, { params: Promise.resolve({ id: testQuoteRequestId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      const transformedCall = data.calls[0];

      // Should preserve existing format
      expect(transformedCall.conversationLog).toHaveLength(1);
      expect(transformedCall.conversationLog[0].role).toBe('assistant');

      // No langGraphState for old format
      expect(transformedCall.langGraphState).toBeNull();
    });

    it('should handle calls with escalation flags', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');

      (getServerSession as any).mockResolvedValue({
        user: {
          id: testUserId,
          organizationId: testOrgId,
        },
      });

      // Mock quote request lookup
      (prisma.quoteRequest.findUnique as any).mockResolvedValue({
        id: testQuoteRequestId,
        organizationId: testOrgId,
      });

      const mockCall = {
        id: 'call_789',
        quoteRequestId: testQuoteRequestId,
        supplierId: testSupplierId,
        callDirection: 'OUTBOUND',
        callType: 'QUOTE_REQUEST',
        callerId: testUserId,
        phoneNumber: '+15551234567',
        status: 'COMPLETED',
        organizationId: testOrgId,
        notes: 'Complex pricing structure - manager review needed',
        nextAction: 'human_followup',
        conversationLog: {
          conversationHistory: [],
          currentNode: 'human_escalation',
          needsHumanEscalation: true,
          clarificationAttempts: 3,
        },
        supplier: { name: 'Test Supplier' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.supplierCall.findMany as any).mockResolvedValue([mockCall]);
      (prisma.supplierCall.count as any).mockResolvedValue(1);

      const request = new NextRequest(
        `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/calls`,
        { method: 'GET' }
      );

      const response = await GET(request, { params: Promise.resolve({ id: testQuoteRequestId }) });
      const data = await response.json();

      const transformedCall = data.calls[0];

      expect(transformedCall.notes).toBe('Complex pricing structure - manager review needed');
      expect(transformedCall.nextAction).toBe('human_followup');
      expect(transformedCall.langGraphState.needsHumanEscalation).toBe(true);
      expect(transformedCall.langGraphState.currentNode).toBe('human_escalation');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const { getServerSession } = await import('@/lib/auth');

      (getServerSession as any).mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/calls`,
        { method: 'GET' }
      );

      const response = await GET(request, { params: Promise.resolve({ id: testQuoteRequestId }) });

      expect(response.status).toBe(401);
    });

    it('should return 403 for unauthorized organization access', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');

      (getServerSession as any).mockResolvedValue({
        user: {
          id: testUserId,
          organizationId: 'different-org-id',
        },
      });

      // Mock quote request with different org
      (prisma.quoteRequest.findUnique as any).mockResolvedValue({
        id: testQuoteRequestId,
        organizationId: testOrgId,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/quote-requests/${testQuoteRequestId}/calls`,
        { method: 'GET' }
      );

      const response = await GET(request, { params: Promise.resolve({ id: testQuoteRequestId }) });

      expect(response.status).toBe(403);
    });
  });
});
