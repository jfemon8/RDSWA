import { Navigate, Outlet } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores/authStore';

export default function GuestGuard() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <PageSkeleton />
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
