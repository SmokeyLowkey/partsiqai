"use client"

import Link from "next/link"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"
import type { ReactNode } from "react"

type AnalyticsEventName = typeof AnalyticsEvents[keyof typeof AnalyticsEvents]

interface TrackedCTAProps {
  href: string
  event: AnalyticsEventName
  properties?: Record<string, unknown>
  className?: string
  children: ReactNode
}

/**
 * Client-side <Link> wrapper that fires a PostHog event on click.
 * Use from server components where you need conversion tracking on a CTA.
 */
export function TrackedCTA({
  href,
  event,
  properties,
  className,
  children,
}: TrackedCTAProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent(event, { href, ...properties })}
    >
      {children}
    </Link>
  )
}
