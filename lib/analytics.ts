import posthog from 'posthog-js'

export const AnalyticsEvents = {
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  SIGNUP_FAILED: 'signup_failed',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  QUOTE_REQUEST_CREATED: 'quote_request_created',
  AI_CHAT_SESSION_STARTED: 'ai_chat_session_started',
  AI_CHAT_MESSAGE_SENT: 'ai_chat_message_sent',
  SETTINGS_UPDATED: 'settings_updated',
  // Product activation funnel — the events that tell us whether trial users
  // are actually getting value (added 2026-05). Map to: signup → vehicle →
  // ingestion → first AI chat → first quote. These are the milestones a
  // funnel should track to find drop-off in the trial experience.
  VEHICLE_ADDED: 'vehicle_added',
  INGESTION_UPLOADED: 'ingestion_uploaded',
  INGESTION_COMPLETED: 'ingestion_completed',
  QUOTE_REQUEST_SENT: 'quote_request_sent',
  ORDER_CREATED: 'order_created',
  // Onboarding tour funnel — fires from ProductTourModal so we can see
  // whether the tour delivers value or gets skipped, and where users drop
  // off mid-tour (which frame loses them?).
  PRODUCT_TOUR_VIEWED: 'product_tour_viewed',
  PRODUCT_TOUR_FRAME_VIEWED: 'product_tour_frame_viewed',
  PRODUCT_TOUR_COMPLETED: 'product_tour_completed',
  PRODUCT_TOUR_SKIPPED: 'product_tour_skipped',
  // AI chat first-engagement funnel — measures whether the suggestion chips
  // we added to the empty state actually drive conversation versus the
  // user typing their own first message (or bouncing).
  AI_CHAT_OPENED: 'ai_chat_opened',
  AI_CHAT_SUGGESTION_CLICKED: 'ai_chat_suggestion_clicked',
  // Marketing funnel
  CTA_CLICKED: 'cta_clicked',
  PRICING_PLAN_SELECTED: 'pricing_plan_selected',
  DEMO_REQUESTED: 'demo_requested',
  CONTACT_SALES_CLICKED: 'contact_sales_clicked',
  // Blog / lead capture
  LEAD_CAPTURE_VIEWED: 'lead_capture_viewed',
  LEAD_CAPTURE_SUBMITTED: 'lead_capture_submitted',
  LEAD_CAPTURE_SUCCESS: 'lead_capture_success',
  LEAD_CAPTURE_FAILED: 'lead_capture_failed',
  // Homepage hero funnel
  HERO_SCROLLED_PAST: 'hero_scrolled_past',
} as const

const INTERNAL_USER_LS_KEY = 'partsiq_internal_user'

/**
 * Mark this browser as belonging to an internal user (PartsIQ team / dev).
 * Once flagged, the PostHog provider opts out of capturing for this browser
 * across all subsequent visits — even before login. Triggered automatically
 * when a MASTER_ADMIN signs in (see PostHogIdentify) or via the dev-only
 * URL flag `?ph_internal=1`. Clear with `?ph_internal=0`.
 */
export function isInternalUser(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(INTERNAL_USER_LS_KEY) === 'true'
  } catch {
    return false
  }
}

export function setInternalUser(flag: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (flag) {
      window.localStorage.setItem(INTERNAL_USER_LS_KEY, 'true')
      posthog.opt_out_capturing()
    } else {
      window.localStorage.removeItem(INTERNAL_USER_LS_KEY)
      posthog.opt_in_capturing()
    }
  } catch {
    // localStorage can be blocked; do nothing rather than break the page
  }
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  if (typeof window !== 'undefined') {
    posthog.capture(event, properties)
  }
}
