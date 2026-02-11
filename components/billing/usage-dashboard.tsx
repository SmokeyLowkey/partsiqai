"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Phone,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Settings,
  ExternalLink,
  DollarSign,
  Zap,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface UsageData {
  organizationId: string
  subscriptionTier: string
  overageEnabled: boolean
  overageRate: number
  hardCapEnabled: boolean
  hardCapMultiplier: number
  maxAICalls: number
  aiCallsUsedThisMonth: number
  aiCallsResetDate: string
  pendingOverageAmount: number
  pendingOverageCalls: number
  defaultOverageRate: number
}

interface UsageDashboardProps {
  organizationId?: string
  showSettings?: boolean
}

export function UsageDashboard({ organizationId, showSettings = true }: UsageDashboardProps) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const fetchUsage = async () => {
    try {
      const response = await fetch("/api/billing/overage-settings")
      if (!response.ok) throw new Error("Failed to fetch usage data")
      const data = await response.json()
      setUsage(data)
    } catch (error) {
      console.error("Error fetching usage:", error)
      toast({
        title: "Error",
        description: "Failed to load usage data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  const handleToggleOverage = async (enabled: boolean) => {
    if (!usage) return
    
    setIsSaving(true)
    try {
      const response = await fetch("/api/billing/overage-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overageEnabled: enabled }),
      })

      if (!response.ok) throw new Error("Failed to update settings")
      
      setUsage({ ...usage, overageEnabled: enabled })
      toast({
        title: "Settings updated",
        description: `Overage billing ${enabled ? "enabled" : "disabled"}`,
      })
    } catch (error) {
      console.error("Error updating settings:", error)
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Call Usage</CardTitle>
          <CardDescription>Loading usage data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!usage) {
    return null
  }

  const usagePercent = Math.min((usage.aiCallsUsedThisMonth / usage.maxAICalls) * 100, 100)
  const isOverLimit = usage.aiCallsUsedThisMonth > usage.maxAICalls
  const isNearLimit = usagePercent >= 80 && !isOverLimit
  const hardLimit = usage.hardCapEnabled
    ? Math.floor(usage.maxAICalls * usage.hardCapMultiplier)
    : null
  const overageCalls = Math.max(0, usage.aiCallsUsedThisMonth - usage.maxAICalls)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              AI Call Usage
            </CardTitle>
            <CardDescription>
              Track your AI-powered supplier calls for this billing period
            </CardDescription>
          </div>
          <Badge className={usage.subscriptionTier === "STARTER" ? "bg-blue-100 text-blue-800" : usage.subscriptionTier === "GROWTH" ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800"}>
            {usage.subscriptionTier}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              {usage.aiCallsUsedThisMonth} / {usage.maxAICalls} calls used
            </span>
            <span className="text-muted-foreground">{usagePercent.toFixed(0)}%</span>
          </div>
          <Progress 
            value={usagePercent} 
            className={isOverLimit ? "bg-red-100" : isNearLimit ? "bg-yellow-100" : ""}
          />
          <p className="text-xs text-muted-foreground">
            Resets on {new Date(usage.aiCallsResetDate).toLocaleDateString()}
          </p>
        </div>

        {/* Warning Alerts */}
        {isOverLimit && usage.overageEnabled && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">Over Your Plan Limit</AlertTitle>
            <AlertDescription className="text-amber-800">
              <div className="space-y-1">
                <p>You've used {overageCalls} additional calls at ${usage.overageRate}/call.</p>
                {usage.pendingOverageAmount > 0 && (
                  <p className="font-semibold">
                    Pending overage charges: {formatCurrency(usage.pendingOverageAmount)}
                  </p>
                )}
                {hardLimit && (
                  <p className="text-xs mt-2">
                    Hard cap at {hardLimit} calls ({usage.hardCapMultiplier}x your limit)
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isOverLimit && !usage.overageEnabled && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-900">At Your Limit</AlertTitle>
            <AlertDescription className="text-red-800">
              <p>You've reached your plan limit. Enable overage billing to continue making calls, or upgrade your plan.</p>
            </AlertDescription>
          </Alert>
        )}

        {isNearLimit && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <TrendingUp className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-900">Approaching Limit</AlertTitle>
            <AlertDescription className="text-yellow-800">
              You've used {usagePercent.toFixed(0)}% of your included calls. Consider upgrading or enabling overage billing.
            </AlertDescription>
          </Alert>
        )}

        {!isOverLimit && !isNearLimit && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900">On Track</AlertTitle>
            <AlertDescription className="text-green-800">
              You're using {usagePercent.toFixed(0)}% of your included calls. Nice pace!
            </AlertDescription>
          </Alert>
        )}

        {/* Overage Settings */}
        {showSettings && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="overage-enabled" className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Overage Billing
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow calls beyond your limit at ${usage.overageRate}/call
                </p>
              </div>
              <Switch
                id="overage-enabled"
                checked={usage.overageEnabled}
                onCheckedChange={handleToggleOverage}
                disabled={isSaving}
              />
            </div>

            {usage.overageEnabled && (
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overage rate:</span>
                  <span className="font-medium">${usage.overageRate}/call</span>
                </div>
                {hardLimit && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hard cap:</span>
                    <span className="font-medium">{hardLimit} calls</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billed:</span>
                  <span className="font-medium">Monthly invoice</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.open("/pricing", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Plans
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => window.open("/api/billing/customer-portal", "_blank")}
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Billing
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
