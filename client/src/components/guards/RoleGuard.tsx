import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';
import Spinner from '@/components/ui/Spinner';

interface RoleGuardProps {
  requiredRole: UserRole;
}

export default function RoleGuard({ requiredRole }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="md" />
      </div>
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
