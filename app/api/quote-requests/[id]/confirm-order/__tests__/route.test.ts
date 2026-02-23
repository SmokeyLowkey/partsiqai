import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---- Mocks ----

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
    emailThread: { update: vi.fn() },
    emailMessage: { create: vi.fn() },
    quoteRequestEmailThread: { updateMany: vi.fn(), update: vi.fn() },
    supplierQuoteItem: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { mockGetEmailClient, mockCheckIdempotency, mockCacheResponse, mockGetIdempotencyKey } = vi.hoisted(() => ({
  mockGetEmailClient: vi.fn(),
  mockCheckIdempotency: vi.fn().mockResolvedValue(null),
  mockCacheResponse: vi.fn().mockResolvedValue(undefined),
  mockGetIdempotencyKey: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/services/email/email-client-factory', () => ({
  getEmailClientForUser: mockGetEmailClient,
}));

vi.mock('@/lib/utils/order-number', () => ({
  generateOrderNumber: vi.fn().mockResolvedValue('ORD-001'),
}));

vi.mock('@/lib/middleware/idempotency', () => ({
  checkIdempotency: mockCheckIdempotency,
  cacheResponse: mockCacheResponse,
  getIdempotencyKey: mockGetIdempotencyKey,
}));

vi.mock('@/lib/sanitize', () => ({
  escapeHtml: vi.fn((s: string) => s),
}));

// ---- Imports ----

import { POST } from '../../confirm-order/route';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ---- Helpers ----

const params = Promise.resolve({ id: 'qr_1' });

function buildRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/quote-requests/qr_1/confirm-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const managerSession = {
  user: { id: 'user_mgr', role: 'MANAGER', organizationId: 'org_1', name: 'Manager', email: 'mgr@test.com' },
};

const techSession = {
  user: { id: 'user_tech', role: 'TECHNICIAN', organizationId: 'org_1', name: 'Tech', email: 'tech@test.com' },
};

const validBody = {
  supplierId: 'sup_1',
  emailSubject: 'Order Confirmation',
  emailBody: 'We confirm this order.',
  fulfillmentMethod: 'DELIVERY',
};

const makeLockCheck = (extra: any = {}) => ({
  isConverting: true,
  convertingBy: 'user_mgr',
  convertingStartedAt: new Date(),
  status: 'APPROVED',
  ...extra,
});

const makeFullQuote = () => ({
  id: 'qr_1',
  quoteNumber: 'QR-001',
  status: 'APPROVED',
  organizationId: 'org_1',
  createdById: 'user_tech',
  requiresApproval: false,
  vehicleId: 'v_1',
  supplierId: 'sup_1',
  supplier: { id: 'sup_1', name: 'Supplier', email: 'supplier@test.com' },
  vehicle: { id: 'v_1' },
  organization: { name: 'Test Org', billingEmail: 'org@test.com' },
  createdBy: { name: 'Tech', email: 'tech@test.com' },
  managerTakeover: null,
  emailThreads: [{
    id: 'qret_1',
    supplierId: 'sup_1',
    emailThread: {
      id: 'et_1',
      externalThreadId: 'gmail_thread_1',
      messages: [{ externalMessageId: 'msg_1' }],
    },
  }],
  items: [{
    id: 'item_1',
    partNumber: 'AT-123',
    quantity: 1,
    isAlternative: false,
    isSuperseded: false,
    originalPartNumber: null,
    alternativeReason: null,
    partId: null,
    supplierQuotes: [{
      supplierId: 'sup_1',
      unitPrice: 29.99,
      totalPrice: 29.99,
      availability: 'IN_STOCK',
      notes: null,
      supplierPartNumber: 'AT-123',
      validUntil: null,
    }],
  }],
});

const mockEmailClient = {
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'msg_2', threadId: 'gmail_thread_1' }),
};

// ---- Tests ----

