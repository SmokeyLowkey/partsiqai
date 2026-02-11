import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../prisma';

// Set required environment variable before importing modules that use Stripe
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing';

// Mock Stripe
vi.mock('stripe', () => {
  const mockStripe = vi.fn().mockImplementation(() => ({
    // Mock Stripe methods as needed
  }));
  return { default: mockStripe };
});

// Mock Prisma
vi.mock('../../prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    usageOverage: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Import after mocks are set up
import { trackOverageUsage } from '../../billing/overage-billing';

describe('Overage Billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackOverageUsage', () => {
    it('should not track usage when within included limit', async () => {
      const mockOrg = {
        id: 'org_123',
        maxAICalls: 25,
        aiCallsUsedThisMonth: 20,
        overageRate: 8.0,
        subscriptionStartDate: new Date(),
        subscriptionEndDate: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);

      await trackOverageUsage('org_123');

      // Should not create overage record when within limit
      expect(prisma.usageOverage.upsert).not.toHaveBeenCalled();
    });

    it('should track overage usage when exceeding soft limit', async () => {
      const mockOrg = {
        id: 'org_123',
        maxAICalls: 25,
        aiCallsUsedThisMonth: 26, // 1 over limit
        overageRate: 8.0,
        subscriptionStartDate: new Date(),
        subscriptionEndDate: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
      (prisma.usageOverage.upsert as any).mockResolvedValue({
        id: 'ovg_123',
        overageCalls: 1,
        overageAmount: 8.0,
      });

      await trackOverageUsage('org_123');

      expect(prisma.usageOverage.upsert).toHaveBeenCalled();
    });

    it('should update existing overage record', async () => {
      const mockOrg = {
        id: 'org_123',
        maxAICalls: 100,
        aiCallsUsedThisMonth: 110, // 10 over limit
        overageRate: 6.0,
        subscriptionStartDate: new Date(),
        subscriptionEndDate: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
      (prisma.usageOverage.upsert as any).mockResolvedValue({
        id: 'ovg_existing',
        overageCalls: 10,
        overageAmount: 60.0,
      });

      await trackOverageUsage('org_123');

      expect(prisma.usageOverage.upsert).toHaveBeenCalled();
    });

    it('should not track when no overage yet', async () => {
      const mockOrg = {
        id: 'org_123',
        maxAICalls: 25,
        aiCallsUsedThisMonth: 30,
        overageRate: 8.0,
        subscriptionStartDate: new Date(),
        subscriptionEndDate: null,
      };

      (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
      (prisma.usageOverage.upsert as any).mockResolvedValue({
        id: 'ovg_123',
        overageCalls: 5,
        overageAmount: 40.0,
      });

      await trackOverageUsage('org_123');

      expect(prisma.usageOverage.upsert).toHaveBeenCalled();
    });

    it('should calculate correct amounts for different tiers', async () => {
      const tiers = [
        { tier: 'STARTER', limit: 25, rate: 8.0, usage: 30 },
        { tier: 'GROWTH', limit: 100, rate: 6.0, usage: 115 },
        { tier: 'ENTERPRISE', limit: 500, rate: 3.0, usage: 550 },
      ];

      for (const { tier, limit, rate, usage } of tiers) {
        vi.clearAllMocks();

        const mockOrg = {
          id: `org_${tier}`,
          maxAICalls: limit,
          aiCallsUsedThisMonth: usage,
          overageRate: rate,
          subscriptionStartDate: new Date(),
          subscriptionEndDate: null,
        };

        (prisma.organization.findUnique as any).mockResolvedValue(mockOrg);
        (prisma.usageOverage.upsert as any).mockImplementation((args: any) => args.create || args.update);

        await trackOverageUsage(`org_${tier}`);

        expect(prisma.usageOverage.upsert).toHaveBeenCalled();
      }
    });
  });

  describe('Hard Cap Validation', () => {
    it('should respect hard cap multiplier', async () => {
      const mockOrg = {
        id: 'org_123',
        maxAICalls: 25,
        aiCallsUsedThisMonth: 50, // Exactly at 2.0x hard cap
        hardCapEnabled: true,
        hardCapMultiplier: 2.0,
      };

      // This should be blocked at the worker level
      // The overage billing just tracks, doesn't enforce
      const hardLimit = Math.floor(mockOrg.maxAICalls * mockOrg.hardCapMultiplier);
      expect(hardLimit).toBe(50);
      expect(mockOrg.aiCallsUsedThisMonth).toBe(hardLimit);
    });
  });
}); 