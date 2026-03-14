import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();
  const hasToken = !!localStorage.getItem('accessToken');

  const { data, isLoading: queryLoading, isError } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const { data } = await api.get('/users/me');
      return data.data;
    },
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!hasToken) {
      if (isAuthenticated) logout();
      else setLoading(false);
      return;
    }

    if (data) {
      setUser(data);
    } else if (isError) {
      logout();
    }
  }, [data, isError, hasToken, setUser, setLoading, logout, isAuthenticated]);

  // Only block rendering on initial auth check, not background refetches
  const initialLoading = isLoading && !user && hasToken && queryLoading;

  return { user, isAuthenticated, isLoading: initialLoading, logout };
}
