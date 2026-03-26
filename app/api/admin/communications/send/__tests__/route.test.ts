import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---- Mocks ----

const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    adminEmail: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email/resend', () => ({
  sendEmail: mockSendEmail,
  getBaseUrl: vi.fn().mockReturnValue('https://partsiqai.com'),
  getWelcomeFollowupEmailHtml: vi.fn().mockReturnValue('<html>Welcome</html>'),
  getTrialExpiringEmailHtml: vi.fn().mockReturnValue('<html>Trial</html>'),
  getSetupHelpEmailHtml: vi.fn().mockReturnValue('<html>Setup</html>'),
  getCustomAdminEmailHtml: vi.fn().mockReturnValue('<html>Custom</html>'),
}));

// ---- Imports ----

import { POST } from '../../send/route';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getWelcomeFollowupEmailHtml,
  getTrialExpiringEmailHtml,
  getSetupHelpEmailHtml,
  getCustomAdminEmailHtml,
} from '@/lib/email/resend';

// ---- Helpers ----

function buildPostRequest(body: any) {
  return new NextRequest('http://localhost:3000/api/admin/communications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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

const regularAdminSession = {
  user: {
    id: 'admin_1',
    role: 'ADMIN',
    organizationId: 'org_1',
    name: 'Org Admin',
    email: 'admin@acme.com',
  },
};

const mockOrg = {
  name: 'Acme Corp',
  trialEndsAt: new Date('2026-03-22T00:00:00Z'),
};

const mockRecipients = [
  { id: 'user_1', name: 'John Doe', email: 'john@acme.com' },
  { id: 'user_2', name: null, email: 'jane@acme.com' },
];

const validPayload = {
  templateType: 'welcome_followup' as const,
  organizationId: 'org_1',
  recipientUserIds: ['user_1', 'user_2'],
  senderEmail: 'onboarding@partsiqai.com',
};

// ---- Tests ----

describe('POST /api/admin/communications/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue(masterAdminSession);
    (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
    (prisma.user.findMany as any).mockResolvedValue(mockRecipients);
    (prisma.adminEmail.create as any).mockImplementation(async ({ data }: any) => ({
      id: `email_${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
    }));
    mockSendEmail.mockResolvedValue({ id: 'resend_msg_123' });
  });

  // ---- Authentication ----

  describe('Authentication', () => {
    it('should return 403 for unauthenticated requests', async () => {
      (getServerSession as any).mockResolvedValue(null);
      const res = await POST(buildPostRequest(validPayload));
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 403 for regular ADMIN', async () => {
      (getServerSession as any).mockResolvedValue(regularAdminSession);
      const res = await POST(buildPostRequest(validPayload));
      expect(res.status).toBe(403);
    });

    it('should return 403 for TECHNICIAN', async () => {
      (getServerSession as any).mockResolvedValue({
        user: { id: 'tech_1', role: 'TECHNICIAN', organizationId: 'org_1' },
      });
      const res = await POST(buildPostRequest(validPayload));
      expect(res.status).toBe(403);
    });
  });

  // ---- Validation ----

  describe('Validation', () => {
    it('should return 400 for missing templateType', async () => {
      const { templateType, ...payload } = validPayload;
      const res = await POST(buildPostRequest(payload));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid request');
    });

    it('should return 400 for empty recipientUserIds', async () => {
      const res = await POST(buildPostRequest({ ...validPayload, recipientUserIds: [] }));
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid senderEmail', async () => {
      const res = await POST(buildPostRequest({ ...validPayload, senderEmail: 'hacker@evil.com' }));
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid templateType', async () => {
      const res = await POST(buildPostRequest({ ...validPayload, templateType: 'phishing' }));
      expect(res.status).toBe(400);
    });

    it('should return 400 for custom template without subject', async () => {
      const res = await POST(buildPostRequest({
        ...validPayload,
        templateType: 'custom',
        customBody: 'Hello',
        // missing subject
      }));
      expect(res.status).toBe(400);
    });

    it('should return 400 for custom template without body', async () => {
      const res = await POST(buildPostRequest({
        ...validPayload,
        templateType: 'custom',
        subject: 'Test Subject',
        // missing customBody
      }));
      expect(res.status).toBe(400);
    });
  });

  // ---- Organization & Recipient validation ----

  describe('Organization & Recipient lookup', () => {
    it('should return 404 when organization not found', async () => {
      (prisma.organization.findUnique as any).mockResolvedValue(null);
      const res = await POST(buildPostRequest(validPayload));
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Organization not found');
    });

    it('should return 400 when no valid recipients found', async () => {
      (prisma.user.findMany as any).mockResolvedValue([]);
      const res = await POST(buildPostRequest(validPayload));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('No valid recipients found in this organization');
    });

    it('should query users scoped to the organization', async () => {
      await POST(buildPostRequest(validPayload));
      const userQuery = (prisma.user.findMany as any).mock.calls[0][0];
      expect(userQuery.where.organizationId).toBe('org_1');
      expect(userQuery.where.id.in).toEqual(['user_1', 'user_2']);
    });
  });

  // ---- Template rendering ----

  describe('Template rendering', () => {
    it('should call welcome_followup template', async () => {
      await POST(buildPostRequest(validPayload));
      expect(getWelcomeFollowupEmailHtml).toHaveBeenCalledTimes(2); // 2 recipients
      expect(getWelcomeFollowupEmailHtml).toHaveBeenCalledWith(
        'John Doe',
        'Acme Corp',
        'https://partsiqai.com/admin/dashboard'
      );
    });

    it('should call trial_expiring template with calculated days', async () => {
      await POST(buildPostRequest({ ...validPayload, templateType: 'trial_expiring' }));
      expect(getTrialExpiringEmailHtml).toHaveBeenCalledTimes(2);
      // First call should have recipient name, org name, days left (number), and upgrade URL
      const args = (getTrialExpiringEmailHtml as any).mock.calls[0];
      expect(args[0]).toBe('John Doe');
      expect(args[1]).toBe('Acme Corp');
      expect(typeof args[2]).toBe('number');
      expect(args[3]).toBe('https://partsiqai.com/admin/billing');
    });

    it('should call setup_help template', async () => {
      await POST(buildPostRequest({ ...validPayload, templateType: 'setup_help' }));
      expect(getSetupHelpEmailHtml).toHaveBeenCalledTimes(2);
    });

    it('should call custom template with subject and body', async () => {
      await POST(buildPostRequest({
        ...validPayload,
        templateType: 'custom',
        subject: 'Important Update',
        customBody: 'Please read this carefully.',
      }));
      expect(getCustomAdminEmailHtml).toHaveBeenCalledWith(
        'John Doe',
        'Important Update',
        'Please read this carefully.'
      );
    });

    it('should use email prefix as name when user name is null', async () => {
      (prisma.user.findMany as any).mockResolvedValue([
        { id: 'user_2', name: null, email: 'jane@acme.com' },
      ]);
      await POST(buildPostRequest({ ...validPayload, recipientUserIds: ['user_2'] }));
      expect(getWelcomeFollowupEmailHtml).toHaveBeenCalledWith(
        'jane',
        'Acme Corp',
        expect.any(String)
      );
    });

    it('should allow subject override on canned templates', async () => {
      await POST(buildPostRequest({
        ...validPayload,
        subject: 'Custom Welcome Subject',
      }));
      const createCall = (prisma.adminEmail.create as any).mock.calls[0][0];
      expect(createCall.data.subject).toBe('Custom Welcome Subject');
    });
  });

  // ---- Email sending ----

  describe('Email sending', () => {
    it('should send email for each recipient', async () => {
      await POST(buildPostRequest(validPayload));
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
    });

    it('should use correct from address', async () => {
      await POST(buildPostRequest({ ...validPayload, senderEmail: 'support@partsiqai.com' }));
      const sendCall = mockSendEmail.mock.calls[0][0];
      expect(sendCall.from).toBe('PartsIQ <support@partsiqai.com>');
    });

    it('should send to correct recipient emails', async () => {
      await POST(buildPostRequest(validPayload));
      expect(mockSendEmail.mock.calls[0][0].to).toBe('john@acme.com');
      expect(mockSendEmail.mock.calls[1][0].to).toBe('jane@acme.com');
    });

    it('should return sent count on success', async () => {
      const res = await POST(buildPostRequest(validPayload));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.sent).toBe(2);
      expect(json.failed).toBe(0);
      expect(json.emails).toHaveLength(2);
    });

    it('should handle partial send failures gracefully', async () => {
      mockSendEmail
        .mockResolvedValueOnce({ id: 'msg_ok' })
        .mockRejectedValueOnce(new Error('Resend rate limit'));

      const res = await POST(buildPostRequest(validPayload));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.sent).toBe(1);
      expect(json.failed).toBe(1);
    });

    it('should store resendMessageId on success', async () => {
      mockSendEmail.mockResolvedValue({ id: 'resend_abc' });
      await POST(buildPostRequest(validPayload));
      const createCall = (prisma.adminEmail.create as any).mock.calls[0][0];
      expect(createCall.data.resendMessageId).toBe('resend_abc');
      expect(createCall.data.status).toBe('sent');
    });

    it('should store error message on failure', async () => {
      mockSendEmail.mockRejectedValue(new Error('Invalid recipient'));
      await POST(buildPostRequest(validPayload));
      const createCall = (prisma.adminEmail.create as any).mock.calls[0][0];
      expect(createCall.data.status).toBe('failed');
      expect(createCall.data.errorMessage).toBe('Invalid recipient');
    });
  });

  // ---- AdminEmail record creation ----

  describe('AdminEmail record creation', () => {
    it('should create an AdminEmail record per recipient', async () => {
      await POST(buildPostRequest(validPayload));
      expect(prisma.adminEmail.create).toHaveBeenCalledTimes(2);
    });

    it('should store correct fields in AdminEmail', async () => {
      await POST(buildPostRequest(validPayload));
      const data = (prisma.adminEmail.create as any).mock.calls[0][0].data;
      expect(data.templateType).toBe('welcome_followup');
      expect(data.senderEmail).toBe('onboarding@partsiqai.com');
      expect(data.recipientEmail).toBe('john@acme.com');
      expect(data.recipientName).toBe('John Doe');
      expect(data.recipientUserId).toBe('user_1');
      expect(data.organizationId).toBe('org_1');
      expect(data.sentById).toBe('master_admin_1');
    });

    it('should store null recipientName when user has no name', async () => {
      await POST(buildPostRequest(validPayload));
      const secondCreate = (prisma.adminEmail.create as any).mock.calls[1][0].data;
      expect(secondCreate.recipientName).toBeNull();
      expect(secondCreate.recipientEmail).toBe('jane@acme.com');
    });

    it('should store templateVars when provided', async () => {
      await POST(buildPostRequest({
        ...validPayload,
        templateType: 'trial_expiring',
        templateVars: { daysLeft: 3 },
      }));
      const data = (prisma.adminEmail.create as any).mock.calls[0][0].data;
      expect(data.templateVars).toEqual({ daysLeft: 3 });
    });
  });
});
