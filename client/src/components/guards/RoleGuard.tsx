import { Navigate, Outlet } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores/authStore';
import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';

interface RoleGuardProps {
  requiredRole: UserRole;
}

export default function RoleGuard({ requiredRole }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <PageSkeleton />
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role as UserRole);
  const requiredRoleIndex = ROLE_HIERARCHY.indexOf(requiredRole);

  if (userRoleIndex < requiredRoleIndex) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
