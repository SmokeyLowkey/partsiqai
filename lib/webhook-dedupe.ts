import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Attempt to claim a webhook as "about to be processed" by inserting a row
 * into `processed_webhooks`. Returns `true` if this is the first time we've
 * seen the event and the caller should run the side-effects; returns `false`
 * if the event was already recorded (duplicate delivery, retry, or replay).
 *
 * Usage:
 *   const fresh = await claimWebhook('stripe', event.id);
 *   if (!fresh) return NextResponse.json({ ok: true }); // idempotent 200
 *   // ... run side-effects
 *
 * Why this shape:
 *   - One DB round-trip on success; one exception-round-trip on duplicate.
 *     Using the unique-violation code (P2002) as the duplicate signal keeps
 *     the check-and-insert atomic (no TOCTOU between SELECT and INSERT).
 *   - `source` scopes the id namespace so a numeric id from one provider
 *     can't collide with an identical id from another.
 */
export async function claimWebhook(source: string, externalId: string): Promise<boolean> {
  try {
    await prisma.processedWebhook.create({
      data: { source, externalId },
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Unique constraint violation on (source, externalId) — already processed.
      return false;
    }
    // Real error (DB down, etc). Fail closed: re-raise so the webhook returns
    // 5xx and the provider retries. Silent-pass would risk missed events.
    throw err;
  }
}
