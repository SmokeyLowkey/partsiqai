import { NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { stripe, getTierForPriceId, mapStripeStatusToAppStatus } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"

// Disable body parsing - we need raw body for webhook verification
export const dynamic = "force-dynamic"

// Helper to get organization by Stripe customer ID
async function getOrganizationByCustomerId(customerId: string) {
  return prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
  })
}

// Handle subscription created/updated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionChange(subscription: any) {
  const customerId = subscription.customer as string
  const organization = await getOrganizationByCustomerId(customerId)

  if (!organization) {
    console.error(`No organization found for customer: ${customerId}`)
    return
  }

  const priceId = subscription.items?.data?.[0]?.price?.id
  const tier = priceId ? getTierForPriceId(priceId) : null
  const appStatus = mapStripeStatusToAppStatus(subscription.status)

  // Determine tier limits
  const tierLimits = {
    BASIC: { maxUsers: 10, maxVehicles: 50 },
    PROFESSIONAL: { maxUsers: 50, maxVehicles: 200 },
    ENTERPRISE: { maxUsers: 9999, maxVehicles: 9999 },
  }

  const limits = tier ? tierLimits[tier] : tierLimits.BASIC

  // Safely handle dates - they might be undefined for trial subscriptions
  const startDate = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : null
  const endDate = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionTier: tier || organization.subscriptionTier,
      subscriptionStatus: appStatus,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      maxUsers: limits.maxUsers,
      maxVehicles: limits.maxVehicles,
    },
  })

  // Log activity
  const eventType =
    subscription.status === "active" && !organization.stripeSubscriptionId
      ? "SUBSCRIPTION_CREATED"
      : "SUBSCRIPTION_UPDATED"

  await prisma.activityLog.create({
    data: {
      type: eventType,
      title: eventType === "SUBSCRIPTION_CREATED" ? "Subscription Created" : "Subscription Updated",
      description: `Subscription ${subscription.status} - ${tier || "Unknown"} tier`,
      organizationId: organization.id,
      metadata: {
        subscriptionId: subscription.id,
        status: subscription.status,
        tier,
        priceId,
      },
    },
  })
}

// Handle subscription deleted
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionDeleted(subscription: any) {
  const customerId = subscription.customer as string
  const organization = await getOrganizationByCustomerId(customerId)

  if (!organization) {
    console.error(`No organization found for customer: ${customerId}`)
    return
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionStatus: "CANCELLED",
      cancelAtPeriodEnd: false,
    },
  })

  await prisma.activityLog.create({
    data: {
      type: "SUBSCRIPTION_CANCELLED",
      title: "Subscription Cancelled",
      description: "Subscription has been cancelled",
      organizationId: organization.id,
      metadata: {
        subscriptionId: subscription.id,
      },
    },
  })
}

// Handle invoice paid
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleInvoicePaid(invoice: any) {
  const customerId = invoice.customer as string
  const organization = await getOrganizationByCustomerId(customerId)

  if (!organization) {
    console.error(`No organization found for customer: ${customerId}`)
    return
  }

  // Create or update invoice record
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      organizationId: organization.id,
      stripeInvoiceId: invoice.id,
      number: invoice.number,
      status: "PAID",
      amountDue: (invoice.amount_due || 0) / 100,
      amountPaid: (invoice.amount_paid || 0) / 100,
      currency: invoice.currency || "usd",
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : new Date(),
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : new Date(),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      paidAt: new Date(),
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdfUrl: invoice.invoice_pdf,
    },
    update: {
      status: "PAID",
      amountPaid: (invoice.amount_paid || 0) / 100,
      paidAt: new Date(),
    },
  })

  // Update subscription end date if this is a subscription invoice
  if (invoice.subscription) {
    try {
      const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription as string
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subData = subscription as any
      if (subData.current_period_end) {
        await prisma.organization.update({
          where: { id: organization.id },
          data: {
            subscriptionEndDate: new Date(subData.current_period_end * 1000),
            subscriptionStatus: "ACTIVE",
          },
        })
      }
    } catch (err) {
      console.error("Error retrieving subscription:", err)
    }
  }

  await prisma.activityLog.create({
    data: {
      type: "PAYMENT_SUCCEEDED",
      title: "Payment Succeeded",
      description: `Payment of $${((invoice.amount_paid || 0) / 100).toFixed(2)} received`,
      organizationId: organization.id,
      metadata: {
        invoiceId: invoice.id,
        amount: (invoice.amount_paid || 0) / 100,
      },
    },
  })
}

// Handle invoice payment failed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentFailed(invoice: any) {
  const customerId = invoice.customer as string
  const organization = await getOrganizationByCustomerId(customerId)

  if (!organization) {
    console.error(`No organization found for customer: ${customerId}`)
    return
  }

  // Update invoice record
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      organizationId: organization.id,
      stripeInvoiceId: invoice.id,
      number: invoice.number,
      status: "OPEN",
      amountDue: (invoice.amount_due || 0) / 100,
      amountPaid: (invoice.amount_paid || 0) / 100,
      currency: invoice.currency || "usd",
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : new Date(),
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : new Date(),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdfUrl: invoice.invoice_pdf,
    },
    update: {
      status: "OPEN",
    },
  })

  // Suspend the organization after failed payment
  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionStatus: "SUSPENDED",
    },
  })

  await prisma.activityLog.create({
    data: {
      type: "PAYMENT_FAILED",
      title: "Payment Failed",
      description: `Payment of $${((invoice.amount_due || 0) / 100).toFixed(2)} failed`,
      organizationId: organization.id,
      metadata: {
        invoiceId: invoice.id,
        amount: (invoice.amount_due || 0) / 100,
      },
    },
  })
}

// Handle trial ending soon
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTrialEnding(subscription: any) {
  const customerId = subscription.customer as string
  const organization = await getOrganizationByCustomerId(customerId)

  if (!organization) {
    console.error(`No organization found for customer: ${customerId}`)
    return
  }

  // Log that trial is ending - could also send email notification here
  await prisma.activityLog.create({
    data: {
      type: "SUBSCRIPTION_UPDATED",
      title: "Trial Ending Soon",
      description: "Your trial period is ending in 3 days",
      organizationId: organization.id,
      metadata: {
        subscriptionId: subscription.id,
        trialEnd: subscription.trial_end,
      },
    },
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get("stripe-signature")

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.error("Webhook signature verification failed:", message)
      return NextResponse.json(
        { error: `Webhook Error: ${message}` },
        { status: 400 }
      )
    }

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object)
        break

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object)
        break

      case "invoice.paid":
        await handleInvoicePaid(event.data.object)
        break

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object)
        break

      case "customer.subscription.trial_will_end":
        await handleTrialEnding(event.data.object)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }
}
