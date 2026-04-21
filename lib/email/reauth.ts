import { prisma } from '@/lib/prisma';
import { workerLogger } from '@/lib/logger';

const log = workerLogger.child({ module: 'email-reauth' });

// Regex that matches the most common revoked/expired-token error surfaces we
// see from Google OAuth, Microsoft Graph, and SMTP providers. We check the
// message text because the SDKs don't expose a typed error code for this
// class of failure — and a 401 alone isn't enough signal (could be a network
// blip). These strings are the durable, "human does not need to re-auth"
// vs "they must re-consent" distinction.
const REAUTH_SIGNALS = [
  'invalid_grant',              // Google OAuth: consent revoked, pwd changed
  'token has been expired or revoked',
  'AADSTS70008',                // Microsoft: token expired from inactivity
  'AADSTS50173',                // Microsoft: token revoked after pwd change
  'AADSTS700082',               // Microsoft: refresh token inactive >90d
  'interaction_required',       // Microsoft: new consent needed
  'invalid_request',            // Sometimes returned on revoked Google tokens
];

/** Heuristic — does this error indicate the user must re-authorize? */
export function isOAuthReauthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return REAUTH_SIGNALS.some((s) => msg.includes(s));
}

/**
 * Mark a user's email integration as needing re-authorization. Flips
 * `isActive = false` so workers stop picking it up, records the reason on
 * `errorMessage` so the dashboard banner can show something actionable, and
 * sets `testStatus = FAILED` so the admin UI already surfaces it correctly.
 *
 * Called from any place that catches `invalid_grant` / equivalent. The
 * worker paths then short-circuit on next run; the user sees a banner from
 * /api/auth/me telling them to reconnect.
 */
export async function markEmailIntegrationNeedsReauth(
  userId: string,
  reason: string
): Promise<void> {
  try {
    const updated = await prisma.userEmailIntegration.updateMany({
      where: { userId, isActive: true },
      data: {
        isActive: false,
        testStatus: 'FAILED',
        errorMessage: `Reauth required: ${reason.slice(0, 500)}`,
        lastTestedAt: new Date(),
      },
    });
    if (updated.count > 0) {
      log.warn({ userId, reason: reason.slice(0, 200) }, 'Flagged email integration as needing re-auth');
    }
  } catch (err: any) {
    log.error({ userId, err: err?.message }, 'Failed to mark integration reauth-required');
  }
}
