import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---- Mocks ----

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminEmail: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// ---- Imports ----

import { GET } from '../../history/route';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ---- Helpers ----

function buildGetRequest(params?: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/admin/communications/history');
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url, { method: 'GET' });
}

const masterAdminSession = {
  user: {
    id: 'master_admin_1',
    role: 'MASTER_ADMIN',
    organizationId: 'org_master',
    name: 'Master Admin',
    email: 'master@partsiqai.com',
  },
};

const mockEmails = [
  {
    id: 'ae_1',
    subject: 'Welcome to PartsIQ!',
    htmlBody: '<html>Welcome</html>',
    templateType: 'welcome_followup',
    senderEmail: 'onboarding@partsiqai.com',
    recipientEmail: 'john@acme.com',
    recipientName: 'John Doe',
    status: 'sent',
    errorMessage: null,
    createdAt: '2026-03-15T10:00:00Z',
    sentBy: { id: 'master_admin_1', name: 'Master Admin', email: 'master@partsiqai.com' },
    recipient: { id: 'user_1', name: 'John Doe', email: 'john@acme.com' },
    organization: { id: 'org_1', name: 'Acme Corp' },
  },
  {
    id: 'ae_2',
    subject: 'Need help?',
    htmlBody: '<html>Setup</html>',
    templateType: 'setup_help',
    senderEmail: 'support@partsiqai.com',
    recipientEmail: 'jane@acme.com',
    recipientName: 'Jane',
    status: 'failed',
    errorMessage: 'Bounce detected',
    createdAt: '2026-03-14T08:00:00Z',
    sentBy: { id: 'master_admin_1', name: 'Master Admin', email: 'master@partsiqai.com' },
    recipient: { id: 'user_2', name: 'Jane', email: 'jane@acme.com' },
    organization: { id: 'org_1', name: 'Acme Corp' },
  },
];

// ---- Tests ----

describe('GET /api/admin/communications/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue(masterAdminSession);
    (prisma.adminEmail.findMany as any).mockResolvedValue(mockEmails);
    (prisma.adminEmail.count as any).mockResolvedValue(2);
  });

  // ---- Authentication ----

  describe('Authentication', () => {
    it('should return 403 for unauthenticated requests', async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await GET(buildGetRequest());
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 403 for regular ADMIN', async () => {
      (getServerSession as any).mockResolvedValue({
        user: { id: 'admin_1', role: 'ADMIN', organizationId: 'org_1' },
      });
      const res = await GET(buildGetRequest());
      expect(res.status).toBe(403);
    });

    it('should return 403 for TECHNICIAN', async () => {
      (getServerSession as any).mockResolvedValue({
        user: { id: 'tech_1', role: 'TECHNICIAN', organizationId: 'org_1' },
      });
      const res = await GET(buildGetRequest());
      expect(res.status).toBe(403);
    });

    it('should allow MASTER_ADMIN access', async () => {
      const res = await GET(buildGetRequest());
      expect(res.status).toBe(200);
    });
  });

  // ---- Default behavior ----

  describe('Default listing', () => {
    it('should return emails with pagination', async () => {
      const res = await GET(buildGetRequest());
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.emails).toHaveLength(2);
      expect(json.pagination).toEqual({
        page: 1,
        limit: 25,
        total: 2,
        totalPages: 1,
      });
    });

    it('should order by createdAt desc', async () => {
      await GET(buildGetRequest());
      const findCall = (prisma.adminEmail.findMany as any).mock.calls[0][0];
      expect(findCall.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('should include sentBy, recipient, and organization relations', async () => {
      await GET(buildGetRequest());
      const findCall = (prisma.adminEmail.findMany as any).mock.calls[0][0];
      expect(findCall.include.sentBy).toBeDefined();
      expect(findCall.include.recipient).toBeDefined();
      expect(findCall.include.organization).toBeDefined();
    });
  });

  // ---- Filters ----

  describe('Filters', () => {
    it('should filter by organizationId', async () => {
      await GET(buildGetRequest({ organizationId: 'org_1' }));
      const findCall = (prisma.adminEmail.findMany as any).mock.calls[0][0];
      expect(findCall.where.organizationId).toBe('org_1');
    });

    it('should filter by templateType', async () => {
      await GET(buildGetRequest({ templateType: 'welcome_followup' }));
      const findCall = (prisma.adminEmail.findMany as any).mock.calls[0][0];
      expect(findCall.where.templateType).toBe('welcome_followup');
    });

    it('should filter by search across subject, recipientEmail, recipientName', async () => {
      await GET(buildGetRequest({ search: 'john' }));
      const findCall = (prisma.adminEmail.findMany as any).mock.calls[0][0];
      expect(findCall.where.OR).toEqual([
        { subject: { contains: 'john', mode: 'insensitive' } },
        { recipientEmail: { contains: 'john', mode: 'insensitive' } },
        { recipientName: { contains: 'john', mode: 'insensitive' } },
      ]);
    });

    it('should not add filters when params are absent', async () => {
      await GET(buildGetRequest());
      const findCall = (prisma.adminEmail.findMany as any).mock.calls[0][0];
      expect(findCall.where).toEqual({});
    });

    it('should combine multiple filters', async () => {
      await GET(buildGetRequest({ organizationId: 'org_1', templateType: 'custom' }));
      const findCall = (prisma.adminEmail.findMany as any).mock.calls[0][0];
      expect(findCall.where.organizationId).toBe('org_1');
      expect(findCall.where.templateType).toBe('custom');
    });
  });

  // ---- Pagination ----

  describe('Pagination', () => {
    it('should default to page 1, limit 25', async () => {
      await GET(buildGetRequest());
      const findCall = (prisma.adminEmail.findMany as any).mock.calls[0][0];
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(25);
    });

    it('should respect custom page and limit', async () => {
      await GET(buildGetRequest({ page: '3', limit: '10' }));
      const findCall = (prisma.adminEmail.findMany as any).mock.calls[0][0];
      expect(findCall.skip).toBe(20); // (3-1) * 10
      expect(findCall.take).toBe(10);
    });

    it('should cap limit at 100', async () => {
      await GET(buildGetRequest({ limit: '500' }));
      const findCall = (prisma.adminEmail.findMany as any).mock.calls[0][0];
      expect(findCall.take).toBe(100);
    });

    it('should calculate totalPages correctly', async () => {
      (prisma.adminEmail.count as any).mockResolvedValue(47);
      const res = await GET(buildGetRequest({ limit: '10' }));
      const json = await res.json();
      expect(json.pagination.totalPages).toBe(5); // ceil(47/10)
    });
  });

  // ---- Error handling ----

  describe('Error handling', () => {
    it('should return 500 when prisma throws', async () => {
      (prisma.adminEmail.findMany as any).mockRejectedValue(new Error('DB connection lost'));
      const res = await GET(buildGetRequest());
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Failed to fetch email history');
    });
  });
});
