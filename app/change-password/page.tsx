"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Lock, CheckCircle } from "lucide-react"
import { toast } from "sonner"

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Password validation states
  const isLengthValid = newPassword.length >= 8
  const isDifferentFromCurrent = newPassword !== currentPassword && newPassword.length > 0
  const doPasswordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match")
      return
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters")
      return
    }

    // Ensure new password is different from current
    if (newPassword === currentPassword) {
      setError("New password must be different from temporary password")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password")
      }

      toast.success("Password changed successfully! Please log in with your new password.")

      // Sign out to clear the session and force a fresh login
      // This ensures mustChangePassword flag is cleared on next login
      await signOut({ redirect: false })

      // Small delay for toast to be visible
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Redirect to login page
      router.push("/login")
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-purple-100">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                <Lock className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 bg-clip-text text-transparent">
              Change Your Password
            </CardTitle>
            <CardDescription>
              You must change your temporary password before continuing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Temporary Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter your temporary password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-slate-500">
                  This is the password from your welcome email
                </p>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Create a new password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-slate-500">
                  Must be different from your temporary password
                </p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Password Requirements - Live Validation */}
              <div className="space-y-2 p-3 rounded-lg border bg-slate-50">
                <p className="text-sm font-medium text-slate-700">Password Requirements:</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    {isLengthValid ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-slate-300" />
                    )}
                    <span className={isLengthValid ? "text-green-700" : "text-slate-600"}>
                      At least 8 characters long
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {isDifferentFromCurrent ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-slate-300" />
                    )}
                    <span className={isDifferentFromCurrent ? "text-green-700" : "text-slate-600"}>
                      Different from your temporary password
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {doPasswordsMatch ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-slate-300" />
                    )}
                    <span className={doPasswordsMatch ? "text-green-700" : "text-slate-600"}>
                      Passwords match
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
                disabled={loading || !isLengthValid || !isDifferentFromCurrent || !doPasswordsMatch || !currentPassword}
              >
                {loading ? "Changing Password..." : "Change Password"}
              </Button>

              {/* Disabled button hint */}
              {(!isLengthValid || !isDifferentFromCurrent || !doPasswordsMatch || !currentPassword) && !loading && (
                <p className="text-xs text-center text-slate-500">
                  Please meet all password requirements to continue
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
