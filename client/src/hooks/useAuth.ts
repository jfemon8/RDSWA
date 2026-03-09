import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const { data } = await api.get('/users/me');
      return data.data;
    },
    enabled: !!localStorage.getItem('accessToken'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data) {
      setUser(data);
    } else if (!queryLoading && !data && localStorage.getItem('accessToken')) {
      setLoading(false);
    } else if (!localStorage.getItem('accessToken')) {
      setLoading(false);
    }
  }, [data, queryLoading, setUser, setLoading]);

  return { user, isAuthenticated, isLoading: isLoading || queryLoading, logout };
}
