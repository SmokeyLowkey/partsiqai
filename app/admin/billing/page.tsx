"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CreditCard, Receipt, ArrowUpRight, Loader2 } from "lucide-react"
import { SubscriptionCard } from "@/components/billing/subscription-card"
import { PlanSelector } from "@/components/billing/plan-selector"
import { InvoiceTable } from "@/components/billing/invoice-table"
import { BillingAlert } from "@/components/billing/billing-alert"

interface Subscription {
  id: string
  name: string
  subscriptionTier: string
  subscriptionStatus: string
  subscriptionEndDate: string | null
  trialEndsAt: string | null
  cancelAtPeriodEnd: boolean
  maxUsers: number
  maxVehicles: number
  stripeCustomerId: string | null
  billingEmail: string | null
}

interface StripeSubscription {
  id: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialEnd: string | null
}

interface Invoice {
  id: string
  number: string | null
  status: string
  amountDue: number
  amountPaid: number
  currency: string
  periodStart: string | null
  periodEnd: string | null
  paidAt: string | null
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
  createdAt: string
}

function AdminBillingPageContent() {
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [isLoading, setIsLoading] = useState(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [stripeSubscription, setStripeSubscription] = useState<StripeSubscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)

  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Check for success/cancel from Stripe checkout
  useEffect(() => {
    const success = searchParams.get("success")
    const canceled = searchParams.get("canceled")

    if (success === "true") {
      toast({
        title: "Subscription Created",
        description: "Welcome! Your subscription is now active.",
      })
    } else if (canceled === "true") {
      toast({
        title: "Checkout Cancelled",
        description: "You can complete your subscription anytime.",
        variant: "destructive",
      })
    }
  }, [searchParams, toast])

  // Load subscription data
  useEffect(() => {
    loadSubscription()
    loadInvoices()
  }, [])

  const loadSubscription = async () => {
    try {
      const response = await fetch("/api/billing/subscription")
      if (response.ok) {
        const data = await response.json()
        setSubscription(data.organization)
        setStripeSubscription(data.stripeSubscription)
      }
    } catch (error) {
      console.error("Error loading subscription:", error)
      toast({
        title: "Error",
        description: "Failed to load subscription details",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadInvoices = async () => {
    try {
      const response = await fetch("/api/billing/invoices")
      if (response.ok) {
        const data = await response.json()
        setInvoices(data.invoices)
      }
    } catch (error) {
      console.error("Error loading invoices:", error)
    } finally {
      setInvoicesLoading(false)
    }
  }

  const handleManagePayment = async () => {
    setActionLoading(true)
    try {
      const response = await fetch("/api/billing/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/admin/billing` }),
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.url
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to open billing portal",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error opening customer portal:", error)
      toast({
        title: "Error",
        description: "Failed to open billing portal",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleSelectPlan = async (planId: string) => {
    setActionLoading(true)
    try {
      // If no existing subscription, create checkout session
      if (!subscription?.stripeCustomerId || !stripeSubscription) {
        const response = await fetch("/api/billing/checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier: planId,
            successUrl: `${window.location.origin}/admin/billing?success=true`,
            cancelUrl: `${window.location.origin}/admin/billing?canceled=true`,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          window.location.href = data.url
        } else {
          const error = await response.json()
          toast({
            title: "Error",
            description: error.error || "Failed to create checkout session",
            variant: "destructive",
          })
        }
      } else {
        // Update existing subscription
        const response = await fetch("/api/billing/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: planId }),
        })

        if (response.ok) {
          toast({
            title: "Plan Updated",
            description: "Your subscription has been updated successfully.",
          })
          setShowUpgradeDialog(false)
          loadSubscription()
        } else {
          const error = await response.json()
          toast({
            title: "Error",
            description: error.error || "Failed to update subscription",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("Error selecting plan:", error)
      toast({
        title: "Error",
        description: "Failed to process request",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    setActionLoading(true)
    try {
      const response = await fetch("/api/billing/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immediate: false }),
      })

      if (response.ok) {
        toast({
          title: "Subscription Cancelled",
          description: "Your subscription will end at the current billing period.",
        })
        setShowCancelDialog(false)
        loadSubscription()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to cancel subscription",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error)
      toast({
        title: "Error",
        description: "Failed to cancel subscription",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivate = async () => {
    // Reactivation is done via the customer portal
    handleManagePayment()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const showPaymentFailedAlert = subscription?.subscriptionStatus === "SUSPENDED"
  const showTrialAlert =
    subscription?.subscriptionStatus === "TRIAL" && subscription?.trialEndsAt
  const showCancelledAlert = subscription?.subscriptionStatus === "CANCELLED"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and payment methods
        </p>
      </div>

      {/* Alerts */}
      {showPaymentFailedAlert && (
        <BillingAlert
          type="subscription_suspended"
          onAction={handleManagePayment}
          actionLabel="Update Payment"
        />
      )}

      {showTrialAlert && (
        <BillingAlert
          type="trial_ending"
          onAction={handleManagePayment}
          actionLabel="Add Payment Method"
        />
      )}

      {showCancelledAlert && (
        <BillingAlert
          type="subscription_cancelled"
          onAction={() => setShowUpgradeDialog(true)}
          actionLabel="Reactivate"
        />
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Plans
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {subscription && (
            <SubscriptionCard
              subscription={subscription}
              stripeSubscription={stripeSubscription}
              onManagePayment={handleManagePayment}
              onChangePlan={() => setShowUpgradeDialog(true)}
              onCancelSubscription={() => setShowCancelDialog(true)}
              onReactivate={handleReactivate}
              isLoading={actionLoading}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Your latest billing history</CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceTable
                invoices={invoices.slice(0, 5)}
                isLoading={invoicesLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>
                View and download all your invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceTable invoices={invoices} isLoading={invoicesLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <PlanSelector
            currentPlan={subscription?.subscriptionTier || "STARTER"}
            onSelectPlan={handleSelectPlan}
            isLoading={actionLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? You will
              continue to have access until the end of your current billing
              period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Cancel Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Change Your Plan</DialogTitle>
            <DialogDescription>
              Select a new plan. Changes will be prorated.
            </DialogDescription>
          </DialogHeader>
          <PlanSelector
            currentPlan={subscription?.subscriptionTier || "STARTER"}
            onSelectPlan={handleSelectPlan}
            isLoading={actionLoading}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AdminBillingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <AdminBillingPageContent />
    </Suspense>
  )
}
