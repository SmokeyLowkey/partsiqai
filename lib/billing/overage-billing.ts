/**
 * Overage Billing Module
 * 
 * Handles overage charges for AI calls that exceed plan limits
 */

import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { addMonths } from 'date-fns';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

/**
 * Track overage usage for an organization
 * Called after each AI call when usage exceeds the plan limit
 */
export async function trackOverageUsage(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      maxAICalls: true,
      aiCallsUsedThisMonth: true,
      overageRate: true,
      subscriptionStartDate: true,
      subscriptionEndDate: true,
    },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  const overageCalls = Math.max(0, org.aiCallsUsedThisMonth - org.maxAICalls);
  
  if (overageCalls === 0) {
    return; // No overage yet
  }

  const overageAmount = overageCalls * Number(org.overageRate);

  // Determine billing period (use subscription dates or default to monthly)
  const billingPeriodStart = org.subscriptionStartDate || new Date();
  const billingPeriodEnd = org.subscriptionEndDate || addMonths(billingPeriodStart, 1);

  // Upsert overage record for current billing period
  await prisma.usageOverage.upsert({
    where: {
      organizationId_billingPeriodStart: {
        organizationId,
        billingPeriodStart,
      },
    },
    create: {
      organizationId,
      billingPeriodStart,
      billingPeriodEnd,
      includedCalls: org.maxAICalls,
      totalCalls: org.aiCallsUsedThisMonth,
      overageCalls,
      overageRate: org.overageRate,
      overageAmount,
      status: 'PENDING',
    },
    update: {
      totalCalls: org.aiCallsUsedThisMonth,
      overageCalls,
      overageAmount,
    },
  });
}

/**
 * Add overage charges to a Stripe invoice
 * Called via webhook when Stripe creates an invoice (invoice.created event)
 */
export async function addOverageToInvoice(
  stripeInvoiceId: string,
  organizationId: string
): Promise<void> {
  try {
    // Get pending overage for this billing period
    const overage = await prisma.usageOverage.findFirst({
      where: {
        organizationId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!overage || overage.overageCalls === 0) {
      console.log('No overage charges for organization:', organizationId);
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeCustomerId: true, subscriptionTier: true },
    });

    if (!org?.stripeCustomerId) {
      throw new Error('No Stripe customer ID');
    }

    // Create invoice item for overage
    const invoiceItem = await stripe.invoiceItems.create({
      customer: org.stripeCustomerId,
      invoice: stripeInvoiceId,
      amount: Math.round(Number(overage.overageAmount) * 100), // Convert to cents
      currency: 'usd',
      description: `AI Call Overage - ${overage.overageCalls} calls @ $${overage.overageRate}/call`,
      metadata: {
        organizationId,
        usageOverageId: overage.id,
        tier: org.subscriptionTier,
        includedCalls: overage.includedCalls.toString(),
        totalCalls: overage.totalCalls.toString(),
        overageCalls: overage.overageCalls.toString(),
      },
    });

    // Update overage record
    await prisma.usageOverage.update({
      where: { id: overage.id },
      data: {
        stripeInvoiceId,
        stripeInvoiceItemId: invoiceItem.id,
        status: 'INVOICED',
      },
    });

    console.log(`✅ Added overage charge: $${overage.overageAmount} to invoice ${stripeInvoiceId}`);
  } catch (error) {
    console.error('❌ Error adding overage to invoice:', error);
    throw error;
  }
}

/**
 * Mark overage as paid when invoice is successfully paid
 */
export async function markOveragePaid(stripeInvoiceId: string): Promise<void> {
  await prisma.usageOverage.updateMany({
    where: {
      stripeInvoiceId,
      status: 'INVOICED',
    },
    data: {
      status: 'PAID',
      billedAt: new Date(),
    },
  });
  
  console.log(`✅ Marked overage as paid for invoice: ${stripeInvoiceId}`);
}

/**
 * Mark overage as failed when invoice payment fails
 */
export async function markOverageFailed(stripeInvoiceId: string): Promise<void> {
  await prisma.usageOverage.updateMany({
    where: {
      stripeInvoiceId,
      status: 'INVOICED',
    },
    data: {
      status: 'FAILED',
    },
  });
  
  console.log(`⚠️ Marked overage as failed for invoice: ${stripeInvoiceId}`);
}

/**
 * Forgive (waive) overage charges - used for customer service exceptions
 */
export async function forgiveOverage(usageOverageId: string, reason: string): Promise<void> {
  await prisma.usageOverage.update({
    where: { id: usageOverageId },
    data: {
      status: 'FORGIVEN',
    },
  });
  
  // TODO: Log this action in audit log
  console.log(`💚 Forgave overage ${usageOverageId}: ${reason}`);
}

/**
 * Get pending overage amount for an organization
 */
export async function getPendingOverageAmount(organizationId: string): Promise<number> {
  const overage = await prisma.usageOverage.findFirst({
    where: {
      organizationId,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });

  return overage ? Number(overage.overageAmount) : 0;
}

/**
 * Get overage pricing rates by tier
 */
export const OVERAGE_PRICING = {
  STARTER: {
    basePrice: 199,
    includedCalls: 25,
    overageRate: 8.0,
    hardCapMultiplier: 2.0,
  },
  GROWTH: {
    basePrice: 449,
    includedCalls: 100,
    overageRate: 6.0,
    hardCapMultiplier: 2.0,
  },
  ENTERPRISE: {
    basePrice: 1299,
    includedCalls: 500,
    overageRate: 3.0,
    hardCapMultiplier: null, // No hard cap
  },
} as const;

/**
 * Get overage rate for a specific tier
 */
export function getOverageRateForTier(tier: string): number {
  const rates: Record<string, number> = {
    STARTER: 8.0,
    GROWTH: 6.0,
    ENTERPRISE: 3.0,
  };  return rates[tier] || 8.0;
}
