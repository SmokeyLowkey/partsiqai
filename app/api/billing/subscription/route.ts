import { NextResponse } from "next/server"
import { getServerSession, isAdminRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe, getPriceIdForTier, getTierForPriceId, mapStripeStatusToAppStatus } from "@/lib/stripe"

// GET /api/billing/subscription - Get current subscription details
export async function GET() {
  try {
    const session = await getServerSession()
    const currentUser = session?.user

    if (!currentUser || !isAdminRole(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      )
    }

    const organization = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
      select: {
        id: true,
        name: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        trialEndsAt: true,
        cancelAtPeriodEnd: true,
        billingEmail: true,
        maxUsers: true,
        maxVehicles: true,
      },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    // Fetch live subscription data from Stripe if exists
    let stripeSubscription: any = null
    if (organization.stripeSubscriptionId) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(
          organization.stripeSubscriptionId,
          { expand: ["default_payment_method", "latest_invoice"] }
        )
      } catch (err) {
        console.error("Error fetching Stripe subscription:", err)
      }
    }

    // Fetch payment methods if customer exists
    let paymentMethods: any[] = []
    if (organization.stripeCustomerId) {
      try {
        const methods = await stripe.paymentMethods.list({
          customer: organization.stripeCustomerId,
          type: "card",
        })
        paymentMethods = methods.data.map((pm) => ({
          id: pm.id,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year,
          isDefault: stripeSubscription?.default_payment_method === pm.id,
        }))
      } catch (err) {
        console.error("Error fetching payment methods:", err)
      }
    }

    return NextResponse.json({
      organization,
      stripeSubscription: stripeSubscription
        ? {
            id: stripeSubscription.id,
            status: stripeSubscription.status,
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            trialEnd: stripeSubscription.trial_end
              ? new Date(stripeSubscription.trial_end * 1000)
              : null,
          }
        : null,
      paymentMethods,
    })
  } catch (error) {
    console.error("Error fetching subscription:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    )
  }
}

// POST /api/billing/subscription - Create or update subscription
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
    const { tier } = body

    if (!tier || !["BASIC", "PROFESSIONAL", "ENTERPRISE"].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid subscription tier" },
        { status: 400 }
      )
    }

    const organization = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    const priceId = getPriceIdForTier(tier as "BASIC" | "PROFESSIONAL" | "ENTERPRISE")

    // If organization already has a subscription, update it
    if (organization.stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(
        organization.stripeSubscriptionId
      )

      const updatedSubscription = await stripe.subscriptions.update(
        organization.stripeSubscriptionId,
        {
          items: [
            {
              id: subscription.items.data[0].id,
              price: priceId,
            },
          ],
          proration_behavior: "create_prorations",
        }
      )

      // Update organization
      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          subscriptionTier: tier,
          stripePriceId: priceId,
          subscriptionStatus: mapStripeStatusToAppStatus(updatedSubscription.status),
        },
      })

      // Log activity
      await prisma.activityLog.create({
        data: {
          type: "SUBSCRIPTION_UPDATED",
          title: "Subscription Updated",
          description: `Subscription changed to ${tier} tier`,
          organizationId: organization.id,
          userId: currentUser.id,
          metadata: { tier, priceId },
        },
      })

      return NextResponse.json({
        success: true,
        subscription: updatedSubscription,
      })
    }

    // No existing subscription - this shouldn't happen from this endpoint
    // They should use checkout-session to create a new subscription
    return NextResponse.json(
      { error: "No existing subscription. Use checkout to create one." },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error updating subscription:", error)
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    )
  }
}
