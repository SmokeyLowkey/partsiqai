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
    },
    supplier: {
      findMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    emailThread: {
      create: vi.fn(),
    },
    emailMessage: {
      create: vi.fn(),
    },
    quoteRequestEmailThread: {
      create: vi.fn(),
    },
    editedEmail: {
      create: vi.fn(),
    },
  },
}));

const { mockGetEmailClient } = vi.hoisted(() => ({
  mockGetEmailClient: vi.fn(),
}));

vi.mock('@/lib/services/email/email-client-factory', () => ({
  getEmailClientForUser: mockGetEmailClient,
}));

vi.mock('@/lib/utils/business-days', () => ({
  addBusinessDays: vi.fn(() => new Date('2026-03-01')),
}));

// ---- Imports ----

import { POST } from '../../send/route';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ---- Helpers ----

const params = Promise.resolve({ id: 'qr_1' });

function buildRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/quote-requests/qr_1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const adminSession = {
  user: { id: 'user_admin', role: 'ADMIN', organizationId: 'org_1', name: 'Admin', email: 'admin@test.com' },
};

const techSession = {
  user: { id: 'user_tech', role: 'TECHNICIAN', organizationId: 'org_1', name: 'Tech', email: 'tech@test.com' },
};

const validBody = {
  suppliers: [
    { id: 'sup_1', email: 'supplier@test.com', subject: 'Quote Request', body: 'Please quote...' },
  ],
};

const makeQuote = (status: string, extra: any = {}) => ({
  id: 'qr_1',
  quoteNumber: 'QR-001',
  status,
  organizationId: 'org_1',
  createdById: 'user_tech',
  supplierId: null,
  additionalSupplierIds: null,
  ...extra,
});

const mockEmailClient = {
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'msg_1', threadId: 'thread_1' }),
};

// ---- Tests ----

describe('Quote Request Send API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEmailClient.mockResolvedValue(mockEmailClient);
    mockEmailClient.sendEmail.mockResolvedValue({ messageId: 'msg_1', threadId: 'thread_1' });
    (prisma.organization.findUnique as any).mockResolvedValue({
      billingEmail: 'org@test.com',
      name: 'Test Org',
    });
    (prisma.emailThread.create as any).mockResolvedValue({ id: 'et_1' });
    (prisma.emailMessage.create as any).mockResolvedValue({ id: 'em_1' });
    (prisma.quoteRequestEmailThread.create as any).mockResolvedValue({ id: 'qret_1' });
    (prisma.editedEmail.create as any).mockResolvedValue({ id: 'ee_1' });
  });

  describe('Authentication & authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(401);
    });

    it('should return 404 when quote not found (wrong org)', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(null);

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(404);
    });

    it('should restrict TECHNICIAN to their own quotes', async () => {
      (getServerSession as any).mockResolvedValue(techSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(null);

      await POST(buildRequest(validBody), { params });

      const findCall = (prisma.quoteRequest.findFirst as any).mock.calls[0][0];
      expect(findCall.where.createdById).toBe('user_tech');
    });
  });

  describe('Validation', () => {
    it('should return 400 for empty suppliers array', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      const res = await POST(buildRequest({ suppliers: [] }), { params });
      expect(res.status).toBe(400);
    });

    it('should return 400 for supplier with invalid email', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      const res = await POST(buildRequest({
        suppliers: [{ id: 'sup_1', email: 'not-an-email', subject: 'S', body: 'B' }],
      }), { params });
      expect(res.status).toBe(400);
    });

    it('should return 404 when supplier not found in org', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT'));
      (prisma.supplier.findMany as any).mockResolvedValue([]); // No suppliers found

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(404);
    });

    it('should return 400 when status is CONVERTED_TO_ORDER', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('CONVERTED_TO_ORDER'));

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(400);
    });

    it('should return 400 when status is EXPIRED', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('EXPIRED'));

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(400);
    });

    it('should return 400 when email client not configured', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT'));
      (prisma.supplier.findMany as any).mockResolvedValue([{ id: 'sup_1' }]);
      mockGetEmailClient.mockRejectedValue(new Error('Email not configured'));

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(400);
    });
  });

  describe('Successful send', () => {
    it('should send emails and create thread records', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT'));
      (prisma.supplier.findMany as any).mockResolvedValue([{ id: 'sup_1' }]);

      const res = await POST(buildRequest(validBody), { params });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.sentCount).toBe(1);
      expect(mockEmailClient.sendEmail).toHaveBeenCalledOnce();
      expect(prisma.emailThread.create).toHaveBeenCalledOnce();
      expect(prisma.emailMessage.create).toHaveBeenCalledOnce();
    });

    it('should update quote status from DRAFT to SENT', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT'));
      (prisma.supplier.findMany as any).mockResolvedValue([{ id: 'sup_1' }]);

      await POST(buildRequest(validBody), { params });

      const updateCall = (prisma.quoteRequest.update as any).mock.calls[0][0];
      expect(updateCall.data.status).toBe('SENT');
    });

    it('should NOT regress status from RECEIVED back to SENT', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('RECEIVED'));
      (prisma.supplier.findMany as any).mockResolvedValue([{ id: 'sup_1' }]);

      await POST(buildRequest(validBody), { params });

      // Update should not set status to SENT
      if ((prisma.quoteRequest.update as any).mock.calls.length > 0) {
        const updateCall = (prisma.quoteRequest.update as any).mock.calls[0][0];
        expect(updateCall.data.status).toBeUndefined();
      }
    });

    it('should set supplierId on first send', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT', { supplierId: null }));
      (prisma.supplier.findMany as any).mockResolvedValue([{ id: 'sup_1' }]);

      await POST(buildRequest(validBody), { params });

      const updateCall = (prisma.quoteRequest.update as any).mock.calls[0][0];
      expect(updateCall.data.supplierId).toBe('sup_1');
    });

    it('should return 500 when ALL emails fail', async () => {
      (getServerSession as any).mockResolvedValue(adminSession);
      (prisma.quoteRequest.findFirst as any).mockResolvedValue(makeQuote('DRAFT'));
      (prisma.supplier.findMany as any).mockResolvedValue([{ id: 'sup_1' }]);
      mockEmailClient.sendEmail.mockRejectedValue(new Error('SMTP failed'));

      const res = await POST(buildRequest(validBody), { params });
      expect(res.status).toBe(500);
    });
  });
});
