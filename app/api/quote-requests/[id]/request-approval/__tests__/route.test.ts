import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
  requiresApproval: vi.fn((role: string) => role === 'TECHNICIAN'),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quoteRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

function buildRequest(body: any) {
  return new Request('http://localhost:3000/api/quote-requests/qr_1/request-approval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Quote Request - Request Approval API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const technicianSession = {
    user: {
      id: 'user_tech',
      role: 'TECHNICIAN',
      organizationId: 'org_1',
      name: 'Test Tech',
      email: 'tech@test.com',
    },
  };

  const managerSession = {
    user: {
      id: 'user_manager',
      role: 'MANAGER',
      organizationId: 'org_1',
      name: 'Test Manager',
    },
  };

  const makeQuote = (status: string, createdById = 'user_tech') => ({
    id: 'qr_1',
    quoteNumber: 'QR-001',
    status,
    organizationId: 'org_1',
    createdById,
    createdBy: { name: 'Test Tech', email: 'tech@test.com' },
  });

  const params = Promise.resolve({ id: 'qr_1' });

  describe('Status validation — technicians can request approval from DRAFT, SENT, or RECEIVED', () => {
    const allowedStatuses = ['DRAFT', 'SENT', 'RECEIVED'];
    const blockedStatuses = ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CONVERTED_TO_ORDER', 'EXPIRED'];

    allowedStatuses.forEach((status) => {
      it(`should allow request approval from ${status}`, async () => {
        const { getServerSession } = await import('@/lib/auth');
        const { prisma } = await import('@/lib/prisma');
        const { POST } = await import('../route');

        (getServerSession as any).mockResolvedValue(technicianSession);
        (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote(status));
        (prisma.quoteRequest.update as any).mockResolvedValue({
          ...makeQuote('UNDER_REVIEW'),
          requiresApproval: true,
          items: [],
          vehicle: null,
        });
        (prisma.activityLog.create as any).mockResolvedValue({});

        const request = buildRequest({ notes: 'Please approve this' });
        const response = await POST(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toBe('Approval requested successfully');
      });
    });

    blockedStatuses.forEach((status) => {
      it(`should block request approval from ${status}`, async () => {
        const { getServerSession } = await import('@/lib/auth');
        const { prisma } = await import('@/lib/prisma');
        const { POST } = await import('../route');

        (getServerSession as any).mockResolvedValue(technicianSession);
        (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote(status));

        const request = buildRequest({ notes: 'Please approve' });
        const response = await POST(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Cannot request approval');
      });
    });
  });

  describe('Role-based access', () => {
    it('should reject request from managers (they do not need approval)', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('RECEIVED', 'user_manager'));

      const request = buildRequest({ notes: 'I want approval' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('does not require approval');
    });

    it('should prevent technician from requesting approval for another users quote', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(technicianSession);
      // Quote created by someone else
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(
        makeQuote('RECEIVED', 'user_other_tech')
      );

      const request = buildRequest({ notes: 'Approve please' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('your own quote requests');
    });
  });

  describe('Notes handling', () => {
    it('should sanitize empty notes to null', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(technicianSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('RECEIVED'));
      (prisma.quoteRequest.update as any).mockResolvedValue({
        ...makeQuote('UNDER_REVIEW'),
        requiresApproval: true,
        approvalNotes: null,
        items: [],
        vehicle: null,
      });
      (prisma.activityLog.create as any).mockResolvedValue({});

      const request = buildRequest({ notes: '   ' });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);

      // Verify update was called with null notes
      const updateCall = (prisma.quoteRequest.update as any).mock.calls[0][0];
      expect(updateCall.data.approvalNotes).toBeNull();
    });
  });
});
