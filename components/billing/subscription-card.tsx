"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CreditCard,
  Calendar,
  Users,
  Truck,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink
} from "lucide-react"
import { format } from "date-fns"

interface SubscriptionCardProps {
  subscription: {
    subscriptionTier: string
    subscriptionStatus: string
    subscriptionEndDate?: string | null
    trialEndsAt?: string | null
    cancelAtPeriodEnd: boolean
    maxUsers: number
    maxVehicles: number
  }
  stripeSubscription?: {
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    trialEnd?: string | null
  } | null
  onManagePayment: () => void
  onChangePlan: () => void
  onCancelSubscription: () => void
  onReactivate: () => void
  isLoading?: boolean
}

const tierPricing: Record<string, number> = {
  STARTER: 99,
  GROWTH: 299,
  ENTERPRISE: 799,
}

const tierColors: Record<string, string> = {
  STARTER: "bg-blue-100 text-blue-800",
  GROWTH: "bg-purple-100 text-purple-800",
  ENTERPRISE: "bg-amber-100 text-amber-800",
}

export function SubscriptionCard({
  subscription,
  stripeSubscription,
  onManagePayment,
  onChangePlan,
  onCancelSubscription,
  onReactivate,
  isLoading,
}: SubscriptionCardProps) {
  const getStatusBadge = () => {
    const status = subscription.subscriptionStatus

    if (status === "ACTIVE") {
      return (
        <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle className="h-3 w-3" />
          Active
        </Badge>
      )
    }

    if (status === "TRIAL") {
      return (
        <Badge className="gap-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
          <Clock className="h-3 w-3" />
          Trial
        </Badge>
      )
    }

    if (status === "SUSPENDED") {
      return (
        <Badge className="gap-1 bg-orange-100 text-orange-800 hover:bg-orange-100">
          <AlertCircle className="h-3 w-3" />
          Suspended
        </Badge>
      )
    }

    if (status === "CANCELLED") {
      return (
        <Badge className="gap-1 bg-red-100 text-red-800 hover:bg-red-100">
          <XCircle className="h-3 w-3" />
          Cancelled
        </Badge>
      )
    }

    return <Badge variant="outline">{status}</Badge>
  }

  const periodEnd = stripeSubscription?.currentPeriodEnd || subscription.subscriptionEndDate
  const trialEnd = stripeSubscription?.trialEnd || subscription.trialEndsAt
  const isCancelling = subscription.cancelAtPeriodEnd || stripeSubscription?.cancelAtPeriodEnd

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <CardDescription>
              Manage your subscription and billing
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Details */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-sm font-medium ${tierColors[subscription.subscriptionTier] || "bg-gray-100"}`}>
                {subscription.subscriptionTier}
              </span>
              {isCancelling && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  Cancels at period end
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold mt-1">
              ${tierPricing[subscription.subscriptionTier] || 0}
              <span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="flex items-center gap-1 justify-end">
              <Users className="h-4 w-4" />
              Up to {subscription.maxUsers} users
            </div>
            <div className="flex items-center gap-1 justify-end mt-1">
              <Truck className="h-4 w-4" />
              Up to {subscription.maxVehicles} vehicles
            </div>
          </div>
        </div>

        {/* Trial Notice */}
        {subscription.subscriptionStatus === "TRIAL" && trialEnd && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              Trial ends on {format(new Date(trialEnd), "MMMM d, yyyy")}
            </span>
          </div>
        )}

        {/* Cancellation Notice */}
        {isCancelling && periodEnd && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              Your subscription will end on {format(new Date(periodEnd), "MMMM d, yyyy")}
            </span>
          </div>
        )}

        {/* Billing Period */}
        {periodEnd && !isCancelling && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Next billing date: {format(new Date(periodEnd), "MMMM d, yyyy")}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={onManagePayment} variant="outline" disabled={isLoading}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Payment Methods
          </Button>

          <Button onClick={onChangePlan} variant="outline" disabled={isLoading}>
            Change Plan
          </Button>

          {isCancelling ? (
            <Button onClick={onReactivate} variant="default" disabled={isLoading}>
              Reactivate Subscription
            </Button>
          ) : (
            subscription.subscriptionStatus !== "CANCELLED" && (
              <Button onClick={onCancelSubscription} variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" disabled={isLoading}>
                Cancel Subscription
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}
