'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

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
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthogClient = usePostHog()

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
      posthogClient.identify((session.user as any).id, {
        email: session.user.email,
        name: session.user.name,
        role: (session.user as any).role,
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
