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
} as const

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  if (typeof window !== 'undefined') {
    posthog.capture(event, properties)
  }
}
