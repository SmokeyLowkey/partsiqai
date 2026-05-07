'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { isInternalUser, setInternalUser } from '@/lib/analytics'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    // Route through same-origin /ingest proxy (see next.config.mjs rewrites)
    // so ad-blockers targeting *.posthog.com don't drop events/recordings.
    api_host: '/ingest',
    // ui_host keeps "view in PostHog" links pointing at the real dashboard.
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: false,
    session_recording: {
      // Mask all form inputs by default — B2B app with credentials + PII.
      maskAllInputs: true,
      // Opt-in element masking: add data-ph-mask to anything else to hide.
      maskTextSelector: '[data-ph-mask]',
    },
  })

  // Self-traffic exclusion: if this browser was previously flagged as
  // belonging to an internal user (PartsIQ team / dev), opt out of capture
  // immediately at init — before any pageview event fires. Otherwise our
  // own QA traffic pollutes "frustrating pages", funnels, and retention.
  if (isInternalUser()) {
    posthog.opt_out_capturing()
  }
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthogClient = usePostHog()

  // URL-flag escape hatch: visiting any page with `?ph_internal=1` flips
  // this browser into internal-user mode and persists across sessions.
  // `?ph_internal=0` clears it. Lets us mark dev / QA browsers without
  // having to log in first.
  useEffect(() => {
    const flag = searchParams.get('ph_internal')
    if (flag === '1') setInternalUser(true)
    else if (flag === '0') setInternalUser(false)
  }, [searchParams])

  useEffect(() => {
    if (pathname && posthogClient) {
      let url = window.origin + pathname
      const params = searchParams.toString()
      if (params) {
        url = url + '?' + params
      }
      posthogClient.capture('$pageview', {
        $current_url: url,
        $pathname: pathname,
      })
    }
  }, [pathname, searchParams, posthogClient])

  return null
}

function PostHogIdentify() {
  const { data: session, status } = useSession()
  const posthogClient = usePostHog()

  useEffect(() => {
    if (status === 'authenticated' && session?.user && posthogClient) {
      const role = (session.user as any).role

      // Auto-flag internal users: any MASTER_ADMIN sign-in marks this
      // browser as internal for all future visits, even when signed out.
      // This is how we keep our own QA / dev traffic from showing up as
      // "frustrating pages" or polluting retention cohorts.
      if (role === 'MASTER_ADMIN') {
        setInternalUser(true)
        posthogClient.opt_out_capturing()
        return
      }

      posthogClient.identify((session.user as any).id, {
        email: session.user.email,
        name: session.user.name,
        role,
        organizationId: (session.user as any).organizationId,
        subscriptionStatus: (session.user as any).subscriptionStatus,
      })
    } else if (status === 'unauthenticated' && posthogClient) {
      posthogClient.reset()
    }
  }, [session, status, posthogClient])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  )
}
