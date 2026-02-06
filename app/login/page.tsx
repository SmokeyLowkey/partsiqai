"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles, ArrowLeft, AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { authToasts } from "@/lib/toast-utils"

const ERROR_MESSAGES: Record<string, string> = {
  "CredentialsSignin": "Invalid email or password. Please try again.",
  "AccountNotActive": "Your account has been deactivated. Please contact support.",
  "EmailNotVerified": "Please verify your email address before logging in.",
  "ServerError": "An error occurred. Please try again later.",
  "Default": "Authentication failed. Please try again."
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        const errorMessage = ERROR_MESSAGES[result.error] || ERROR_MESSAGES.Default
        setError(errorMessage)

        console.log("[LOGIN] Login failed:", {
          email,
          error: result.error,
          timestamp: new Date().toISOString(),
        })

        // Show error toast
        authToasts.signInError(errorMessage)
      } else if (result?.ok) {
        console.log("[LOGIN] Login successful:", {
          email,
          timestamp: new Date().toISOString(),
        })

        // Show success toast
        authToasts.signInSuccess()

        // Set redirecting state to prevent further interaction
        setIsRedirecting(true)

        // Successful login - NextAuth will set the session
        // Middleware will handle redirect based on role
        router.push("/admin/dashboard") // Middleware will redirect to correct dashboard
        router.refresh()
      }
    } catch (err) {
      const errorMessage = ERROR_MESSAGES.ServerError
      setError(errorMessage)

      // Show error toast for unexpected errors
      authToasts.signInError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const isFormDisabled = loading || isRedirecting

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center p-4">
      {/* Loading Overlay */}
      {isRedirecting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <p className="text-sm font-medium text-slate-700">Redirecting to your dashboard...</p>
          </div>
        </div>
      )}
      
      <div className="w-full max-w-md">
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
              Welcome to PartsIQ
            </CardTitle>
            <CardDescription className="text-slate-600">
              Sign in to access your portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isFormDisabled}
                  className="w-full"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isFormDisabled}
                  className="w-full"
                />
              </div>

              {/* Forgot Password */}
              <div className="flex items-center justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-purple-600 hover:text-purple-700 transition-colors"
                  tabIndex={isFormDisabled ? -1 : 0}
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                disabled={isFormDisabled}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : isRedirecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">
                  Secure Authentication
                </span>
              </div>
            </div>

            {/* Additional Info */}
            <p className="text-xs text-center text-slate-500">
              Your credentials are encrypted and secure. By signing in, you agree to our{" "}
              <Link href="/terms" className="text-purple-600 hover:text-purple-700">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-purple-600 hover:text-purple-700">
                Privacy Policy
              </Link>
              .
            </p>

            {/* Sign Up Link */}
            <div className="text-center mt-6 pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                Don't have an account?{" "}
                <Link href="/signup" className="text-purple-600 hover:text-purple-700 font-semibold">
                  Sign up for free
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
