import Stripe from "stripe"

const stripeClientSingleton = () => {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover",
    typescript: true,
  })
}

declare global {
  var stripeGlobal: undefined | ReturnType<typeof stripeClientSingleton>
}

const stripe = globalThis.stripeGlobal ?? stripeClientSingleton()

export default stripe
export { stripe }

if (process.env.NODE_ENV !== "production") globalThis.stripeGlobal = stripe

// Price ID helpers
export const STRIPE_PRICES = {
  BASIC: process.env.STRIPE_PRICE_BASIC!,
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL!,
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE!,
} as const

export type SubscriptionTier = keyof typeof STRIPE_PRICES

// Map subscription tier to Stripe price ID
export function getPriceIdForTier(tier: SubscriptionTier): string {
  return STRIPE_PRICES[tier]
}

// Map Stripe price ID to subscription tier
export function getTierForPriceId(priceId: string): SubscriptionTier | null {
  const entry = Object.entries(STRIPE_PRICES).find(([, id]) => id === priceId)
  return entry ? (entry[0] as SubscriptionTier) : null
}

// Map Stripe subscription status to app subscription status
export function mapStripeStatusToAppStatus(
  stripeStatus: Stripe.Subscription.Status
): "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED" {
  switch (stripeStatus) {
    case "active":
      return "ACTIVE"
    case "trialing":
      return "TRIAL"
    case "past_due":
    case "unpaid":
    case "paused":
      return "SUSPENDED"
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
      return "CANCELLED"
    default:
      return "SUSPENDED"
  }
}
