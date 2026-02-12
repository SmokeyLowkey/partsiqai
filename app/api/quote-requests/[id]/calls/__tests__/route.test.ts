import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '@/lib/prisma';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

describe('Quote Request Calls API', () => {
  const testOrgId = 'test-org-calls-api';
  const testUserId = 'test-user-calls-api';
  const testQuoteRequestId = 'test-qr-calls-api';
  const testSupplierId = 'test-supplier-calls-api';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup test data
    await prisma.organization.upsert({
      where: { id: testOrgId },
      create: {
        id: testOrgId,
        slug: 'test-org-calls-api',
        name: 'Test Org',
        subscriptionTier: 'GROWTH',
        subscriptionStatus: 'ACTIVE',
      },
      update: {},
    });

    await prisma.user.upsert({
      where: { id: testUserId },
      create: {
        id: testUserId,
        email: 'test-calls-api@example.com',
        name: 'Test User',
        role: 'ADMIN',
        organizationId: testOrgId,
      },
      update: { organizationId: testOrgId },
    });

    await prisma.supplier.upsert({
      where: { id: testSupplierId },
      create: {
        id: testSupplierId,
        supplierId: 'TESTSUP001',
        name: 'Test Supplier',
        type: 'LOCAL_DEALER',
        phone: '+15551234567',
        email: 'supplier@example.com',
        organizationId: testOrgId,
      },
      update: {},
    });

    await prisma.quoteRequest.upsert({
      where: { id: testQuoteRequestId },
      create: {
        id: testQuoteRequestId,
        quoteNumber: 'QR-TEST-001',
        title: 'Test Quote Request',
        status: 'DRAFT',
        organizationId: testOrgId,
        createdById: testUserId,
        vehicleId: null,
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.supplierCall.deleteMany({ where: { quoteRequestId: testQuoteRequestId } });
    await prisma.quoteRequest.deleteMany({ where: { id: testQuoteRequestId } });
    await prisma.supplier.deleteMany({ where: { id: testSupplierId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.organization.deleteMany({ where: { id: testOrgId } });
  });

  describe('GET /api/quote-requests/[id]/calls', () => {
    it('should transform LangGraph conversationHistory to conversationLog format', async () => {
      const { getServerSession } = await import('@/lib/auth');

      (getServerSession as any).mockResolvedValue({
        user: {
          id: testUserId,
          organizationId: testOrgId,
        },
      });

      // Create call with LangGraph format
      const call = await prisma.supplierCall.create({
        data: {
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
        },
      });

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

      // Cleanup
      await prisma.supplierCall.delete({ where: { id: call.id } });
    });

    it('should handle calls without LangGraph state', async () => {
      const { getServerSession } = await import('@/lib/auth');

      (getServerSession as any).mockResolvedValue({
        user: {
          id: testUserId,
          organizationId: testOrgId,
        },
      });

      // Create call without LangGraph format (old format)
      const call = await prisma.supplierCall.create({
        data: {
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
        },
      });

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

      // Cleanup
      await prisma.supplierCall.delete({ where: { id: call.id } });
    });

    it('should handle calls with escalation flags', async () => {
      const { getServerSession } = await import('@/lib/auth');

      (getServerSession as any).mockResolvedValue({
        user: {
          id: testUserId,
          organizationId: testOrgId,
        },
      });

      const call = await prisma.supplierCall.create({
        data: {
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
        },
      });

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

      // Cleanup
      await prisma.supplierCall.delete({ where: { id: call.id } });
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

      (getServerSession as any).mockResolvedValue({
        user: {
          id: testUserId,
          organizationId: 'different-org-id',
        },
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
