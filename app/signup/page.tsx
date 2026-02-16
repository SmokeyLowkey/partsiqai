"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, ArrowLeft, AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const hasTrackedStart = useRef(false)

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    companyName: "",
    industry: "",
    companySize: "",
    primaryUseCase: "",
  })

  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  })

  const handleInputChange = (field: string, value: string) => {
    if (!hasTrackedStart.current) {
      trackEvent(AnalyticsEvents.SIGNUP_STARTED)
      hasTrackedStart.current = true
    }
    setFormData(prev => ({ ...prev, [field]: value }))

    // Update password strength indicators
    if (field === "password") {
      setPasswordStrength({
        length: value.length >= 8,
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        number: /[0-9]/.test(value),
      })
    }
  }

  const isPasswordValid = Object.values(passwordStrength).every(v => v)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Validate all fields are filled
    const requiredFields = Object.entries(formData)
    const emptyFields = requiredFields.filter(([_, value]) => !value)

    if (emptyFields.length > 0) {
      setError("Please fill in all required fields")
      setLoading(false)
      return
    }

    // Validate password strength
    if (!isPasswordValid) {
      setError("Password does not meet requirements")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        trackEvent(AnalyticsEvents.SIGNUP_FAILED, { error: data.error || "Unknown error" })
        setError(data.error || "Failed to create account")
        toast.error(data.error || "Failed to create account")
      } else {
        trackEvent(AnalyticsEvents.SIGNUP_COMPLETED, {
          industry: formData.industry,
          companySize: formData.companySize,
        })
        // Success - show toast and redirect to verification page
        toast.success("Account created successfully! Please check your email.")
        router.push(`/signup/verify-email?email=${encodeURIComponent(formData.email)}`)
      }
    } catch (err) {
      const errorMsg = "Failed to create account. Please try again."
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Back to Home Link */}
        <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-purple-600 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        <Card className="shadow-xl border-purple-100">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
              Start Your Free Trial
            </CardTitle>
            <CardDescription className="text-slate-600">
              14-day free trial • No credit card required • Setup in minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Personal Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    required
                    disabled={loading}
                  />

                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="space-y-2 mt-2">
                      <p className="text-xs text-slate-600">Password must contain:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className={`flex items-center ${passwordStrength.length ? "text-green-600" : "text-slate-400"}`}>
                          <CheckCircle2 className={`h-3 w-3 mr-1 ${passwordStrength.length ? "" : "opacity-30"}`} />
                          At least 8 characters
                        </div>
                        <div className={`flex items-center ${passwordStrength.uppercase ? "text-green-600" : "text-slate-400"}`}>
                          <CheckCircle2 className={`h-3 w-3 mr-1 ${passwordStrength.uppercase ? "" : "opacity-30"}`} />
                          One uppercase letter
                        </div>
                        <div className={`flex items-center ${passwordStrength.lowercase ? "text-green-600" : "text-slate-400"}`}>
                          <CheckCircle2 className={`h-3 w-3 mr-1 ${passwordStrength.lowercase ? "" : "opacity-30"}`} />
                          One lowercase letter
                        </div>
                        <div className={`flex items-center ${passwordStrength.number ? "text-green-600" : "text-slate-400"}`}>
                          <CheckCircle2 className={`h-3 w-3 mr-1 ${passwordStrength.number ? "" : "opacity-30"}`} />
                          One number
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Company Information */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold text-slate-700">Company Information</h3>

                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Acme Construction"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange("companyName", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry *</Label>
                    <Select
                      value={formData.industry}
                      onValueChange={(value) => handleInputChange("industry", value)}
                      disabled={loading}
                      required
                    >
                      <SelectTrigger id="industry">
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Construction">Construction</SelectItem>
                        <SelectItem value="Agriculture">Agriculture</SelectItem>
                        <SelectItem value="Forestry">Forestry</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companySize">Company Size *</Label>
                    <Select
                      value={formData.companySize}
                      onValueChange={(value) => handleInputChange("companySize", value)}
                      disabled={loading}
                      required
                    >
                      <SelectTrigger id="companySize">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10 employees</SelectItem>
                        <SelectItem value="11-50">11-50 employees</SelectItem>
                        <SelectItem value="51-200">51-200 employees</SelectItem>
                        <SelectItem value="201-500">201-500 employees</SelectItem>
                        <SelectItem value="500+">500+ employees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryUseCase">What will you use PartsIQ for? *</Label>
                  <Textarea
                    id="primaryUseCase"
                    placeholder="Tell us about your primary use case (e.g., managing parts for a fleet of excavators, tracking maintenance schedules, etc.)"
                    value={formData.primaryUseCase}
                    onChange={(e) => handleInputChange("primaryUseCase", e.target.value)}
                    required
                    disabled={loading}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating your account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>

              {/* Terms */}
              <p className="text-xs text-center text-slate-500">
                By creating an account, you agree to our{" "}
                <Link href="/terms" className="text-purple-600 hover:text-purple-700">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-purple-600 hover:text-purple-700">
                  Privacy Policy
                </Link>
                .
              </p>

              {/* Login Link */}
              <div className="text-center pt-4 border-t">
                <p className="text-sm text-slate-600">
                  Already have an account?{" "}
                  <Link href="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
