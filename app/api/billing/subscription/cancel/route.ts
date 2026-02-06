import { NextResponse } from "next/server"
import { getServerSession, isAdminRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

// POST /api/billing/subscription/cancel - Cancel subscription at period end
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    const currentUser = session?.user

    if (!currentUser || !isAdminRole(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { immediate = false } = body

    const organization = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    if (!organization.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription to cancel" },
        { status: 400 }
      )
    }

    let cancelledSubscription: any

    if (immediate) {
      // Cancel immediately
      cancelledSubscription = await stripe.subscriptions.cancel(
        organization.stripeSubscriptionId
      )

      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          subscriptionStatus: "CANCELLED",
          cancelAtPeriodEnd: false,
        },
      })
    } else {
      // Cancel at period end
      cancelledSubscription = await stripe.subscriptions.update(
        organization.stripeSubscriptionId,
        { cancel_at_period_end: true }
      )

      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          cancelAtPeriodEnd: true,
        },
      })
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: "SUBSCRIPTION_CANCELLED",
        title: "Subscription Cancelled",
        description: immediate
          ? "Subscription cancelled immediately"
          : "Subscription scheduled for cancellation at period end",
        organizationId: organization.id,
        userId: currentUser.id,
        metadata: { immediate },
      },
    })

    return NextResponse.json({
      success: true,
      subscription: {
        id: cancelledSubscription.id,
        status: cancelledSubscription.status,
        cancelAtPeriodEnd: cancelledSubscription.cancel_at_period_end,
        currentPeriodEnd: cancelledSubscription.current_period_end
          ? new Date(cancelledSubscription.current_period_end * 1000)
          : null,
      },
    })
  } catch (error) {
    console.error("Error cancelling subscription:", error)
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    )
  }
}
