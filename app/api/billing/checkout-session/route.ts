import { NextResponse } from "next/server"
import { getServerSession, isAdminRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe, getPriceIdForTier } from "@/lib/stripe"

// POST /api/billing/checkout-session - Create Stripe Checkout session
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
    const { tier, successUrl, cancelUrl } = body

    if (!tier || !["STARTER", "GROWTH", "ENTERPRISE"].includes(tier)) {
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

    const priceId = getPriceIdForTier(tier as "STARTER" | "GROWTH" | "ENTERPRISE")

    // Create or get Stripe customer
    let stripeCustomerId = organization.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: organization.billingEmail || undefined,
        name: organization.name,
        metadata: {
          organizationId: organization.id,
          organizationSlug: organization.slug,
        },
      })
      stripeCustomerId = customer.id

      // Save customer ID to organization
      await prisma.organization.update({
        where: { id: organization.id },
        data: { stripeCustomerId },
      })
    }

    // Determine base URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          organizationId: organization.id,
          tier,
        },
      },
      success_url: successUrl || `${baseUrl}/customer/billing?success=true`,
      cancel_url: cancelUrl || `${baseUrl}/customer/billing?canceled=true`,
      metadata: {
        organizationId: organization.id,
        tier,
      },
    })

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    })
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
