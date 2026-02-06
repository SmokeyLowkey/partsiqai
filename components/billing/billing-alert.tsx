"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, Clock, XCircle } from "lucide-react"

interface BillingAlertProps {
  type: "payment_failed" | "trial_ending" | "subscription_cancelled" | "subscription_suspended"
  message?: string
  onAction?: () => void
  actionLabel?: string
}

export function BillingAlert({ type, message, onAction, actionLabel }: BillingAlertProps) {
  const alertConfig = {
    payment_failed: {
      icon: XCircle,
      title: "Payment Failed",
      description: message || "Your last payment was declined. Please update your payment method to continue service.",
      variant: "destructive" as const,
    },
    trial_ending: {
      icon: Clock,
      title: "Trial Ending Soon",
      description: message || "Your free trial is ending soon. Add a payment method to continue using PartsIQ.",
      variant: "default" as const,
    },
    subscription_cancelled: {
      icon: AlertCircle,
      title: "Subscription Cancelled",
      description: message || "Your subscription has been cancelled. Reactivate to regain access to all features.",
      variant: "default" as const,
    },
    subscription_suspended: {
      icon: AlertTriangle,
      title: "Account Suspended",
      description: message || "Your account has been suspended due to payment issues. Please update your payment method.",
      variant: "destructive" as const,
    },
  }

  const config = alertConfig[type]
  const Icon = config.icon

  return (
    <Alert variant={config.variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{config.description}</span>
        {onAction && actionLabel && (
          <Button size="sm" variant="outline" onClick={onAction} className="ml-4">
            {actionLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
