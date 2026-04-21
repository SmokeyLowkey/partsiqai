"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, X } from "lucide-react"

type IntegrationAlert = {
  kind: "email_reauth"
  providerType: string
  emailAddress: string | null
  message: string
}

/**
 * Dashboard banner for integration-level alerts returned by /api/auth/me.
 * Today it only surfaces OAuth-token reauth (H16); structured as a list so
 * future alert kinds (Stripe portal expired, Vapi pool empty, etc.) can slot
 * in without another banner component.
 *
 * Per-session dismiss via sessionStorage so the alert returns after a fresh
 * login. We deliberately avoid persisting dismissal — the underlying state
 * is real and the user should be nudged again next session.
 */
export function IntegrationAlertsBanner() {
  const [alerts, setAlerts] = useState<IntegrationAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.integrationAlerts)) {
          setAlerts(data.integrationAlerts)
        }
      })
      .catch(() => {
        // Silent — this is a UX enhancement, not a critical path.
      })

    try {
      const stored = sessionStorage.getItem("integration-alerts-dismissed")
      if (stored) setDismissed(new Set(JSON.parse(stored)))
    } catch {}

    return () => {
      cancelled = true
    }
  }, [])

  const visible = alerts.filter((a) => !dismissed.has(alertKey(a)))
  if (visible.length === 0) return null

  const dismiss = (a: IntegrationAlert) => {
    const next = new Set(dismissed)
    next.add(alertKey(a))
    setDismissed(next)
    try {
      sessionStorage.setItem("integration-alerts-dismissed", JSON.stringify([...next]))
    } catch {}
  }

  return (
    <div className="flex flex-col gap-2 border-b bg-amber-50 px-4 py-3">
      {visible.map((a) => (
        <div key={alertKey(a)} className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-900">
              Email integration needs re-authorization
            </p>
            <p className="text-amber-800">
              {providerLabel(a.providerType)} ({a.emailAddress ?? "account"}) is no longer connected.
              Outgoing quote emails and inbox sync are paused until you reconnect.{" "}
              <Link
                href="/customer/settings"
                className="font-medium underline underline-offset-2 hover:text-amber-900"
              >
                Reconnect now
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(a)}
            aria-label="Dismiss"
            className="rounded p-1 text-amber-700 hover:bg-amber-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

function alertKey(a: IntegrationAlert): string {
  return `${a.kind}:${a.providerType}:${a.emailAddress ?? "none"}`
}

function providerLabel(p: string): string {
  if (p === "GMAIL_OAUTH") return "Gmail"
  if (p === "MICROSOFT_OAUTH") return "Microsoft 365"
  return p
}
