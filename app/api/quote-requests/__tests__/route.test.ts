import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---- Mocks ----

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quoteRequest: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    chatPickList: {
      findFirst: vi.fn(),
    },
    vehicle: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/utils/quote-number', () => ({
  generateQuoteNumber: vi.fn().mockResolvedValue('QR-02-2026-0001'),
}));

// ---- Imports ----

import { GET, POST } from '../route';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ---- Helpers ----

function buildGetRequest(params?: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/quote-requests');
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url, { method: 'GET' });
}

function buildPostRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/quote-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const adminSession = {
  user: {
    id: 'user_admin',
    role: 'ADMIN',
    organizationId: 'org_1',
    name: 'Test Admin',
    email: 'admin@test.com',
  },
};

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
    email: 'manager@test.com',
  },
};

// ---- Tests ----

describe('Quote Requests CRUD API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // GET /api/quote-requests
  // ============================================================

  describe('GET /api/quote-requests', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (getServerSession as any).mockResolvedValue(null);

      const res = await GET(buildGetRequest());
      expect(res.status).toBe(401);
    });

    it('should list quote requests for authenticated user', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findMany as any).mockResolvedValue([
        {
          id: 'qr_1',
          quoteNumber: 'QR-001',
          status: 'DRAFT',
          items: [{ id: 'i_1' }],
          totalAmount: null,
        },
      ]);
      (prisma.quoteRequest.count as any).mockResolvedValue(1);

      const res = await GET(buildGetRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.quoteRequests).toHaveLength(1);
      expect(json.pagination.total).toBe(1);
    });

    it('should filter by status parameter', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findMany as any).mockResolvedValue([]);
      (prisma.quoteRequest.count as any).mockResolvedValue(0);

      await GET(buildGetRequest({ status: 'SENT' }));

      const findManyCall = (prisma.quoteRequest.findMany as any).mock.calls[0][0];
      expect(findManyCall.where.status).toBe('SENT');
    });

    it('should filter by search parameter', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findMany as any).mockResolvedValue([]);
      (prisma.quoteRequest.count as any).mockResolvedValue(0);

      await GET(buildGetRequest({ search: 'QR-001' }));

      const findManyCall = (prisma.quoteRequest.findMany as any).mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
    });

    it('should filter by supplierId parameter', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findMany as any).mockResolvedValue([]);
      (prisma.quoteRequest.count as any).mockResolvedValue(0);

      await GET(buildGetRequest({ supplierId: 'sup_1' }));

      const findManyCall = (prisma.quoteRequest.findMany as any).mock.calls[0][0];
      expect(findManyCall.where.supplierId).toBe('sup_1');
    });

    it('should paginate with page and limit parameters', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findMany as any).mockResolvedValue([]);
      (prisma.quoteRequest.count as any).mockResolvedValue(100);

      const res = await GET(buildGetRequest({ page: '2', limit: '10' }));
      const json = await res.json();

      const findManyCall = (prisma.quoteRequest.findMany as any).mock.calls[0][0];
      expect(findManyCall.skip).toBe(10);
      expect(findManyCall.take).toBe(10);
      expect(json.pagination.page).toBe(2);
    });

    it('should restrict TECHNICIAN to their own quotes', async () => {
      (getServerSession as any).mockResolvedValue(technicianSession);
      (prisma.quoteRequest.findMany as any).mockResolvedValue([]);
      (prisma.quoteRequest.count as any).mockResolvedValue(0);

      await GET(buildGetRequest());

      const findManyCall = (prisma.quoteRequest.findMany as any).mock.calls[0][0];
      expect(findManyCall.where.createdById).toBe('user_tech');
    });

    it('should let MANAGER see all organization quotes', async () => {
      (getServerSession as any).mockResolvedValue(managerSession);
      (prisma.quoteRequest.findMany as any).mockResolvedValue([]);
      (prisma.quoteRequest.count as any).mockResolvedValue(0);

      await GET(buildGetRequest());

      const findManyCall = (prisma.quoteRequest.findMany as any).mock.calls[0][0];
      expect(findManyCall.where.createdById).toBeUndefined();
    });
  });

  // ============================================================
  // POST /api/quote-requests
  // ============================================================

  describe('POST /api/quote-requests', () => {
    const pickListWithItems = {
      id: 'pl_1',
      vehicleId: 'v_1',
      items: [
        {
          partNumber: 'AT-123',
          description: 'Fuel Filter',
          quantity: 2,
          estimatedPrice: 29.99,
          notes: null,
          source: 'search',
        },
      ],
      vehicle: { id: 'v_1' },
    };

    it('should return 401 for unauthenticated requests', async () => {
      (getServerSession as any).mockResolvedValue(null);

      const res = await POST(buildPostRequest({ pickListId: 'pl_1' }));
      expect(res.status).toBe(401);
    });

    it('should return 400 for missing pickListId', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);

      const res = await POST(buildPostRequest({}));
      expect(res.status).toBe(400);
    });

    it('should return 404 when pick list not found', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.chatPickList.findFirst as any).mockResolvedValue(null);

      const res = await POST(buildPostRequest({ pickListId: 'pl_nonexistent' }));
      expect(res.status).toBe(404);
    });

    it('should return 400 when pick list has no items', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.chatPickList.findFirst as any).mockResolvedValue({
        id: 'pl_1',
        items: [],
        vehicleId: null,
      });

      const res = await POST(buildPostRequest({ pickListId: 'pl_1' }));
      expect(res.status).toBe(400);
    });

    it('should create quote request with items from pick list and MISC-COSTS', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.chatPickList.findFirst as any).mockResolvedValue(pickListWithItems);
      (prisma.vehicle.findFirst as any).mockResolvedValue({ id: 'v_1' }); // Vehicle exists
      (prisma.quoteRequest.create as any).mockResolvedValue({
        id: 'qr_new',
        quoteNumber: 'QR-02-2026-0001',
        status: 'DRAFT',
        items: [
          { partNumber: 'AT-123', description: 'Fuel Filter', quantity: 2 },
          { partNumber: 'MISC-COSTS', description: 'Additional Costs & Fees', quantity: 1 },
        ],
        vehicle: null,
        createdBy: { id: 'user_admin', name: 'Test Admin', email: 'admin@test.com' },
      });

      const res = await POST(buildPostRequest({ pickListId: 'pl_1' }));
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.quoteRequest.quoteNumber).toBe('QR-02-2026-0001');

      // Verify MISC-COSTS is included in creation
      const createCall = (prisma.quoteRequest.create as any).mock.calls[0][0];
      const itemsToCreate = createCall.data.items.create;
      const miscItem = itemsToCreate.find((i: any) => i.partNumber === 'MISC-COSTS');
      expect(miscItem).toBeDefined();
    });

    it('should use vehicleId from request body when provided', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.chatPickList.findFirst as any).mockResolvedValue({
        ...pickListWithItems,
        vehicleId: 'v_old',
      });
      (prisma.vehicle.findFirst as any).mockResolvedValue({ id: 'v_new' });
      (prisma.quoteRequest.create as any).mockResolvedValue({
        id: 'qr_new',
        items: [],
        vehicle: null,
        createdBy: { id: 'user_admin', name: 'Admin', email: 'a@t.com' },
      });

      await POST(buildPostRequest({ pickListId: 'pl_1', vehicleId: 'v_new' }));

      const createCall = (prisma.quoteRequest.create as any).mock.calls[0][0];
      expect(createCall.data.vehicleId).toBe('v_new');
    });

    it('should return 404 when vehicle not found in organization', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.chatPickList.findFirst as any).mockResolvedValue(pickListWithItems);
      (prisma.vehicle.findFirst as any).mockResolvedValue(null);

      const res = await POST(buildPostRequest({ pickListId: 'pl_1', vehicleId: 'v_bad' }));
      expect(res.status).toBe(404);
    });
  });
});
