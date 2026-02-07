"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles, ArrowLeft, AlertCircle, Loader2, Mail, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (res.status === 429) {
        const data = await res.json()
        setError(data.error)
        return
      }

      // Always show success (don't reveal if email exists)
      setSubmitted(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

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
                {submitted ? (
                  <Mail className="h-6 w-6 text-white" />
                ) : (
                  <Sparkles className="h-6 w-6 text-white" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
              {submitted ? "Check Your Email" : "Reset Password"}
            </CardTitle>
            <CardDescription className="text-slate-600">
              {submitted
                ? "If an account exists with that email, we've sent a password reset link."
                : "Enter your email and we'll send you a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                  <p className="text-sm text-green-700">
                    Reset link sent to <strong>{email}</strong>
                  </p>
                </div>

                <p className="text-xs text-center text-slate-500">
                  The link expires in 1 hour. Check your spam folder if you don't see it.
                </p>

                <div className="text-center pt-4 border-t border-slate-200">
                  <Link href="/login" className="text-sm text-purple-600 hover:text-purple-700 font-semibold">
                    Return to Login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>

                <div className="text-center pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    Remember your password?{" "}
                    <Link href="/login" className="text-purple-600 hover:text-purple-700 font-semibold">
                      Sign in
                    </Link>
                  </p>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
