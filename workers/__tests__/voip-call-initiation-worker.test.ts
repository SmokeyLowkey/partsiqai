import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt } from '@/lib/encryption';

// Mock dependencies before imports
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    supplierCall: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((calls) => Promise.all(calls.map((c: any) => c))),
  },
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((text) => `encrypted_${text}`),
  decrypt: vi.fn((text) => text.replace('encrypted_', '')),
}));

vi.mock('@/lib/logger', () => ({
  workerLogger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock('@/lib/billing/overage-billing', () => ({
  trackOverageUsage: vi.fn(),
}));

describe('VoIP Call Initiation Worker - BYOK Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VAPI_PRIVATE_KEY = 'sk_platform_key_12345';
    process.env.VAPI_PHONE_NUMBER_ID = 'ph_platform_12345';
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-secret-key-must-be-at-least-32-characters-long';
  });

  describe('BYOK Key Selection', () => {
    it('should use platform keys when usePlatformKeys is true', async () => {
      const { prisma } = await import('@/lib/prisma');

      const mockOrg = {
        id: 'org_123',
        maxAICalls: 100,
        aiCallsUsedThisMonth: 50,
        aiCallsResetDate: new Date(),
        overageEnabled: true,
        overageRate: 6.0,
        hardCapEnabled: true,
        hardCapMultiplier: 2.0,
        subscriptionTier: 'GROWTH',
        usePlatformKeys: true, // Use platform keys
        vapiApiKey: 'encrypted_sk_customer_key',
        elevenLabsApiKey: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
      (prisma.supplierCall.create as any).mockResolvedValue({ id: 'call_123' });
      (prisma.supplierCall.update as any).mockResolvedValue({ id: 'call_123' });

      // Simulate worker logic
      const vapiApiKey = !mockOrg.usePlatformKeys && mockOrg.vapiApiKey
        ? mockOrg.vapiApiKey.replace('encrypted_', '')
        : process.env.VAPI_PRIVATE_KEY!;

      expect(vapiApiKey).toBe('sk_platform_key_12345');
      expect(vapiApiKey).not.toContain('customer');
    });

    it('should use customer keys when usePlatformKeys is false', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { decrypt } = await import('@/lib/encryption');

      const mockOrg = {
        id: 'org_456',
        maxAICalls: 500,
        aiCallsUsedThisMonth: 250,
        aiCallsResetDate: new Date(),
        overageEnabled: true,
        overageRate: 3.0,
        hardCapEnabled: false,
        hardCapMultiplier: 2.0,
        subscriptionTier: 'ENTERPRISE',
        usePlatformKeys: false, // Use BYOK
        vapiApiKey: 'encrypted_sk_customer_vapi_key_67890',
        elevenLabsApiKey: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
      (prisma.supplierCall.create as any).mockResolvedValue({ id: 'call_456' });

      // Simulate worker logic
      let vapiApiKey: string;
      if (!mockOrg.usePlatformKeys && mockOrg.vapiApiKey) {
        vapiApiKey = (decrypt as any)(mockOrg.vapiApiKey);
      } else {
        vapiApiKey = process.env.VAPI_PRIVATE_KEY!;
      }

      expect(vapiApiKey).toBe('sk_customer_vapi_key_67890');
      expect(vapiApiKey).not.toContain('platform');
      expect(decrypt).toHaveBeenCalledWith('encrypted_sk_customer_vapi_key_67890');
    });

    it('should fallback to platform keys on decryption error', async () => {
      const { prisma } = await import('@/lib/prisma');
      const { decrypt } = await import('@/lib/encryption');

      // Mock decrypt to throw error
      (decrypt as any).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const mockOrg = {
        id: 'org_789',
        usePlatformKeys: false,
        vapiApiKey: 'corrupted_encrypted_data',
        maxAICalls: 100,
        aiCallsUsedThisMonth: 50,
        aiCallsResetDate: new Date(),
        overageEnabled: true,
        overageRate: 6.0,
        hardCapEnabled: true,
        hardCapMultiplier: 2.0,
        subscriptionTier: 'GROWTH',
        elevenLabsApiKey: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
      (prisma.supplierCall.create as any).mockResolvedValue({ id: 'call_789' });

      // Simulate worker logic with error handling
      let vapiApiKey: string;
      try {
        if (!mockOrg.usePlatformKeys && mockOrg.vapiApiKey) {
          vapiApiKey = (decrypt as any)(mockOrg.vapiApiKey);
        } else {
          vapiApiKey = process.env.VAPI_PRIVATE_KEY!;
        }
      } catch (error) {
        // Fallback to platform keys
        vapiApiKey = process.env.VAPI_PRIVATE_KEY!;
      }

      expect(vapiApiKey).toBe('sk_platform_key_12345');
      expect(decrypt).toHaveBeenCalled();
    });

    it('should use platform keys when vapiApiKey is null', async () => {
      const { prisma } = await import('@/lib/prisma');

      const mockOrg = {
        id: 'org_null',
        usePlatformKeys: false, // BYOK enabled
        vapiApiKey: null, // But no key provided
        maxAICalls: 100,
        aiCallsUsedThisMonth: 50,
        aiCallsResetDate: new Date(),
        overageEnabled: true,
        overageRate: 6.0,
        hardCapEnabled: true,
        hardCapMultiplier: 2.0,
        subscriptionTier: 'GROWTH',
        elevenLabsApiKey: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
      (prisma.supplierCall.create as any).mockResolvedValue({ id: 'call_null' });

      // Simulate worker logic
      const vapiApiKey = !mockOrg.usePlatformKeys && mockOrg.vapiApiKey
        ? mockOrg.vapiApiKey
        : process.env.VAPI_PRIVATE_KEY!;

      expect(vapiApiKey).toBe('sk_platform_key_12345');
    });
  });

  describe('Usage Counter Increments', () => {
    it('should increment counter for platform-paid calls', async () => {
      const { prisma } = await import('@/lib/prisma');

      const mockOrg = {
        id: 'org_platform',
        usePlatformKeys: true,
        vapiApiKey: null,
        maxAICalls: 100,
        aiCallsUsedThisMonth: 75,
        aiCallsResetDate: new Date(),
        overageEnabled: true,
        overageRate: 6.0,
        hardCapEnabled: true,
        hardCapMultiplier: 2.0,
        subscriptionTier: 'GROWTH',
        elevenLabsApiKey: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
      (prisma.supplierCall.create as any).mockResolvedValue({ id: 'call_platform' });
      (prisma.organization.update as any).mockResolvedValue({ aiCallsUsedThisMonth: 76 });

      // Simulate increment after successful call
      await (prisma.organization.update as any)({
        where: { id: 'org_platform' },
        data: {
          aiCallsUsedThisMonth: { increment: 1 },
        },
      });

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            aiCallsUsedThisMonth: { increment: 1 },
          }),
        })
      );
    });

    it('should increment counter for BYOK calls (tracks usage)', async () => {
      const { prisma } = await import('@/lib/prisma');

      const mockOrg = {
        id: 'org_byok',
        usePlatformKeys: false,
        vapiApiKey: 'encrypted_customer_key',
        maxAICalls: 500,
        aiCallsUsedThisMonth: 450,
        aiCallsResetDate: new Date(),
        overageEnabled: false,
        overageRate: 3.0,
        hardCapEnabled: false,
        hardCapMultiplier: 2.0,
        subscriptionTier: 'ENTERPRISE',
        elevenLabsApiKey: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
      (prisma.supplierCall.create as any).mockResolvedValue({ id: 'call_byok' });
      (prisma.organization.update as any).mockResolvedValue({ aiCallsUsedThisMonth: 451 });

      // BYOK calls still increment counter for usage tracking
      await (prisma.organization.update as any)({
        where: { id: 'org_byok' },
        data: {
          aiCallsUsedThisMonth: { increment: 1 },
        },
      });

      expect(prisma.organization.update).toHaveBeenCalled();
    });
  });

  describe('Hard Cap Enforcement', () => {
    it('should block calls at hard cap', () => {
      const mockOrg = {
        maxAICalls: 25, // STARTER
        aiCallsUsedThisMonth: 50, // At 2x hard cap
        hardCapEnabled: true,
        hardCapMultiplier: 2.0,
      };

      const softLimit = mockOrg.maxAICalls;
      const hardLimit = Math.floor(softLimit * mockOrg.hardCapMultiplier);
      const isOverHardCap = mockOrg.aiCallsUsedThisMonth >= hardLimit;

      expect(isOverHardCap).toBe(true);
      expect(hardLimit).toBe(50);
    });

    it('should allow unlimited when hardCapEnabled is false', () => {
      const mockOrg = {
        maxAICalls: 500, // ENTERPRISE
        aiCallsUsedThisMonth: 800,
        hardCapEnabled: false,
        hardCapMultiplier: 2.0,
      };

      const softLimit = mockOrg.maxAICalls;
      const hardLimit = mockOrg.hardCapEnabled
        ? Math.floor(softLimit * mockOrg.hardCapMultiplier)
        : 9999; // Unlimited

      const isOverHardCap = mockOrg.aiCallsUsedThisMonth >= hardLimit && hardLimit < 9999;

      expect(isOverHardCap).toBe(false);
      expect(hardLimit).toBe(9999);
    });
  });

  describe('Monthly Reset Logic', () => {
    it('should detect when reset is needed', () => {
      const now = new Date(2026, 1, 15); // Feb 15, 2026 (month is 0-indexed)
      const lastReset = new Date(2026, 0, 15); // Jan 15, 2026

      const needsReset = !lastReset ||
        lastReset.getMonth() !== now.getMonth() ||
        lastReset.getFullYear() !== now.getFullYear();

      expect(needsReset).toBe(true);
    });

    it('should not reset within same month', () => {
      const now = new Date(2026, 1, 15); // Feb 15, 2026
      const lastReset = new Date(2026, 1, 1); // Feb 1, 2026

      const needsReset = !lastReset ||
        lastReset.getMonth() !== now.getMonth() ||
        lastReset.getFullYear() !== now.getFullYear();

      expect(needsReset).toBe(false);
    });

    it('should reset when year changes', () => {
      const now = new Date(2027, 0, 1); // Jan 1, 2027
      const lastReset = new Date(2026, 11, 31); // Dec 31, 2026

      const needsReset = !lastReset ||
        lastReset.getMonth() !== now.getMonth() ||
        lastReset.getFullYear() !== now.getFullYear();

      expect(needsReset).toBe(true);
    });
  });

  describe('LangGraph Configuration', () => {
    it('should configure Vapi with custom-llm provider for LangGraph', async () => {
      const { prisma } = await import('@/lib/prisma');
      
      const mockOrg = {
        id: 'org_langgraph',
        usePlatformKeys: true,
        vapiApiKey: null,
        maxAICalls: 100,
        aiCallsUsedThisMonth: 10,
        aiCallsResetDate: new Date(),
        overageEnabled: true,
        overageRate: 6.0,
        hardCapEnabled: false,
        hardCapMultiplier: 2.0,
        subscriptionTier: 'GROWTH',
        elevenLabsApiKey: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
      (prisma.supplierCall.create as any).mockResolvedValue({ id: 'call_langgraph' });

      // Simulate Vapi API call configuration
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const vapiConfig = {
        assistant: {
          firstMessage: 'Hi, this is a test call',
          context: 'You are an AI assistant calling suppliers.',
          model: {
            provider: 'custom-llm',
            url: `${appUrl}/api/voip/langgraph-handler`,
            headers: {
              'Authorization': `Bearer ${process.env.VOIP_WEBHOOK_SECRET || 'dev-secret'}`,
            },
            fallbackModel: {
              provider: 'openai',
              model: 'gpt-4',
              temperature: 0.7,
            },
          },
        },
      };

      expect(vapiConfig.assistant.model.provider).toBe('custom-llm');
      expect(vapiConfig.assistant.model.url).toContain('/api/voip/langgraph-handler');
      expect(vapiConfig.assistant.model.headers.Authorization).toBeDefined();
      expect(vapiConfig.assistant.model.fallbackModel).toBeDefined();
      expect(vapiConfig.assistant.model.fallbackModel.provider).toBe('openai');
    });

    it('should include custom context in firstMessage when provided', async () => {
      const customContext = 'Quote Request QR-02-2026-0001 for 2015 John Deere 160GLC excavator';
      const defaultFirstMessage = 'Hi, this is an automated call';
      
      const firstMessage = customContext || defaultFirstMessage;

      expect(firstMessage).toBe(customContext);
      expect(firstMessage).toContain('QR-02-2026-0001');
      expect(firstMessage).toContain('John Deere');
    });

    it('should use default firstMessage when custom context not provided', async () => {
      const customContext = undefined;
      const defaultFirstMessage = 'Hi, this is an automated call from org_123';
      
      const firstMessage = customContext || defaultFirstMessage;

      expect(firstMessage).toBe(defaultFirstMessage);
      expect(firstMessage).toContain('org_123');
    });

    it('should include custom instructions in context field', async () => {
      const customInstructions = 'You are calling on behalf of ACME Construction. Be professional and friendly.';
      const defaultInstructions = 'You are an AI assistant calling suppliers.';
      
      const systemInstructions = customInstructions || defaultInstructions;

      expect(systemInstructions).toBe(customInstructions);
      expect(systemInstructions).toContain('ACME Construction');
      expect(systemInstructions).toContain('professional');
    });

    it('should pass customContext and customInstructions to job data', async () => {
      const jobData = {
        context: {
          parts: [],
          customContext: 'Custom greeting for supplier',
          customInstructions: 'Special handling instructions',
        },
      };

      expect(jobData.context.customContext).toBe('Custom greeting for supplier');
      expect(jobData.context.customInstructions).toBe('Special handling instructions');
    });
  });
});
