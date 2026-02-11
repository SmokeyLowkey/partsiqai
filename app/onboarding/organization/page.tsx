"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, Loader2, AlertCircle, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

export default function OrganizationPage() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    logo: "",
    primaryColor: "#2563eb",
  })

  // Determine dashboard path from session role
  const getDashboardPath = () => {
    const role = session?.user?.role
    return role === "ADMIN" || role === "MASTER_ADMIN"
      ? "/admin/dashboard"
      : "/customer/dashboard"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Complete onboarding
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: formData,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to complete onboarding")
      }

      toast.success("Setup complete! Welcome to PartsIQ")

      // Force session refresh so the JWT picks up the new onboardingStatus
      await update()

      // Redirect to login page
      window.location.href = "/login"
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/onboarding/skip", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to skip onboarding")
      }

      toast.success("You can complete setup later from Settings")

      // Force session refresh
      await update()

      window.location.href = getDashboardPath()
    } catch (err: any) {
      console.error("Error skipping onboarding:", err)
      toast.error(err.message || "Failed to skip onboarding")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl border-purple-100">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
            Organization Setup
          </CardTitle>
          <CardDescription className="text-slate-600">
            Customize your organization's branding (optional)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Info Box */}
            <div className="bg-gradient-to-r from-purple-50 to-cyan-50 border border-purple-100 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                You can customize these settings anytime from your dashboard.
                Click "Skip" to start using PartsIQ right away!
              </p>
            </div>

            {/* Organization Logo URL (optional) */}
            <div className="space-y-2">
              <Label htmlFor="logo">Organization Logo URL (optional)</Label>
              <Input
                id="logo"
                type="url"
                placeholder="https://example.com/logo.png"
                value={formData.logo}
                onChange={(e) => setFormData(prev => ({ ...prev, logo: e.target.value }))}
              />
              <p className="text-xs text-slate-500">
                Enter a URL to your organization's logo
              </p>
            </div>

            {/* Primary Brand Color */}
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Brand Color</Label>
              <div className="flex gap-3 items-center">
                <Input
                  id="primaryColor"
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  type="text"
                  value={formData.primaryColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                  placeholder="#2563eb"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-slate-500">
                This color will be used throughout your dashboard
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="gap-2"
                disabled={loading}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                className="flex-1"
                disabled={loading}
              >
                Skip for now
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finishing...
                  </>
                ) : (
                  "Complete Setup"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
