"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

// Routes that don't require an active subscription
const EXEMPT_ROUTES = [
  "/admin/billing",
  "/customer/billing",
  "/subscription-required",
  "/login",
]

interface SubscriptionGuardProps {
  children: React.ReactNode
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Skip check for exempt routes or if not authenticated
    if (status !== "authenticated") return
    if (EXEMPT_ROUTES.some(route => pathname.startsWith(route))) return

    // Check fresh subscription status from API
    async function checkSubscription() {
      try {
        const res = await fetch("/api/billing/subscription")
        if (res.ok) {
          const data = await res.json()
          const subscriptionStatus = data.subscriptionStatus

          // Redirect if subscription is blocked
          if (subscriptionStatus === "CANCELLED" || subscriptionStatus === "SUSPENDED") {
            router.push("/subscription-required")
          }
        }
      } catch (error) {
        console.error("Failed to check subscription:", error)
      }
    }

    checkSubscription()
  }, [status, pathname, router])

  return <>{children}</>
}
