import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';

export class JobAuthorizationError extends Error {
  readonly kind: 'tenant_missing' | 'user_missing' | 'role_insufficient' | 'user_inactive';
  constructor(kind: JobAuthorizationError['kind'], message: string) {
    super(message);
    this.name = 'JobAuthorizationError';
    this.kind = kind;
  }
}

const ROLE_ORDER: Record<UserRole, number> = {
  USER: 0,
  TECHNICIAN: 1,
  MANAGER: 2,
  ADMIN: 3,
  MASTER_ADMIN: 4,
};

function hasAtLeastRole(role: UserRole, min: UserRole): boolean {
  return ROLE_ORDER[role] >= ROLE_ORDER[min];
}

export interface VerifyJobAuthOptions {
  /** Organization the job claims to operate on. Re-fetched to confirm it exists. */
  organizationId: string;
  /**
   * User who enqueued the job. If provided, we re-load them and confirm the
   * account is still active — catches role-downgrade / deactivation between
   * enqueue and process, which is the failure mode the original audit flagged
   * for the Tier 3.1 outbox pipeline.
   */
  initiatedById?: string;
  /** Minimum role the initiator must still hold at process time. */
  requiredRole?: UserRole;
}

/**
 * Re-verify that a background job's claimed actor is still allowed to
 * perform it. Call at the top of every worker that takes `organizationId`
 * (and ideally `userId`) as job data. Why:
 *
 *   - Enqueuer might have been deactivated or role-downgraded since enqueue.
 *     Example: admin triggers a catalog ingestion, gets demoted 30s later,
 *     job runs 2m after that. Without this check the downgrade is ignored.
 *   - Prevents a future code path from enqueuing jobs on behalf of
 *     organizations that don't exist (typo, stale foreign key).
 *
 * Throws JobAuthorizationError on any failure so the BullMQ wrapper can
 * distinguish "should not retry this" from transient errors.
 */
export async function verifyJobAuthorization(opts: VerifyJobAuthOptions): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: { id: true },
  });
  if (!org) {
    throw new JobAuthorizationError(
      'tenant_missing',
      `Organization ${opts.organizationId} not found — job rejected`
    );
  }

  if (!opts.initiatedById) return;

  const user = await prisma.user.findUnique({
    where: { id: opts.initiatedById },
    select: { id: true, role: true, isActive: true, organizationId: true },
  });
  if (!user) {
    throw new JobAuthorizationError(
      'user_missing',
      `Initiating user ${opts.initiatedById} not found — job rejected`
    );
  }
  if (!user.isActive) {
    throw new JobAuthorizationError(
      'user_inactive',
      `Initiating user ${opts.initiatedById} is deactivated — job rejected`
    );
  }
  if (opts.requiredRole && !hasAtLeastRole(user.role, opts.requiredRole)) {
    throw new JobAuthorizationError(
      'role_insufficient',
      `User ${opts.initiatedById} role ${user.role} is below required ${opts.requiredRole} — job rejected`
    );
  }
}
