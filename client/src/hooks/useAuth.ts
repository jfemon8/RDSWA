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
    enabled: hasToken && !isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!hasToken) {
      setLoading(false);
      return;
    }

    if (data) {
      setUser(data);
    } else if (isError) {
      logout();
    }
  }, [data, isError, hasToken, setUser, setLoading, logout]);

  return { user, isAuthenticated, isLoading: isLoading && (queryLoading || hasToken), logout };
}
