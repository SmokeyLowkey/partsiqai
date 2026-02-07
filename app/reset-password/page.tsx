"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles, ArrowLeft, AlertCircle, Loader2, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [email, setEmail] = useState("")
  const [success, setSuccess] = useState(false)

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidating(false)
      return
    }

    fetch(`/api/auth/reset-password?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        setTokenValid(data.valid)
        if (data.email) setEmail(data.email)
      })
      .catch(() => setTokenValid(false))
      .finally(() => setValidating(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter.")
      return
    }

    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter.")
      return
    }

    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to reset password.")
        return
      }

      setSuccess(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Loading state while validating token
  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm text-slate-600">Validating reset link...</p>
        </div>
      </div>
    )
  }

  // Invalid or missing token
  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-red-100">
            <CardHeader className="space-y-1 text-center">
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">
                Invalid Reset Link
              </CardTitle>
              <CardDescription className="text-slate-600">
                This password reset link is invalid or has expired.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-center text-slate-500">
                Reset links expire after 1 hour. Please request a new one.
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/forgot-password">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white">
                    Request New Reset Link
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-green-100">
            <CardHeader className="space-y-1 text-center">
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-slate-800">
                Password Reset
              </CardTitle>
              <CardDescription className="text-slate-600">
                Your password has been successfully updated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white">
                  Sign In with New Password
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Reset form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center text-sm text-slate-600 hover:text-purple-600 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Login
        </Link>

        <Card className="shadow-xl border-purple-100">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
              Set New Password
            </CardTitle>
            <CardDescription className="text-slate-600">
              {email ? `Resetting password for ${email}` : "Enter your new password below."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p>Password must contain:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li className={password.length >= 8 ? "text-green-600" : ""}>At least 8 characters</li>
                  <li className={/[A-Z]/.test(password) ? "text-green-600" : ""}>One uppercase letter</li>
                  <li className={/[a-z]/.test(password) ? "text-green-600" : ""}>One lowercase letter</li>
                  <li className={/[0-9]/.test(password) ? "text-green-600" : ""}>One number</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
