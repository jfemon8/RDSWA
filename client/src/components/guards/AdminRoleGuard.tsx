import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';

interface AdminRoleGuardProps {
  minRole: UserRole;
  /** Optional scope-specific email list, from shared, denied even when the role check passes. */
  denyEmails?: string[];
  children: React.ReactNode;
}

/** Inline route guard that redirects to /admin when the role is too low or the email is in `denyEmails`. */
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
