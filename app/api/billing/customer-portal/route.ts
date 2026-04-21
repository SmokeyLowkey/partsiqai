import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"
import { withHardening } from "@/lib/api/with-hardening"

// POST /api/billing/customer-portal - Create Stripe Customer Portal session
export const POST = withHardening(
  {
    roles: ["ADMIN", "MASTER_ADMIN"],
    rateLimit: { limit: 20, windowSeconds: 60, prefix: "billing-portal", keyBy: "user" },
  },
  async (request: Request) => {
  try {
    const session = await getServerSession()
    const currentUser = session!.user

    const body = await request.json().catch(() => ({}))
    const { returnUrl } = body

    const organization = await prisma.organization.findUnique({
      where: { id: currentUser.organizationId },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    if (!organization.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Please subscribe to a plan first." },
        { status: 400 }
      )
    }

    // Determine base URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: (returnUrl && returnUrl.startsWith(baseUrl)) ? returnUrl : `${baseUrl}/customer/billing`,
    })

    return NextResponse.json({
      url: portalSession.url,
    })
  } catch (error) {
    console.error("Error creating customer portal session:", error)
    return NextResponse.json(
      { error: "Failed to create customer portal session" },
      { status: 500 }
    )
  }
  }
);
