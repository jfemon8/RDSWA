import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole, ROLE_HIERARCHY, RESTRICTED_SUPER_ADMINS } from '@rdswa/shared';

interface AdminRoleGuardProps {
  minRole: UserRole;
  /** Block restricted SuperAdmins (e.g. from Settings/Backup pages) */
  denyRestricted?: boolean;
  children: React.ReactNode;
}

/**
 * Inline role guard for individual admin routes.
 * Redirects to /admin if user's role is below the required minimum
 * or if the user is a restricted SuperAdmin on a protected page.
 */
export default function AdminRoleGuard({ minRole, denyRestricted, children }: AdminRoleGuardProps) {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;

  const userIdx = ROLE_HIERARCHY.indexOf(user.role as UserRole);
  const requiredIdx = ROLE_HIERARCHY.indexOf(minRole);

  if (userIdx < requiredIdx) {
    return <Navigate to="/admin" replace />;
  }

  if (denyRestricted && user.email && RESTRICTED_SUPER_ADMINS.includes(user.email)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
