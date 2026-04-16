import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';

interface AdminRoleGuardProps {
  minRole: UserRole;
  /**
   * Optional list of emails to deny even if they otherwise meet the role.
   * Pass scope-specific lists from shared (e.g. BACKUP_RESTRICTED_SUPER_ADMINS).
   */
  denyEmails?: string[];
  children: React.ReactNode;
}

/**
 * Inline role guard for individual admin routes.
 * Redirects to /admin if user's role is below the required minimum
 * or if the user's email is in the denyEmails list.
 */
export default function AdminRoleGuard({ minRole, denyEmails, children }: AdminRoleGuardProps) {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;

  const userIdx = ROLE_HIERARCHY.indexOf(user.role as UserRole);
  const requiredIdx = ROLE_HIERARCHY.indexOf(minRole);

  if (userIdx < requiredIdx) {
    return <Navigate to="/admin" replace />;
  }

  if (denyEmails && user.email && denyEmails.includes(user.email)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