describe('Quote Request Confirm-Order API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEmailClient.mockResolvedValue(mockEmailClient);
    mockEmailClient.sendEmail.mockResolvedValue({ messageId: 'msg_2', threadId: 'gmail_thread_1' });
    mockCheckIdempotency.mockResolvedValue(null);
    mockGetIdempotencyKey.mockReturnValue(null);
  });

  describe('Authentication & authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(401);
    });

    it('should return 403 for TECHNICIAN role', async () => {
      (getServerSession as any).mockResolvedValue(techSession);
      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(403);
    });
  });

  describe('Validation', () => {
    it('should return 400 when supplierId missing', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);
      const res = await POST(buildRequest({ emailSubject: 'S', emailBody: 'B' }), { params });
      expect(res.status).toBe(400);
    });

    it('should return 400 when emailSubject missing', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);
      const res = await POST(buildRequest({ supplierId: 'sup_1', emailBody: 'B' }), { params });
      expect(res.status).toBe(400);
    });

    it('should return 400 when emailBody missing', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);
      const res = await POST(buildRequest({ supplierId: 'sup_1', emailSubject: 'S' }), { params });
      expect(res.status).toBe(400);
    });

    it('should return 404 when quote not found', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);
      (prisma.quoteRequest.findUnique as any).mockResolvedValue(null);

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(404);
    });
  });

  describe('Conversion lock validation', () => {
    it('should return 409 when quote already CONVERTED_TO_ORDER', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);
      (prisma.quoteRequest.findUnique as any).mockResolvedValue(
        makeLockCheck({ status: 'CONVERTED_TO_ORDER' })
      );

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.alreadyConverted).toBe(true);
    });

    it('should return 409 when lock held by different user', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);
      (prisma.quoteRequest.findUnique as any).mockResolvedValue(
        makeLockCheck({ convertingBy: 'user_other' })
      );

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(409);
    });

    it('should return 409 when no active lock', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);
      (prisma.quoteRequest.findUnique as any).mockResolvedValue(
        makeLockCheck({ isConverting: false })
      );

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(409);
    });

    it('should return 409 when lock has expired', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);
      const expiredTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      (prisma.quoteRequest.findUnique as any).mockResolvedValue(
        makeLockCheck({ convertingStartedAt: expiredTime })
      );

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(409);
    });
  });

  describe('Idempotency', () => {
    it('should return cached response when idempotency key matches', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);
      mockGetIdempotencyKey.mockReturnValue('idem-key-1');
      mockCheckIdempotency.mockResolvedValue({ success: true, order: { id: 'ord_cached' } });

      const res = await POST(buildRequest(validBody), { params });
      const json = await res.json();

      expect(json.order.id).toBe('ord_cached');
      expect(res.headers.get('X-Idempotency-Replay')).toBe('true');
    });
  });

  describe('Successful conversion', () => {
    it('should create order, update status, and return order details', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);

      // First findUnique: lock check
      (prisma.quoteRequest.findUnique as any)
        .mockResolvedValueOnce(makeLockCheck())
        // Second findUnique: full quote with relations
        .mockResolvedValueOnce(makeFullQuote());

      // Transaction mock — return created order
      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          order: {
            create: vi.fn().mockResolvedValue({
              id: 'ord_1',
              orderNumber: 'ORD-001',
              status: 'PENDING',
              total: 29.99,
              orderItems: [{ id: 'oi_1' }],
              supplier: { id: 'sup_1' },
              vehicle: { id: 'v_1' },
            }),
          },
          quoteRequest: { update: vi.fn() },
          quoteRequestEmailThread: { updateMany: vi.fn(), update: vi.fn() },
          supplierQuoteItem: { updateMany: vi.fn() },
          emailThread: { update: vi.fn() },
        };
        return fn(tx);
      });

      const res = await POST(buildRequest(validBody), { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.order.orderNumber).toBe('ORD-001');
      expect(mockEmailClient.sendEmail).toHaveBeenCalled();
    });
  });
});
