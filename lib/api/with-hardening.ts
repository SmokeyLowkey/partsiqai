import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin } from '@/lib/csrf';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getServerSession } from '@/lib/auth';
import type { UserRole } from '@prisma/client';

/**
 * Composition wrapper for route handlers that applies the four gates every
 * mutating API route should have:
 *
 *   1. Origin / CSRF check (see lib/csrf.ts)
 *   2. Session requirement (middleware already handles most of this, but the
 *      wrapper re-checks so handler code can rely on `session.user` being set
 *      without manual null checks on every call site)
 *   3. Role gate — optional, for routes that aren't under /api/admin
 *   4. Rate limit — keyed by user+org by default, with per-route prefix
 *
 * Usage:
 *   export const POST = withHardening(
 *     {
 *       rateLimit: { limit: 10, windowSeconds: 60, prefix: 'quote-approve' },
 *       roles: ['MANAGER', 'ADMIN', 'MASTER_ADMIN'],
 *     },
 *     async (req, ctx) => {
 *       // handler code — session is guaranteed, role is verified, rate limit is enforced
 *     }
 *   )
 *
 * Deliberate omissions:
 *   - Per-tenant org scoping (handler responsibility — the wrapper can't know
 *     the shape of the resource being mutated).
 *   - Zod body validation (handler responsibility — schemas are route-specific).
 *   - Audit logging (handler responsibility — the event name and payload vary).
 */

// Generic over the request subclass so callers can annotate their handler as
// `Request` (standard Fetch) or `NextRequest` (Next.js-specific) and the
// wrapper's return type mirrors whatever they picked. Next.js always supplies
// NextRequest at runtime; guards inside the wrapper cast where needed.
type RouteHandler<Req extends Request = Request> = (
  req: Req,
  ctx?: any
) => Promise<Response> | Response;

export interface RateLimitOptions {
  /** Maximum requests per window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
  /**
   * Key composition — controls how rate-limit buckets are keyed.
   *   'userOrg' (default): `${prefix}:u:${userId}:o:${orgId}` — fair per-user per-org.
   *   'user':             `${prefix}:u:${userId}`              — fair per-user across orgs.
   *   'org':              `${prefix}:o:${orgId}`               — shared quota per org.
   *   'ip':               `${prefix}:ip:${ip}`                 — pre-auth routes only.
   */
  keyBy?: 'user' | 'org' | 'userOrg' | 'ip';
  /** Prefix distinguishes one route's bucket from another. Required so two routes don't share a counter. */
  prefix: string;
}

export interface HardenOptions {
  /** Enforce Origin header matches app origin. Default: true. Set false only for webhook-style endpoints. */
  csrf?: boolean;
  /** Require a valid session. Default: true. */
  requireSession?: boolean;
  /**
   * Role gate. If set, the session user's role must be in this list.
   * Middleware already enforces admin-vs-customer for /api/admin prefix, so
   * this is mainly for finer role distinctions inside customer routes
   * (e.g. MANAGER+ for quote approvals).
   */
  roles?: UserRole[];
  /** Apply a rate limit. No default — set only when the route needs one. */
  rateLimit?: RateLimitOptions;
}

export function withHardening<Req extends Request = Request>(
  opts: HardenOptions,
  handler: RouteHandler<Req>
): RouteHandler<Req> {
  const csrf = opts.csrf ?? true;
  const requireSession = opts.requireSession ?? true;

  return async (req: Req, ctx?: any) => {
    // 1. CSRF / origin check.
    if (csrf) {
      const blocked = checkOrigin(req as unknown as NextRequest);
      if (blocked) return blocked;
    }

    // 2. Session check. Middleware already does this for protected paths but
    // keeping it here lets handlers rely on session without per-route null checks
    // and makes the wrapper safe to use on routes that middleware exempts.
    let session: Awaited<ReturnType<typeof getServerSession>> = null;
    if (requireSession || opts.roles || opts.rateLimit?.keyBy !== 'ip') {
      session = await getServerSession();
      if (requireSession && !session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // 3. Role gate.
    if (opts.roles && opts.roles.length > 0) {
      if (!session?.user?.role || !opts.roles.includes(session.user.role as UserRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // 4. Rate limit.
    if (opts.rateLimit) {
      const identifier = buildRateLimitKey(opts.rateLimit, session, req);
      const result = await checkRateLimit(identifier, {
        limit: opts.rateLimit.limit,
        windowSeconds: opts.rateLimit.windowSeconds,
      });
      if (!result.success) return result.response as Response;
    }

    return handler(req, ctx);
  };
}

function buildRateLimitKey(
  opts: RateLimitOptions,
  session: Awaited<ReturnType<typeof getServerSession>>,
  req: Request
): string {
  const keyBy = opts.keyBy ?? 'userOrg';
  const userId = session?.user?.id ?? 'anon';
  const orgId = session?.user?.organizationId ?? 'none';

  switch (keyBy) {
    case 'user':
      return `${opts.prefix}:u:${userId}`;
    case 'org':
      return `${opts.prefix}:o:${orgId}`;
    case 'ip':
      return `${opts.prefix}:ip:${getClientIp(req as unknown as NextRequest)}`;
    case 'userOrg':
    default:
      return `${opts.prefix}:u:${userId}:o:${orgId}`;
  }
}
