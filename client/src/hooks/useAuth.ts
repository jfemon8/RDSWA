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

    // Only force logout on genuine auth failures. A network error (no
    // response, or a Workbox-served failure) must NOT log the user out —
    // otherwise every cold offline launch silently clears the access token
    // and the user is stranded at /login the next time they come online.
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    if (status === 401 || status === 403) {
      logout();
    }
  }, [data, error, hasToken, setUser, setLoading, logout, isAuthenticated]);

  // Only block rendering on initial auth check, not background refetches.
  // If we already have a persisted user from the Zustand store, don't block
  // — let the app render and reconcile in the background.
  const initialLoading = isLoading && !user && hasToken && queryLoading;

  return { user, isAuthenticated, isLoading: initialLoading, logout };
}
