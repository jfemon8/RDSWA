import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSessionCacheReset } from '@/hooks/useSessionCacheReset';
import { useAuthStore } from '@/stores/authStore';

const clearPersisted = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/queryPersister', () => ({
  clearPersistedQueries: () => clearPersisted(),
  persistOptions: {},
}));

const KEY = ['settings'];

function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(KEY, { cached: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  renderHook(() => useSessionCacheReset(), { wrapper });
  return queryClient;
}

const signIn = (id: string) =>
  act(() => { useAuthStore.setState({ user: { _id: id } as any, isAuthenticated: true, isLoading: false }); });
const signOut = () =>
  act(() => { useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false }); });

beforeEach(() => {
  clearPersisted.mockClear();
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
});

describe('useSessionCacheReset', () => {
  it('keeps the cache on a plain page load, when nobody has signed in or out', () => {
    const qc = setup();
    expect(qc.getQueryData(KEY)).toEqual({ cached: true });
  });

  it('drops responses cached before sign-in, which may be the stripped public shape', () => {
    const qc = setup();
    signIn('user-1');
    expect(qc.getQueryData(KEY)).toBeUndefined();
  });

  it('drops the previous user data on sign-out, so the next person cannot read it', () => {
    useAuthStore.setState({ user: { _id: 'user-1' } as any, isAuthenticated: true, isLoading: false });
    const qc = setup();
    signOut();
    expect(qc.getQueryData(KEY)).toBeUndefined();
  });

  it('clears the persisted copy too, since IndexedDB outlives the tab', () => {
    setup();
    signIn('user-1');
    expect(clearPersisted).toHaveBeenCalled();
  });

  it('clears when one account is swapped for another', () => {
    useAuthStore.setState({ user: { _id: 'user-1' } as any, isAuthenticated: true, isLoading: false });
    const qc = setup();
    signIn('user-2');
    expect(qc.getQueryData(KEY)).toBeUndefined();
  });

  it('leaves the cache alone when the same identity re-renders', () => {
    useAuthStore.setState({ user: { _id: 'user-1' } as any, isAuthenticated: true, isLoading: false });
    const qc = setup();
    signIn('user-1');
    expect(qc.getQueryData(KEY)).toEqual({ cached: true });
  });
});
