import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();
  const hasToken = !!localStorage.getItem('accessToken');

  const { data, isLoading: queryLoading, error } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const { data } = await api.get('/users/me');
      return data.data;
    },
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
    // Match the bus/donors offline strategy so /users/me survives cold
    // offline launches: gcTime > maxAge of the persister, meta.persist true,
    // and offlineFirst so Workbox can answer from its NetworkFirst cache.
    gcTime: 30 * 24 * 60 * 60 * 1000,
    meta: { persist: true },
    networkMode: 'offlineFirst',
  });

  useEffect(() => {
    if (!hasToken) {
      if (isAuthenticated) logout();
      else setLoading(false);
      return;
    }

    if (data) {
      setUser(data);
      return;
    }

    // Log out only on genuine auth failures, since treating a network error that way strands users at /login after an offline launch.
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    if (status === 401 || status === 403) {
      logout();
    }
  }, [data, error, hasToken, setUser, setLoading, logout, isAuthenticated]);

  // Block rendering only on the initial check, letting a persisted user render immediately and reconcile in the background.
  const initialLoading = isLoading && !user && hasToken && queryLoading;

  return { user, isAuthenticated, isLoading: initialLoading, logout };
}
