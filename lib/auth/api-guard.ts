import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { UserRole } from '@prisma/client';

/**
 * Shared API route authentication guard.
 * Returns the session if authenticated, or a 401 NextResponse if not.
 */
export async function requireAuth() {
  const session = await getServerSession();

  if (!session?.user?.id || !session?.user?.organizationId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { session };
}

/**
 * Requires authentication + one of the specified roles.
 * Returns the session if authorized, or a 401/403 NextResponse if not.
 */
export async function requireRole(roles: UserRole[]) {
  const result = await requireAuth();
  if ('error' in result) return result;

  if (!roles.includes(result.session.user.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session: result.session };
}

/**
 * Requires MASTER_ADMIN or ADMIN role.
 */
export async function requireAdmin() {
  return requireRole(['MASTER_ADMIN', 'ADMIN']);
}

/**
 * Requires MASTER_ADMIN role only.
 */
export async function requireMasterAdmin() {
  return requireRole(['MASTER_ADMIN']);
}
