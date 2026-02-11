import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OVERAGE_PRICING } from '@/lib/billing/overage-billing';

/**
 * GET /api/billing/overage-settings
 * Get overage billing settings for the user's organization
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        organizationId: true,
        role: true,
        organization: {
          select: {
            id: true,
            subscriptionTier: true,
            overageEnabled: true,
            overageRate: true,
            hardCapEnabled: true,
            hardCapMultiplier: true,
            maxAICalls: true,
            aiCallsUsedThisMonth: true,
            aiCallsResetDate: true,
          },
        },
      },
    });

    if (!user?.organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get pending overage amount
    const pendingOverage = await prisma.usageOverage.findFirst({
      where: {
        organizationId: user.organization.id,
        status: 'PENDING',
      },
      orderBy: {
        billingPeriodStart: 'desc',
      },
    });

    return NextResponse.json({
      organizationId: user.organization.id,
      subscriptionTier: user.organization.subscriptionTier,
      overageEnabled: user.organization.overageEnabled,
      overageRate: user.organization.overageRate,
      hardCapEnabled: user.organization.hardCapEnabled,
      hardCapMultiplier: user.organization.hardCapMultiplier,
      maxAICalls: user.organization.maxAICalls,
      aiCallsUsedThisMonth: user.organization.aiCallsUsedThisMonth,
      aiCallsResetDate: user.organization.aiCallsResetDate,
      pendingOverageAmount: pendingOverage?.overageAmount || 0,
      pendingOverageCalls: pendingOverage?.overageCalls || 0,
      defaultOverageRate: OVERAGE_PRICING[user.organization.subscriptionTier || 'GROWTH'],
    });
  } catch (error) {
    console.error('Error fetching overage settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overage settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/billing/overage-settings
 * Update overage billing settings (admin only)
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        organizationId: true,
        role: true,
        organization: {
          select: {
            id: true,
            subscriptionTier: true,
          },
        },
      },
    });

    if (!user?.organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Only admins can update billing settings
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can update billing settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { overageEnabled, overageRate, hardCapEnabled, hardCapMultiplier } = body;

    // Validate inputs
    if (typeof overageEnabled !== 'undefined' && typeof overageEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'overageEnabled must be a boolean' },
        { status: 400 }
      );
    }

    if (typeof overageRate !== 'undefined') {
      if (typeof overageRate !== 'number' || overageRate < 0 || overageRate > 100) {
        return NextResponse.json(
          { error: 'overageRate must be a number between 0 and 100' },
          { status: 400 }
        );
      }
    }

    if (typeof hardCapEnabled !== 'undefined' && typeof hardCapEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'hardCapEnabled must be a boolean' },
        { status: 400 }
      );
    }

    if (typeof hardCapMultiplier !== 'undefined') {
      if (
        typeof hardCapMultiplier !== 'number' ||
        hardCapMultiplier < 1.1 ||
        hardCapMultiplier > 10
      ) {
        return NextResponse.json(
          { error: 'hardCapMultiplier must be a number between 1.1 and 10' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: {
      overageEnabled?: boolean;
      overageRate?: number;
      hardCapEnabled?: boolean;
      hardCapMultiplier?: number;
    } = {};

    if (typeof overageEnabled !== 'undefined') {
      updateData.overageEnabled = overageEnabled;
    }

    if (typeof overageRate !== 'undefined') {
      updateData.overageRate = overageRate;
    }

    if (typeof hardCapEnabled !== 'undefined') {
      updateData.hardCapEnabled = hardCapEnabled;
    }

    if (typeof hardCapMultiplier !== 'undefined') {
      updateData.hardCapMultiplier = hardCapMultiplier;
    }

    // Update organization
    const updated = await prisma.organization.update({
      where: { id: user.organization.id },
      data: updateData,
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'SUBSCRIPTION_UPDATED',
        title: 'Overage Billing Settings Updated',
        description: `Updated overage billing settings: ${JSON.stringify(updateData)}`,
        organizationId: user.organization.id,
        metadata: updateData,
      },
    });

    return NextResponse.json({
      success: true,
      overageEnabled: updated.overageEnabled,
      overageRate: updated.overageRate,
      hardCapEnabled: updated.hardCapEnabled,
      hardCapMultiplier: updated.hardCapMultiplier,
    });
  } catch (error) {
    console.error('Error updating overage settings:', error);
    return NextResponse.json(
      { error: 'Failed to update overage settings' },
      { status: 500 }
    );
  }
}
