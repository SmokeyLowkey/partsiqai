import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
  canApproveQuotes: vi.fn((role: string) =>
    ['MANAGER', 'ADMIN', 'MASTER_ADMIN'].includes(role)
  ),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quoteRequest: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

function buildRequest(body: any) {
  return new Request('http://localhost:3000/api/quote-requests/qr_1/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Quote Request Approve API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const managerSession = {
    user: {
      id: 'user_manager',
      role: 'MANAGER',
      organizationId: 'org_1',
      name: 'Test Manager',
    },
  };

  const technicianSession = {
    user: {
      id: 'user_tech',
      role: 'TECHNICIAN',
      organizationId: 'org_1',
      name: 'Test Tech',
    },
  };

  const makeQuote = (status: string, createdById = 'user_tech') => ({
    id: 'qr_1',
    quoteNumber: 'QR-001',
    status,
    organizationId: 'org_1',
    createdById,
    managerTakeoverAt: null,
    managerTakeoverId: null,
    createdBy: { name: 'Test Tech', email: 'tech@test.com' },
  });

  const params = Promise.resolve({ id: 'qr_1' });

  describe('Status validation — managers can approve from most states', () => {
    const approvableStatuses = ['DRAFT', 'RECEIVED', 'UNDER_REVIEW', 'EXPIRED'];
    const nonApprovableStatuses = ['SENT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_ORDER'];

    approvableStatuses.forEach((status) => {
      it(`should allow approval from ${status} status`, async () => {
        const { getServerSession } = await import('@/lib/auth');
        const { prisma } = await import('@/lib/prisma');
        const { POST } = await import('../route');

        (getServerSession as any).mockResolvedValue(managerSession);
        (prisma.quoteRequest.findUnique as any).mockResolvedValue(makeQuote(status));

        const mockUpdated = { ...makeQuote('APPROVED'), approvedById: 'user_manager' };
        (prisma.$transaction as any).mockResolvedValue(mockUpdated);

        const request = buildRequest({ notes: 'Approved' });
        const response = await POST(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toBe('Quote approved successfully');
      });
    });

    nonApprovableStatuses.forEach((status) => {
      it(`should reject approval from ${status} status`, async () => {
        const { getServerSession } = await import('@/lib/auth');
        const { prisma } = await import('@/lib/prisma');
        const { POST } = await import('../route');

        (getServerSession as any).mockResolvedValue(managerSession);
        (prisma.quoteRequest.findUnique as any).mockResolvedValue(makeQuote(status));

        const request = buildRequest({ notes: 'Approved' });
        const response = await POST(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Cannot approve quote');
      });
    });
  });

  describe('Role-based access', () => {
    it('should return 403 for technicians', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(technicianSession);

      const request = buildRequest({ notes: 'Approved' });
      const response = await POST(request, { params });

      expect(response.status).toBe(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(null);

      const request = buildRequest({ notes: 'Approved' });
      const response = await POST(request, { params });

      expect(response.status).toBe(401);
    });

    it('should prevent self-approval', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);
      // Quote was created by the same manager trying to approve
      (prisma.quoteRequest.findUnique as any).mockResolvedValue(
        makeQuote('RECEIVED', 'user_manager')
      );

      const request = buildRequest({ notes: 'Self-approval' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('cannot approve your own');
    });
  });

  describe('Cross-organization access', () => {
    it('should return 404 for quotes from another organization', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);
      (prisma.quoteRequest.findUnique as any).mockResolvedValue({
        ...makeQuote('RECEIVED'),
        organizationId: 'org_other',
      });

      const request = buildRequest({ notes: 'Approved' });
      const response = await POST(request, { params });

      expect(response.status).toBe(404);
    });
  });
});
