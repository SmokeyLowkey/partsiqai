import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// ---- Mocks ----

const { mockResendFetch } = vi.hoisted(() => ({
  mockResendFetch: vi.fn(),
}));

const originalFetch = globalThis.fetch;
vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url && url.includes('api.resend.com')) {
    return mockResendFetch(input, init);
  }
  return originalFetch(input, init);
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminEmail: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    adminEmailReply: {
      create: vi.fn(),
    },
  },
}));

// ---- Imports ----

import { POST } from '../route';
import { prisma } from '@/lib/prisma';

// ---- Helpers ----

const WEBHOOK_SECRET = 'whsec_dGVzdHNlY3JldA=='; // base64 of "testsecret"

function signPayload(payload: string) {
  const msgId = 'msg_test123';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secretBytes = Buffer.from(WEBHOOK_SECRET.replace('whsec_', ''), 'base64');
  const toSign = `${msgId}.${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secretBytes)
    .update(toSign)
    .digest('base64');

  return {
    'svix-id': msgId,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
  };
}

function buildWebhookRequest(body: any, signed = true) {
  const payload = JSON.stringify(body);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (signed) {
    const svixHeaders = signPayload(payload);
    Object.assign(headers, svixHeaders);
  }

  return new NextRequest('http://localhost:3000/api/webhooks/resend', {
    method: 'POST',
    headers,
    body: payload,
  });
}

function mockResendResponse(data: any, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 404,
    json: () => Promise.resolve(data),
  });
}

const mockAdminEmail = {
  id: 'admin_email_1',
  subject: 'Welcome to PartsIQ!',
  recipientEmail: 'user@acme.com',
  senderEmail: 'onboarding@partsiqai.com',
  resendMessageId: 'msg_abc123',
  status: 'sent',
};

// ---- Tests ----

describe('POST /api/webhooks/resend', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.RESEND_API_KEY = 'test_api_key';
  });

  describe('signature verification', () => {
    it('rejects requests with invalid signature', async () => {
      const body = { type: 'email.received', data: {} };
      const req = new NextRequest('http://localhost:3000/api/webhooks/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'svix-id': 'msg_bad',
          'svix-timestamp': '12345',
          'svix-signature': 'v1,invalidsignature',
        },
        body: JSON.stringify(body),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('accepts requests with valid signature', async () => {
      const body = { type: 'email.sent', data: {} };
      const req = buildWebhookRequest(body, true);

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe('email.received', () => {
    it('fetches full email via API and stores reply when matched by In-Reply-To', async () => {
      mockResendFetch.mockReturnValue(mockResendResponse({
        from: 'John Doe <user@acme.com>',
        subject: 'Re: Welcome to PartsIQ!',
        text: 'Thanks for the welcome!',
        html: '<p>Thanks for the welcome!</p>',
        headers: { 'in-reply-to': '<msg_abc123@resend.dev>' },
      }));

      vi.mocked(prisma.adminEmail.findFirst).mockResolvedValue(mockAdminEmail as any);
      vi.mocked(prisma.adminEmailReply.create).mockResolvedValue({ id: 'reply_1' } as any);

      const body = {
        type: 'email.received',
        data: {
          email_id: 'inbound_email_1',
          from: 'John Doe <user@acme.com>',
          subject: 'Re: Welcome to PartsIQ!',
        },
      };

      const res = await POST(buildWebhookRequest(body));
      expect(res.status).toBe(200);

      // Should fetch full email from Resend received emails API
      expect(mockResendFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails/received/inbound_email_1',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test_api_key' }),
        })
      );

      // Should match by In-Reply-To header (cleaned to "msg_abc123")
      expect(prisma.adminEmail.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resendMessageId: 'msg_abc123', status: 'sent' },
        })
      );

      // Should create reply record
      expect(prisma.adminEmailReply.create).toHaveBeenCalledWith({
        data: {
          adminEmailId: 'admin_email_1',
          fromEmail: 'user@acme.com',
          fromName: 'John Doe',
          subject: 'Re: Welcome to PartsIQ!',
          bodyText: 'Thanks for the welcome!',
          bodyHtml: '<p>Thanks for the welcome!</p>',
          resendMessageId: 'inbound_email_1',
        },
      });
    });

    it('falls back to subject+sender matching when no In-Reply-To header', async () => {
      mockResendFetch.mockReturnValue(mockResendResponse({
        from: 'user@acme.com',
        subject: 'Re: Welcome to PartsIQ!',
        text: 'Got it, thanks!',
        html: null,
        headers: {},
      }));

      vi.mocked(prisma.adminEmail.findFirst).mockResolvedValueOnce(mockAdminEmail as any);
      vi.mocked(prisma.adminEmailReply.create).mockResolvedValue({ id: 'reply_2' } as any);

      const body = {
        type: 'email.received',
        data: {
          email_id: 'inbound_email_2',
          from: 'user@acme.com',
          subject: 'Re: Welcome to PartsIQ!',
        },
      };

      const res = await POST(buildWebhookRequest(body));
      expect(res.status).toBe(200);

      // Subject match strips "Re:" prefix
      expect(prisma.adminEmail.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recipientEmail: 'user@acme.com',
            subject: { contains: 'Welcome to PartsIQ!', mode: 'insensitive' },
          }),
        })
      );

      expect(prisma.adminEmailReply.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminEmailId: 'admin_email_1',
          fromEmail: 'user@acme.com',
          fromName: null,
          bodyText: 'Got it, thanks!',
        }),
      });
    });

    it('logs warning when no matching admin email is found', async () => {
      mockResendFetch.mockReturnValue(mockResendResponse({
        from: 'stranger@unknown.com',
        subject: 'Random email',
        text: 'Hello',
        html: null,
        headers: {},
      }));

      vi.mocked(prisma.adminEmail.findFirst).mockResolvedValue(null as any);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const body = {
        type: 'email.received',
        data: {
          email_id: 'inbound_email_3',
          from: 'stranger@unknown.com',
          subject: 'Random email',
        },
      };

      const res = await POST(buildWebhookRequest(body));
      expect(res.status).toBe(200);
      expect(prisma.adminEmailReply.create).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('could not match')
      );

      warnSpy.mockRestore();
    });

    it('handles Resend API failure gracefully and falls back to webhook data', async () => {
      mockResendFetch.mockReturnValue(mockResendResponse(null, false));

      // API failure means fullEmail is null, so inReplyTo is null → strategy 1 skipped
      vi.mocked(prisma.adminEmail.findFirst).mockResolvedValueOnce(mockAdminEmail as any);
      vi.mocked(prisma.adminEmailReply.create).mockResolvedValue({ id: 'reply_3' } as any);

      const body = {
        type: 'email.received',
        data: {
          email_id: 'inbound_email_4',
          from: 'Jane <user@acme.com>',
          subject: 'Re: Welcome to PartsIQ!',
        },
      };

      const res = await POST(buildWebhookRequest(body));
      expect(res.status).toBe(200);

      // Should still create reply using webhook metadata (no body content)
      expect(prisma.adminEmailReply.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromEmail: 'user@acme.com',
          fromName: 'Jane',
          subject: 'Re: Welcome to PartsIQ!',
          bodyText: null,
          bodyHtml: null,
        }),
      });
    });
  });

  describe('email.bounced', () => {
    it('updates admin email status to bounced', async () => {
      vi.mocked(prisma.adminEmail.updateMany).mockResolvedValue({ count: 1 } as any);

      const body = {
        type: 'email.bounced',
        data: { email_id: 'msg_abc123' },
      };

      const res = await POST(buildWebhookRequest(body));
      expect(res.status).toBe(200);

      expect(prisma.adminEmail.updateMany).toHaveBeenCalledWith({
        where: { resendMessageId: 'msg_abc123' },
        data: { status: 'bounced', errorMessage: 'Email bounced' },
      });
    });
  });

  describe('email.complained', () => {
    it('updates admin email status to complained', async () => {
      vi.mocked(prisma.adminEmail.updateMany).mockResolvedValue({ count: 1 } as any);

      const body = {
        type: 'email.complained',
        data: { email_id: 'msg_abc123' },
      };

      const res = await POST(buildWebhookRequest(body));
      expect(res.status).toBe(200);

      expect(prisma.adminEmail.updateMany).toHaveBeenCalledWith({
        where: { resendMessageId: 'msg_abc123' },
        data: { status: 'complained', errorMessage: 'Recipient marked as spam' },
      });
    });
  });

  describe('unhandled events', () => {
    it('returns 200 for unhandled event types', async () => {
      const body = { type: 'email.delivered', data: { email_id: 'msg_xyz' } };
      const res = await POST(buildWebhookRequest(body));
      expect(res.status).toBe(200);

      expect(prisma.adminEmail.findFirst).not.toHaveBeenCalled();
      expect(prisma.adminEmail.updateMany).not.toHaveBeenCalled();
    });
  });
});
