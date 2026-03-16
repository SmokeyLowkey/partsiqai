"use client"

import { useSession } from "next-auth/react"
import { Clock, ArrowRight } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function TrialBanner() {
  const { data: session } = useSession()

  if (!session?.user) return null
  if (session.user.subscriptionStatus !== "TRIAL") return null
  if (!session.user.trialEndsAt) return null

  const trialEnd = new Date(session.user.trialEndsAt)
  const now = new Date()
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  const isUrgent = daysLeft <= 3
  const isExpired = daysLeft === 0

  const billingPath = session.user.role === "ADMIN" || session.user.role === "MASTER_ADMIN"
    ? "/admin/billing"
    : "/customer/billing"

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-2 text-sm",
        isExpired
          ? "bg-red-600 text-white"
          : isUrgent
            ? "bg-amber-500 text-amber-950"
            : "bg-blue-600 text-white"
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          {isExpired
            ? "Your trial has expired."
            : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left in your trial.`}
          {" "}
          {isExpired
            ? "Subscribe to continue using PartsIQ."
            : "Upgrade to unlock unlimited vehicles, uploads, and messages."}
        </span>
      </div>
      <Link
        href={billingPath}
        className={cn(
          "flex items-center gap-1 shrink-0 font-medium rounded-md px-3 py-1 transition-colors",
          isExpired
            ? "bg-white text-red-700 hover:bg-red-50"
            : isUrgent
              ? "bg-amber-900 text-white hover:bg-amber-800"
              : "bg-white text-blue-700 hover:bg-blue-50"
        )}
      >
        Upgrade <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
