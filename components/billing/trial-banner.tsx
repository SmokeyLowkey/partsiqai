"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { Clock, AlertTriangle, XCircle, Sparkles } from "lucide-react"

function getDaysLeft(trialEndsAt: string): number {
  const now = new Date()
  const end = new Date(trialEndsAt)
  const diff = end.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getBillingPath(role: string): string {
  return role === "ADMIN" || role === "MASTER_ADMIN"
    ? "/admin/billing"
    : "/customer/billing"
}

export function TrialBanner() {
  const { data: session } = useSession()

  if (!session?.user) return null
  if (session.user.subscriptionStatus !== "TRIAL") return null
  if (!session.user.trialEndsAt) return null

  const daysLeft = getDaysLeft(session.user.trialEndsAt)
  const billingPath = getBillingPath(session.user.role)

  let bgClass: string
  let textClass: string
  let Icon: typeof Clock
  let message: string
  let ctaLabel: string

  if (daysLeft <= 0) {
    bgClass = "bg-red-600"
    textClass = "text-white"
    Icon = XCircle
    message = "Your trial has expired."
    ctaLabel = "Subscribe to continue"
  } else if (daysLeft <= 3) {
    bgClass = "bg-red-600"
    textClass = "text-white"
    Icon = AlertTriangle
    message = `Your trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}! Don't lose your data.`
    ctaLabel = "Upgrade now"
  } else if (daysLeft <= 7) {
    bgClass = "bg-amber-500"
    textClass = "text-white"
    message = `Your trial ends in ${daysLeft} days. Upgrade to keep access.`
    Icon = AlertTriangle
    ctaLabel = "Upgrade now"
  } else {
    bgClass = "bg-blue-600"
    textClass = "text-white"
    Icon = Sparkles
    message = `You're on a free trial \u2014 ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`
    ctaLabel = "See plans"
  }

  return (
    <div className={`${bgClass} ${textClass} px-4 py-2 text-sm`}>
      <div className="flex items-center justify-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{message}</span>
        <Link
          href={billingPath}
          className="ml-1 font-semibold underline underline-offset-2 hover:no-underline"
        >
          {ctaLabel} &rarr;
        </Link>
      </div>
    </div>
  )
}
