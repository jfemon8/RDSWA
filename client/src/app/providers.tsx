import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmModal';
import { useDynamicSiteMeta } from '@/hooks/useDynamicSiteMeta';
import { useBrandColors } from '@/hooks/useBrandColors';
import { useGroupActivitySocket } from '@/hooks/useSocket';
import ScrollToTop from '@/components/ScrollToTop';
import Spinner from '@/components/ui/Spinner';
import { persistOptions } from '@/lib/queryPersister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      // Critical for PWA + service-worker caching. Default 'online' mode
      // aborts the fetch entirely when navigator.onLine is false, which
      // prevents Workbox from ever seeing the request and serving its
      // cached response. 'offlineFirst' lets the queryFn run once so the
      // SW can intercept; retries are paused only on a genuine cache miss.
      // See https://tkdodo.eu/blog/offline-react-query.
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

/** Initializes auth state from stored token on app load */
function AuthInitializer({ children }: { children: ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  return <>{children}</>;
}

/** Null-rendering component that keeps <head> (favicon, title, meta description) in
 *  sync with dynamic SiteSettings on every page. See useDynamicSiteMeta for rationale. */
function DynamicSiteMeta() {
  useDynamicSiteMeta();
  return null;
}

/** Null-rendering component that injects the admin-configured brand palette as
 *  CSS variable overrides. See useBrandColors for the precedence rules. */
function BrandColorsApplier() {
  useBrandColors();
  return null;
}

/** Null-rendering listener for group chat activity across the whole app so
 *  the MessageBell badge + any mounted chat-list view stay in sync even when
 *  the user isn't currently on the group's chat page. */
function GroupActivityListener() {
  useGroupActivitySocket();
  return null;
}

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <HelmetProvider>
      {/* PersistQueryClientProvider hydrates the query cache from IndexedDB
          on mount (before children render) and then persists subsequent
          writes. Queries opt in via `meta: { persist: true }` — see
          lib/queryPersister.ts. */}
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <BrowserRouter>
          <ScrollToTop />
          <ToastProvider>
            <ConfirmProvider>
              <AuthInitializer>
                <DynamicSiteMeta />
                <BrandColorsApplier />
                <GroupActivityListener />
                {children}
              </AuthInitializer>
            </ConfirmProvider>
          </ToastProvider>
        </BrowserRouter>
      </PersistQueryClientProvider>
    </HelmetProvider>
  );
}
