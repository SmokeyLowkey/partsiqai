import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe, getPriceIdForTier } from "@/lib/stripe"
import { withHardening } from "@/lib/api/with-hardening"
import { auditAdminAction } from "@/lib/audit-admin"

// POST /api/billing/checkout-session - Create Stripe Checkout session
export const POST = withHardening(
  {
    roles: ["ADMIN", "MASTER_ADMIN"],
    rateLimit: { limit: 20, windowSeconds: 60, prefix: "billing-checkout", keyBy: "user" },
  },
  async (request: Request) => {
  try {
    const session = await getServerSession()
    const currentUser = session!.user

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

    if (!priceId) {
      console.error(`Stripe price ID not found for tier: ${tier}`, {
        STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER ? 'SET' : 'MISSING',
        STRIPE_PRICE_GROWTH: process.env.STRIPE_PRICE_GROWTH ? 'SET' : 'MISSING',
        STRIPE_PRICE_ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE ? 'SET' : 'MISSING',
      })
      return NextResponse.json(
        { error: `Stripe price ID not configured for ${tier} tier. Please set STRIPE_PRICE_${tier} environment variable.` },
        { status: 500 }
      )
    }

    // Validate that it's a price ID, not a product ID
    if (priceId.startsWith('prod_')) {
      console.error(`Invalid Stripe ID for tier ${tier}: ${priceId}. This is a Product ID, not a Price ID.`)
      return NextResponse.json(
        { error: `Invalid Stripe configuration: STRIPE_PRICE_${tier} must be a Price ID (starts with 'price_'), not a Product ID (starts with 'prod_'). Please check your Stripe dashboard for the correct Price ID.` },
        { status: 500 }
      )
    }

    if (!priceId.startsWith('price_')) {
      console.error(`Invalid Stripe ID for tier ${tier}: ${priceId}. Price IDs must start with 'price_'.`)
      return NextResponse.json(
        { error: `Invalid Stripe configuration: STRIPE_PRICE_${tier} must start with 'price_'. Current value: ${priceId}` },
        { status: 500 }
      )
    }

    console.log(`Creating checkout session for tier: ${tier}, priceId: ${priceId}`)

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
      success_url: (successUrl && successUrl.startsWith(baseUrl)) ? successUrl : `${baseUrl}/customer/billing?success=true`,
      cancel_url: (cancelUrl && cancelUrl.startsWith(baseUrl)) ? cancelUrl : `${baseUrl}/customer/billing?canceled=true`,
      metadata: {
        organizationId: organization.id,
        tier,
      },
    })

    await auditAdminAction({
      req: request,
      session: { user: { id: currentUser.id, organizationId: currentUser.organizationId } },
      eventType: "BILLING_ACTION",
      description: `${currentUser.email} created Stripe checkout session for tier=${tier}`,
      metadata: {
        action: "checkout_session_created",
        tier,
        stripeSessionId: checkoutSession.id,
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
);
