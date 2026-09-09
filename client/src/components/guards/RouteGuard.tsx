import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores/authStore';

export default function RouteGuard() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <PageSkeleton />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
