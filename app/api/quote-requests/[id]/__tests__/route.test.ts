import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---- Mocks ----

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quoteRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    supplier: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    vehicle: {
      findFirst: vi.fn(),
    },
  },
}));

// ---- Imports ----

import { GET, PATCH, DELETE } from '../route';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ---- Helpers ----

const params = Promise.resolve({ id: 'qr_1' });

function buildGetRequest() {
  return new NextRequest('http://localhost:3000/api/quote-requests/qr_1', { method: 'GET' });
}

function buildPatchRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/quote-requests/qr_1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildDeleteRequest() {
  return new NextRequest('http://localhost:3000/api/quote-requests/qr_1', { method: 'DELETE' });
}

const adminSession = {
  user: { id: 'user_admin', role: 'ADMIN', organizationId: 'org_1', name: 'Admin', email: 'admin@test.com' },
};

const techSession = {
  user: { id: 'user_tech', role: 'TECHNICIAN', organizationId: 'org_1', name: 'Tech', email: 'tech@test.com' },
};

const makeQuote = (status: string, extra: any = {}) => ({
  id: 'qr_1',
  quoteNumber: 'QR-001',
  status,
  organizationId: 'org_1',
  createdById: 'user_tech',
  totalAmount: null,
  additionalSupplierIds: null,
  items: [],
  emailThreads: [],
  supplier: null,
  selectedSupplier: null,
  vehicle: null,
  createdBy: { id: 'user_tech', name: 'Tech', email: 'tech@test.com', role: 'TECHNICIAN' },
  approvedBy: null,
  pickList: null,
  organization: { name: 'Test Org' },
  ...extra,
});

// ---- Tests ----

describe('Quote Request [id] API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // GET

  describe('GET /api/quote-requests/[id]', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await GET(buildGetRequest(), { params });
      expect(res.status).toBe(401);
    });

    it('should return 404 when quote not found', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(null);

      const res = await GET(buildGetRequest(), { params });
      expect(res.status).toBe(404);
    });

    it('should return quote with all includes for ADMIN', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT'));

      const res = await GET(buildGetRequest(), { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.quoteRequest.quoteNumber).toBe('QR-001');
    });

    it('should restrict TECHNICIAN to their own quotes', async () => {
      (getServerSession as any).mockResolvedValue(techSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(null);

      await GET(buildGetRequest(), { params });

      const findCall = (prisma.quoteRequest.findFirst as any).mock.calls[0][0];
      expect(findCall.where.createdById).toBe('user_tech');
    });

    it('should parse additionalSupplierIds and fetch additional suppliers', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(
        makeQuote('SENT', { additionalSupplierIds: 'sup_2,sup_3' })
      );
      (prisma.supplier.findMany as any).mockResolvedValue([
        { id: 'sup_2', name: 'Supplier 2' },
        { id: 'sup_3', name: 'Supplier 3' },
      ]);

      const res = await GET(buildGetRequest(), { params });
      const json = await res.json();

      expect(json.quoteRequest.additionalSuppliers).toHaveLength(2);
    });

    it('should filter email threads for technicians', async () => {
      (getServerSession as any).mockResolvedValue(techSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(
        makeQuote('SENT', {
          emailThreads: [
            { threadRole: 'TECHNICIAN', visibleToCreator: true, quotedAmount: null },
            { threadRole: 'MANAGER', visibleToCreator: false, quotedAmount: null },
            { threadRole: 'MANAGER', visibleToCreator: true, quotedAmount: null },
          ],
        })
      );

      const res = await GET(buildGetRequest(), { params });
      const json = await res.json();

      // Manager thread with visibleToCreator=false should be filtered out
      expect(json.quoteRequest.emailThreads).toHaveLength(2);
    });
  });

  // PATCH

  describe('PATCH /api/quote-requests/[id]', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await PATCH(buildPatchRequest({ title: 'Updated' }), { params });
      expect(res.status).toBe(401);
    });

    it('should return 400 for invalid expiryDate', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      const res = await PATCH(buildPatchRequest({ expiryDate: 'not-a-date' }), { params });
      expect(res.status).toBe(400);
    });

    it('should return 404 when quote not found', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(null);

      const res = await PATCH(buildPatchRequest({ title: 'Updated' }), { params });
      expect(res.status).toBe(404);
    });

    it('should update title and notes fields', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT'));
      (prisma.quoteRequest.update as any).mockResolvedValue(
        makeQuote('DRAFT', { title: 'Updated Title', notes: 'New notes' })
      );

      const res = await PATCH(buildPatchRequest({ title: 'Updated Title', notes: 'New notes' }), { params });
      expect(res.status).toBe(200);
    });

    it('should validate supplier exists when supplierId is updated', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT'));
      (prisma.supplier.findFirst as any).mockResolvedValue(null); // Supplier not found

      const res = await PATCH(buildPatchRequest({ supplierId: 'sup_bad' }), { params });
      expect(res.status).toBe(404);
    });

    it('should validate vehicle exists when vehicleId is updated', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT'));
      (prisma.vehicle.findFirst as any).mockResolvedValue(null); // Vehicle not found

      const res = await PATCH(buildPatchRequest({ vehicleId: 'v_bad' }), { params });
      expect(res.status).toBe(404);
    });

    it('should restrict TECHNICIAN to their own quotes', async () => {
      (getServerSession as any).mockResolvedValue(techSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(null);

      await PATCH(buildPatchRequest({ title: 'X' }), { params });

      const findCall = (prisma.quoteRequest.findFirst as any).mock.calls[0][0];
      expect(findCall.where.createdById).toBe('user_tech');
    });
  });

  // DELETE

  describe('DELETE /api/quote-requests/[id]', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await DELETE(buildDeleteRequest(), { params });
      expect(res.status).toBe(401);
    });

    it('should return 404 when quote not found', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(null);

      const res = await DELETE(buildDeleteRequest(), { params });
      expect(res.status).toBe(404);
    });

    it('should only allow deletion of DRAFT quotes', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT'));
      (prisma.quoteRequest.delete as any).mockResolvedValue({});

      const res = await DELETE(buildDeleteRequest(), { params });
      expect(res.status).toBe(200);
      expect(prisma.quoteRequest.delete).toHaveBeenCalled();
    });

    it('should return 400 for non-DRAFT quote deletion', async () => {
      for (const status of ['SENT', 'RECEIVED', 'APPROVED', 'CONVERTED_TO_ORDER']) {
        vi.clearAllMocks();
        (getServerSession as any).mockResolvedValue(adminSession);
        (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote(status));

        const res = await DELETE(buildDeleteRequest(), { params });
        expect(res.status).toBe(400);
        expect(prisma.quoteRequest.delete).not.toHaveBeenCalled();
      }
    });
  });
});
