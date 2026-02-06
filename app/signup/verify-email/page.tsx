"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function VerifyEmailPendingPage() {
  const router = useRouter()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleResend = async () => {
    setResending(true)

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()

      if (response.ok) {
        setResent(true)
        toast.success("Verification email sent!")
      } else {
        toast.error(data.error || "Failed to resend email")
      }
    } catch (error) {
      toast.error("Failed to resend verification email")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-purple-100">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                <Mail className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
              Check Your Email
            </CardTitle>
            <CardDescription className="text-slate-600">
              We've sent you a verification link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Success Message */}
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Account created successfully! Please verify your email to continue.
              </AlertDescription>
            </Alert>

            {/* Instructions */}
            <div className="space-y-4 text-sm text-slate-600">
              <p>
                We've sent a verification link to your email address. Click the link in the email to verify your account and complete setup.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <p className="font-medium text-slate-700">What to do next:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Check your inbox (and spam folder)</li>
                  <li>Click the verification link in the email</li>
                  <li>Complete your account setup</li>
                </ol>
              </div>

              <p className="text-xs text-slate-500">
                The verification link will expire in 24 hours.
              </p>
            </div>

            {/* Resend Button */}
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">
                    Didn't receive the email?
                  </span>
                </div>
              </div>

              <Button
                onClick={handleResend}
                disabled={resending || resent}
                variant="outline"
                className="w-full"
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : resent ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Email Sent!
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>
            </div>

            {/* Help Section */}
            <div className="text-center space-y-2 pt-4 border-t">
              <p className="text-sm text-slate-600">
                Wrong email address?{" "}
                <Link href="/signup" className="text-purple-600 hover:text-purple-700 font-medium">
                  Sign up again
                </Link>
              </p>
              <p className="text-sm text-slate-600">
                Already verified?{" "}
                <Link href="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                  Log in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Support Link */}
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
