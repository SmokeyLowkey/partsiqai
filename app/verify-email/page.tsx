"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"

type VerificationState = "verifying" | "success" | "error"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [state, setState] = useState<VerificationState>("verifying")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setState("error")
      setMessage("No verification token provided")
      return
    }

    // Call verification API
    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`)
        const data = await response.json()

        if (response.ok) {
          setState("success")
          setMessage("Your email address has been successfully verified! You can now log in to your account and complete your setup.")

          // Automatically redirect to login after 3 seconds
          setTimeout(() => {
            router.push("/login")
          }, 3000)
        } else {
          setState("error")
          setMessage(data.error || "Verification failed")
        }
      } catch (error) {
        setState("error")
        setMessage("Failed to verify email. Please try again.")
      }
    }

    verifyEmail()
  }, [token, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-purple-100">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                {state === "verifying" && <Loader2 className="h-6 w-6 text-white animate-spin" />}
                {state === "success" && <CheckCircle2 className="h-6 w-6 text-white" />}
                {state === "error" && <XCircle className="h-6 w-6 text-white" />}
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
              {state === "verifying" && "Verifying Your Email"}
              {state === "success" && "Email Verified!"}
              {state === "error" && "Verification Failed"}
            </CardTitle>
            <CardDescription className="text-slate-600">
              {state === "verifying" && "Please wait while we verify your email address..."}
              {state === "success" && "Congratulations! Your email verification is complete."}
              {state === "error" && "We couldn't verify your email address"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Message Alert */}
            {message && (
              <Alert variant={state === "error" ? "destructive" : "default"} className={state === "success" ? "border-green-200 bg-green-50" : ""}>
                {state === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {state === "error" && <XCircle className="h-4 w-4" />}
                <AlertDescription className={state === "success" ? "text-green-800" : ""}>
                  {message}
                </AlertDescription>
              </Alert>
            )}

            {/* Success State */}
            {state === "success" && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold text-green-900 mb-1">
                    Email Verified Successfully!
                  </h3>
                  <p className="text-sm text-green-700 mb-2">
                    Your email address has been confirmed. You're all set to log in and start using PartsIQ.
                  </p>
                  <p className="text-xs text-green-600">
                    Redirecting to login in 3 seconds...
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/login")}
                  className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                >
                  Continue to Login Now
                </Button>
              </div>
            )}

            {/* Error State */}
            {state === "error" && (
              <div className="space-y-4">
                <div className="text-sm text-slate-600 space-y-2">
                  <p>This could happen if:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>The verification link has expired (24 hours)</li>
                    <li>The link has already been used</li>
                    <li>The link is invalid or corrupted</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => router.push("/signup/verify-email")}
                    className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                  >
                    Request New Verification Link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/")}
                    className="w-full"
                  >
                    Back to Home
                  </Button>
                </div>
              </div>
            )}

            {/* Verifying State */}
            {state === "verifying" && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Need help?{" "}
            <Link href="/support" className="text-purple-600 hover:text-purple-700 font-medium">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
