import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';

interface AdminRoleGuardProps {
  minRole: UserRole;
  children: React.ReactNode;
}

/**
 * Inline role guard for individual admin routes.
 * Redirects to /admin if user's role is below the required minimum.
 */
export default function AdminRoleGuard({ minRole, children }: AdminRoleGuardProps) {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;

  const userIdx = ROLE_HIERARCHY.indexOf(user.role as UserRole);
  const requiredIdx = ROLE_HIERARCHY.indexOf(minRole);

  if (userIdx < requiredIdx) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
