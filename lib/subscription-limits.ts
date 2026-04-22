/**
 * Centralized subscription tier limits.
 * All enforcement logic references these constants.
 */

export const TIER_LIMITS = {
  TRIAL: {
    maxVehicles: 1,
    maxIngestionsPerVehicle: 1,
    maxChatMessagesPerDay: 25,
    maxUsers: 2,
    canWriteToPostgres: false, // only Pinecone + Neo4j during trial
  },
  STARTER: {
    maxVehicles: 10,
    maxIngestionsPerVehicle: Infinity,
    maxChatMessagesPerDay: Infinity,
    maxUsers: 10,
    canWriteToPostgres: false,
  },
  GROWTH: {
    maxVehicles: Infinity,
    maxIngestionsPerVehicle: Infinity,
    maxChatMessagesPerDay: Infinity,
    maxUsers: 50,
    canWriteToPostgres: false,
  },
  ENTERPRISE: {
    maxVehicles: Infinity,
    maxIngestionsPerVehicle: Infinity,
    maxChatMessagesPerDay: Infinity,
    maxUsers: Infinity,
    canWriteToPostgres: false,
  },
} as const

export type TierKey = keyof typeof TIER_LIMITS

/**
 * Resolve effective subscription status. Two ways an org can be EXPIRED:
 *   1. DB already stores `EXPIRED` (set by the Tier 5 data-freeze cron after
 *      trial + 3-day grace). Data has been wiped.
 *   2. DB stores `TRIAL` but `trialEndsAt` is in the past (expired but not
 *      yet wiped — we're inside the 3-day grace window).
 * Both collapse to `'EXPIRED'` here so downstream gates can treat them the
 * same. Callers that need to distinguish "wiped" from "grace" should check
 * `organization.dataFrozenAt` directly.
 */
export function resolveSubscriptionStatus(
  status: string,
  trialEndsAt: Date | null
): string {
  if (status === 'EXPIRED') return 'EXPIRED'
  if (status === 'TRIAL' && trialEndsAt && new Date() > trialEndsAt) {
    return 'EXPIRED'
  }
  return status
}

/**
 * Features that cost real money (external API calls, Pinecone reads,
 * LLM turns). Gated for EXPIRED orgs even if their data hasn't been wiped
 * yet — prevents a lapsed trial from continuing to burn Pinecone / OpenRouter
 * during the 3-day grace window.
 */
export function canUseExpensiveFeatures(
  status: string,
  trialEndsAt: Date | null,
): boolean {
  return resolveSubscriptionStatus(status, trialEndsAt) !== 'EXPIRED'
}

/**
 * Get the limits for a given tier+status combination.
 */
export function getTierLimits(tier: string, status: string) {
  if (status === 'TRIAL') {
    return TIER_LIMITS.TRIAL
  }
  return TIER_LIMITS[tier as TierKey] ?? TIER_LIMITS.STARTER
}
