"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CreditCard, XCircle, LogOut } from "lucide-react"

export default function SubscriptionRequiredPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)

  useEffect(() => {
    // Fetch fresh subscription status
    async function checkSubscription() {
      try {
        const res = await fetch("/api/billing/subscription")
        if (res.ok) {
          const data = await res.json()
          setSubscriptionStatus(data.subscriptionStatus)

          // If subscription is now active, redirect to dashboard
          if (data.subscriptionStatus === "ACTIVE" || data.subscriptionStatus === "TRIAL") {
            const isAdmin = session?.user?.role === "MASTER_ADMIN" || session?.user?.role === "ADMIN"
            router.push(isAdmin ? "/admin/dashboard" : "/customer/dashboard")
          }
        }
      } catch (error) {
        console.error("Failed to check subscription:", error)
      }
    }

    if (status === "authenticated") {
      checkSubscription()
    }
  }, [status, session, router])

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const isSuspended = subscriptionStatus === "SUSPENDED" || session?.user?.subscriptionStatus === "SUSPENDED"
  const isCancelled = subscriptionStatus === "CANCELLED" || session?.user?.subscriptionStatus === "CANCELLED"

  const handleGoToBilling = () => {
    const isAdmin = session?.user?.role === "MASTER_ADMIN" || session?.user?.role === "ADMIN"
    router.push(isAdmin ? "/admin/billing" : "/customer/billing")
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            {isSuspended ? (
              <AlertCircle className="h-8 w-8 text-orange-600" />
            ) : (
              <XCircle className="h-8 w-8 text-red-600" />
            )}
          </div>
          <CardTitle className="text-xl">
            {isSuspended ? "Payment Required" : "Subscription Cancelled"}
          </CardTitle>
          <CardDescription className="text-base">
            {isSuspended
              ? "Your subscription payment has failed. Please update your payment method to continue using PartsIQ."
              : "Your subscription has been cancelled. Please reactivate your subscription to continue using PartsIQ."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-100 p-4">
            <h3 className="font-medium text-gray-900 mb-2">What you need to do:</h3>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {isSuspended ? (
                <>
                  <li>Go to the billing page</li>
                  <li>Update your payment method</li>
                  <li>Your access will be restored immediately</li>
                </>
              ) : (
                <>
                  <li>Go to the billing page</li>
                  <li>Choose a subscription plan</li>
                  <li>Complete the checkout process</li>
                </>
              )}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handleGoToBilling} className="w-full gap-2">
              <CreditCard className="h-4 w-4" />
              {isSuspended ? "Update Payment Method" : "Reactivate Subscription"}
            </Button>
            <Button variant="outline" onClick={handleSignOut} className="w-full gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>

          <p className="text-center text-xs text-gray-500">
            Need help? Contact support at support@partsiq.com
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
