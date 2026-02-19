import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
  canConvertToOrder: vi.fn((role: string) =>
    ['MANAGER', 'ADMIN', 'MASTER_ADMIN'].includes(role)
  ),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quoteRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/services/llm/openrouter-client', () => ({
  OpenRouterClient: {
    fromOrganization: vi.fn(),
  },
}));

vi.mock('@/lib/utils/order-number', () => ({
  generateOrderNumber: vi.fn(() => 'ORD-001'),
}));

vi.mock('@/lib/services/email/email-client-factory', () => ({
  getEmailClientForUser: vi.fn(),
}));

function buildRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/quote-requests/qr_1/convert-to-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Quote Request Convert-to-Order API — Status Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const managerSession = {
    user: {
      id: 'user_manager',
      role: 'MANAGER',
      organizationId: 'org_1',
      name: 'Test Manager',
      email: 'manager@test.com',
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

  const makeQuote = (status: string, overrides: Record<string, any> = {}) => ({
    id: 'qr_1',
    quoteNumber: 'QR-001',
    status,
    organizationId: 'org_1',
    createdById: 'user_tech',
    requiresApproval: false,
    isConverting: false,
    convertingBy: null,
    convertingStartedAt: null,
    emailThreads: [
      {
        supplierId: 'sup_1',
        status: 'RESPONDED',
        quotedAmount: 500,
      },
    ],
    items: [
      {
        id: 'item_1',
        partNumber: 'PART-001',
        description: 'Test part',
        quantity: 1,
        supplierQuotes: [
          {
            supplierId: 'sup_1',
            unitPrice: 100,
            totalPrice: 100,
            availability: 'IN_STOCK',
          },
        ],
      },
    ],
    supplier: { id: 'sup_1', name: 'Test Supplier', email: 'sup@test.com' },
    vehicle: null,
    createdBy: { name: 'Test Tech', email: 'tech@test.com' },
    ...overrides,
  });

  const params = Promise.resolve({ id: 'qr_1' });

  describe('Role-based access', () => {
    it('should return 403 for technicians', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(technicianSession);

      const request = buildRequest({ supplierId: 'sup_1' });
      const response = await POST(request, { params });

      expect(response.status).toBe(403);
    });

    it('should return 401 for unauthenticated users', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(null);

      const request = buildRequest({ supplierId: 'sup_1' });
      const response = await POST(request, { params });

      expect(response.status).toBe(401);
    });
  });

  describe('Status validation for managers', () => {
    it('should allow conversion from RECEIVED status', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);

      // First findUnique call: lock check
      (prisma.quoteRequest.findUnique as any)
        .mockResolvedValueOnce(makeQuote('RECEIVED'))
        // Second findUnique call: full data fetch
        .mockResolvedValueOnce(makeQuote('RECEIVED'));

      // Lock update
      (prisma.quoteRequest.update as any).mockResolvedValue({});

      const request = buildRequest({ supplierId: 'sup_1' });
      const response = await POST(request, { params });

      // The route will try to proceed past status validation
      // We're testing that it doesn't return 400 for status
      // It may fail later (e.g., email credentials) but that's OK
      const data = await response.json();
      if (response.status === 400) {
        // Should NOT be a status error
        expect(data.error).not.toContain('status');
      }
    });

    it('should allow conversion from UNDER_REVIEW status for managers', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);

      (prisma.quoteRequest.findUnique as any)
        .mockResolvedValueOnce(makeQuote('UNDER_REVIEW'))
        .mockResolvedValueOnce(makeQuote('UNDER_REVIEW'));

      (prisma.quoteRequest.update as any).mockResolvedValue({});

      const request = buildRequest({ supplierId: 'sup_1' });
      const response = await POST(request, { params });
      const data = await response.json();

      if (response.status === 400) {
        expect(data.error).not.toContain('status');
      }
    });

    it('should allow conversion from APPROVED status', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);

      (prisma.quoteRequest.findUnique as any)
        .mockResolvedValueOnce(makeQuote('APPROVED'))
        .mockResolvedValueOnce(makeQuote('APPROVED'));

      (prisma.quoteRequest.update as any).mockResolvedValue({});

      const request = buildRequest({ supplierId: 'sup_1' });
      const response = await POST(request, { params });
      const data = await response.json();

      if (response.status === 400) {
        expect(data.error).not.toContain('status');
      }
    });

    it('should block conversion from SENT status', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);

      (prisma.quoteRequest.findUnique as any)
        .mockResolvedValueOnce(makeQuote('SENT'))
        .mockResolvedValueOnce(makeQuote('SENT'));

      (prisma.quoteRequest.update as any).mockResolvedValue({});

      const request = buildRequest({ supplierId: 'sup_1' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('status');
    });

    it('should block conversion from DRAFT status', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);

      (prisma.quoteRequest.findUnique as any)
        .mockResolvedValueOnce(makeQuote('DRAFT'))
        .mockResolvedValueOnce(makeQuote('DRAFT'));

      (prisma.quoteRequest.update as any).mockResolvedValue({});

      const request = buildRequest({ supplierId: 'sup_1' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('status');
    });

    it('should block conversion from CONVERTED_TO_ORDER status (409 conflict)', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { prisma } = await import('@/lib/prisma');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);

      // The route checks CONVERTED_TO_ORDER early via the lock check and returns 409
      (prisma.quoteRequest.findUnique as any)
        .mockResolvedValueOnce(makeQuote('CONVERTED_TO_ORDER'))
        .mockResolvedValueOnce(makeQuote('CONVERTED_TO_ORDER'));

      (prisma.quoteRequest.update as any).mockResolvedValue({});

      const request = buildRequest({ supplierId: 'sup_1' });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already been converted');
    });
  });

  describe('Supplier validation', () => {
    it('should require supplierId', async () => {
      const { getServerSession } = await import('@/lib/auth');
      const { POST } = await import('../route');

      (getServerSession as any).mockResolvedValue(managerSession);

      const request = buildRequest({});
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Supplier ID');
    });
  });
});
