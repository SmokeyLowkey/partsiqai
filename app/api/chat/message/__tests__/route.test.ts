import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatConversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    chatPickList: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    chatPickListItem: {
      create: vi.fn(),
    },
    vehicle: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/services/search/multi-agent-orchestrator', () => ({
  MultiAgentOrchestrator: vi.fn().mockImplementation(() => ({
    searchWithFormatting: vi.fn().mockResolvedValue({
      messageText: 'Found 3 parts matching your query',
      parts: [
        {
          partNumber: 'ABC-123',
          description: 'Test part',
          confidence: 95,
          confidenceLabel: 'High',
          price: 29.99,
        },
      ],
      summary: { totalFound: 1, avgConfidence: 95, inStockCount: 1, categoryBreakdown: {} },
      recommendations: [],
      filters: [],
      relatedSearches: [],
      metadata: { totalResults: 1, searchTime: 500, sourcesUsed: ['pinecone'], hasMoreResults: false },
    }),
  })),
}));

/** Helper: build a POST request */
function buildPostRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Helper: build a GET request */
function buildGetRequest(conversationId: string) {
  return new NextRequest(
    `http://localhost:3000/api/chat/message?conversationId=${conversationId}`,
    { method: 'GET' }
  );
}

describe('Chat Message API - messageCount tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSession = {
    user: {
      id: 'user_1',
      role: 'TECHNICIAN',
      organizationId: 'org_1',
    },
  };

  const mockConversation = {
    id: 'conv_1',
    userId: 'user_1',
    organizationId: 'org_1',
    title: 'Test conversation',
    messageCount: 0,
    isActive: true,
  };

  describe('POST /api/chat/message', () => {
    it('should increment messageCount for user message on new conversation', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(mockSession);

      // No existing conversation — will create new one
      (prisma.chatConversation.create as any).mockResolvedValue({
        ...mockConversation,
        id: 'conv_new',
      });

      // User message creation
      (prisma.chatMessage.create as any)
        .mockResolvedValueOnce({
          id: 'msg_user_1',
          conversationId: 'conv_new',
          role: 'USER',
          content: 'Find me a fuel filter',
          createdAt: new Date().toISOString(),
        })
        // Assistant message creation
        .mockResolvedValueOnce({
          id: 'msg_asst_1',
          conversationId: 'conv_new',
          role: 'ASSISTANT',
          content: 'Found 3 parts matching your query',
          messageType: 'PART_RECOMMENDATION',
          metadata: {},
          createdAt: new Date().toISOString(),
        });

      (prisma.chatConversation.update as any).mockResolvedValue({ messageCount: 1 });
      (prisma.chatPickList.findFirst as any).mockResolvedValue(null);
      (prisma.chatPickList.create as any).mockResolvedValue({ id: 'pl_1' });
      (prisma.chatPickListItem.create as any).mockResolvedValue({});

      const request = buildPostRequest({
        message: 'Find me a fuel filter',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should have been called for both user message and assistant message increments
      const updateCalls = (prisma.chatConversation.update as any).mock.calls;
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);

      // First call: increment for user message
      expect(updateCalls[0][0]).toEqual(
        expect.objectContaining({
          where: { id: 'conv_new' },
          data: expect.objectContaining({
            messageCount: { increment: 1 },
          }),
        })
      );

      // Second call: increment for assistant message
      expect(updateCalls[1][0]).toEqual(
        expect.objectContaining({
          where: { id: 'conv_new' },
          data: expect.objectContaining({
            messageCount: { increment: 1 },
          }),
        })
      );
    });

    it('should increment messageCount for existing conversation', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(mockSession);

      // Existing conversation found
      (prisma.chatConversation.findFirst as any).mockResolvedValue(mockConversation);

      (prisma.chatMessage.create as any)
        .mockResolvedValueOnce({
          id: 'msg_user_2',
          conversationId: 'conv_1',
          role: 'USER',
          content: 'oil filter',
          createdAt: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'msg_asst_2',
          conversationId: 'conv_1',
          role: 'ASSISTANT',
          content: 'Found parts',
          messageType: 'PART_RECOMMENDATION',
          metadata: {},
          createdAt: new Date().toISOString(),
        });

      (prisma.chatConversation.update as any).mockResolvedValue({ messageCount: 3 });
      (prisma.chatPickList.findFirst as any).mockResolvedValue(null);
      (prisma.chatPickList.create as any).mockResolvedValue({ id: 'pl_2' });
      (prisma.chatPickListItem.create as any).mockResolvedValue({});

      const request = buildPostRequest({
        conversationId: 'conv_1',
        message: 'oil filter',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify increment calls
      const updateCalls = (prisma.chatConversation.update as any).mock.calls;
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);

      // Both should target the existing conversation
      updateCalls.forEach((call: any) => {
        expect(call[0].where.id).toBe('conv_1');
        expect(call[0].data.messageCount).toEqual({ increment: 1 });
        expect(call[0].data.lastMessageAt).toBeInstanceOf(Date);
      });
    });

    it('should increment messageCount even on search error', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');

      // Re-mock the orchestrator to throw
      const { MultiAgentOrchestrator } = await import(
        '@/lib/services/search/multi-agent-orchestrator'
      );
      (MultiAgentOrchestrator as any).mockImplementationOnce(() => ({
        searchWithFormatting: vi.fn().mockRejectedValue(new Error('Search failed')),
      }));

      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(mockSession);
      (prisma.chatConversation.findFirst as any).mockResolvedValue(mockConversation);

      (prisma.chatMessage.create as any)
        .mockResolvedValueOnce({
          id: 'msg_user_err',
          conversationId: 'conv_1',
          role: 'USER',
          content: 'broken query',
          createdAt: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'msg_asst_err',
          conversationId: 'conv_1',
          role: 'ASSISTANT',
          content: 'I encountered an error',
          messageType: 'TEXT',
          createdAt: new Date().toISOString(),
        });

      (prisma.chatConversation.update as any).mockResolvedValue({ messageCount: 2 });

      const request = buildPostRequest({
        conversationId: 'conv_1',
        message: 'broken query',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should still have incremented for user message + error assistant message
      const updateCalls = (prisma.chatConversation.update as any).mock.calls;
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);

      updateCalls.forEach((call: any) => {
        expect(call[0].data.messageCount).toEqual({ increment: 1 });
      });
    });

    it('should return 401 for unauthenticated requests', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(null);

      const request = buildPostRequest({ message: 'test' });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 for empty message', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(mockSession);

      const request = buildPostRequest({ message: '' });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
