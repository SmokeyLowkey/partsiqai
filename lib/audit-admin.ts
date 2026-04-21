import type { NextRequest } from 'next/server';
import type { SecurityEventType } from '@prisma/client';
import { createAuditLog } from '@/lib/audit-log';
import { getClientIp } from '@/lib/rate-limit';

interface AdminAuditParams {
  /** The incoming Request — used to extract IP address and User-Agent. */
  req: Request;
  /**
   * Session for the actor performing the mutation. The wrapper guarantees a
   * session for authenticated routes; auth routes may pass a partial shape
   * after looking the user up themselves.
   */
  session: { user: { id: string; organizationId: string } } | null | undefined;
  eventType: SecurityEventType;
  /** One-line human-readable summary of what happened. */
  description: string;
  /** Any structured details that should be attached to the audit row. */
  metadata?: Record<string, unknown>;
  /**
   * Override the tenant being audited. Useful when a MASTER_ADMIN acts on
   * another org — the audit row is filed under that target org, not the
   * actor's own SYSTEM org.
   */
  targetOrganizationId?: string;
}

/**
 * One-call admin audit logger that extracts IP + User-Agent from the request
 * and writes to `SecurityAuditLog` via the existing `createAuditLog`. Never
 * throws — auditing must not break the mutation it wraps.
 */
export async function auditAdminAction(p: AdminAuditParams): Promise<void> {
  if (!p.session?.user) return;
  try {
    await createAuditLog({
      organizationId: p.targetOrganizationId ?? p.session.user.organizationId,
      eventType: p.eventType,
      userId: p.session.user.id,
      ipAddress: getClientIp(p.req as NextRequest),
      userAgent: p.req.headers.get('user-agent') ?? undefined,
      description: p.description,
      metadata: (p.metadata ?? {}) as Record<string, any>,
    });
  } catch (err) {
    // createAuditLog already swallows; the outer try/catch is defense-in-depth
    // so an unexpected throw here (e.g. getClientIp on a mocked Request in a
    // test) cannot propagate into the admin mutation path.
    console.error('[auditAdminAction] failed:', err);
  }
}
