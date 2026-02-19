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
  return new Request('http://localhost:3000/api/quote-requests/qr_1/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Quote Request Reject API', () => {
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

  const makeQuote = (status: string) => ({
    id: 'qr_1',
    quoteNumber: 'QR-001',
    status,
    organizationId: 'org_1',
    createdById: 'user_tech',
    createdBy: { name: 'Test Tech', email: 'tech@test.com' },
  });

  const params = Promise.resolve({ id: 'qr_1' });

  describe('Status validation — managers can reject from most states', () => {
    const rejectableStatuses = ['DRAFT', 'RECEIVED', 'UNDER_REVIEW', 'EXPIRED'];
    const nonRejectableStatuses = ['SENT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_ORDER'];

    rejectableStatuses.forEach((status) => {
      it(`should allow rejection from ${status} status`, async () => {
        const { getServerSession } = await import('@/lib/auth');
        const { prisma } = await import('@/lib/prisma');
        const { POST } = await import('../route');

        (getServerSession as any).mockResolvedValue(managerSession);
        (prisma.quoteRequest.findUnique as any).mockResolvedValue(makeQuote(status));

        const mockUpdated = { ...makeQuote('REJECTED'), approvedById: 'user_manager' };
        (prisma.$transaction as any).mockResolvedValue(mockUpdated);

        const request = buildRequest({ notes: 'Price too high' });
        const response = await POST(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toBe('Quote rejected');
      });
    });

    nonRejectableStatuses.forEach((status) => {
      it(`should block rejection from ${status} status`, async () => {
        const { getServerSession } = await import('@/lib/auth');
        const { prisma } = await import('@/lib/prisma');
        const { POST } = await import('../route');

        (getServerSession as any).mockResolvedValue(managerSession);
        (prisma.quoteRequest.findUnique as any).mockResolvedValue(makeQuote(status));

        const request = buildRequest({ notes: 'Rejected' });
        const response = await POST(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Cannot reject quote');
      });
    });
  });

  describe('Role-based access', () => {
    it('should return 403 for technicians', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(technicianSession);

      const request = buildRequest({ notes: 'Rejected' });
      const response = await POST(request, { params });

      expect(response.status).toBe(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(null);

      const request = buildRequest({ notes: 'Rejected' });
      const response = await POST(request, { params });

      expect(response.status).toBe(401);
    });
  });

  describe('Validation', () => {
    it('should require rejection notes', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);

      const request = buildRequest({});
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('notes are required');
    });
  });
});
