import { getServerSession } from '@/lib/auth';

export type Permission =
  | 'vehicle:create'
  | 'vehicle:read'
  | 'vehicle:update'
  | 'vehicle:delete'
  | 'vehicle:configure_search' // Admin-only
  | 'vehicle:verify_mapping'; // Admin-only

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  MASTER_ADMIN: [
    'vehicle:create',
    'vehicle:read',
    'vehicle:update',
    'vehicle:delete',
    'vehicle:configure_search',
    'vehicle:verify_mapping',
  ],
  ADMIN: [
    'vehicle:create',
    'vehicle:read',
    'vehicle:update',
    'vehicle:delete',
    'vehicle:configure_search',
    'vehicle:verify_mapping',
  ],
  MANAGER: [
    'vehicle:create',
    'vehicle:read',
    'vehicle:update',
    'vehicle:delete',
    // NO configure_search or verify_mapping
  ],
  TECHNICIAN: [
    'vehicle:create',
    'vehicle:read',
    'vehicle:update',
    // NO delete, configure_search or verify_mapping
  ],
  USER: [
    'vehicle:create',
    'vehicle:read',
    'vehicle:update',
    'vehicle:delete',
    // NO configure_search or verify_mapping
  ],
};

export async function checkPermission(
  permission: Permission,
  userId?: string
): Promise<boolean> {
  const session = await getServerSession();
  if (!session?.user) return false;

  const userPermissions = ROLE_PERMISSIONS[session.user.role] || [];

  // Check if user has permission
  if (!userPermissions.includes(permission)) {
    return false;
  }

  // Additional check: if userId provided, ensure user owns the resource
  if (userId && session.user.id !== userId && !['ADMIN', 'MASTER_ADMIN'].includes(session.user.role)) {
    return false;
  }

  return true;
}

export async function requirePermission(permission: Permission) {
  const hasPermission = await checkPermission(permission);
  if (!hasPermission) {
    throw new Error(`Unauthorized: Missing permission ${permission}`);
  }
}

export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession();
  return session?.user?.role === 'ADMIN' || session?.user?.role === 'MASTER_ADMIN';
}
