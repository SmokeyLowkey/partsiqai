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
 * Resolve effective subscription status. If TRIAL and trialEndsAt is in the past,
 * treat as CANCELLED (expired).
 */
export function resolveSubscriptionStatus(
  status: string,
  trialEndsAt: Date | null
): string {
  if (status === 'TRIAL' && trialEndsAt && new Date() > trialEndsAt) {
    return 'EXPIRED'
  }
  return status
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
