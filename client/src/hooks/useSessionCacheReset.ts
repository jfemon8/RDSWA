import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { clearPersistedQueries } from '@/lib/queryPersister';

/** Drops every cached response when the signed-in identity changes, since many endpoints answer differently per role. */
export function useSessionCacheReset(): void {
  const userId = useAuthStore((s) => s.user?._id ?? null);
  const queryClient = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // The first run only records who is already signed in, so a normal page load keeps its cache.
    if (previous.current === undefined) {
      previous.current = userId;
      return;
    }
    if (previous.current === userId) return;

    previous.current = userId;
    queryClient.clear();
    clearPersistedQueries().catch(() => undefined);
  }, [userId, queryClient]);
}
