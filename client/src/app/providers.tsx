import { QueryClient } from '@tanstack/react-query';
import { PageSkeleton } from '@/components/ui/Skeleton';
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
import { persistOptions } from '@/lib/queryPersister';
import { useSessionCacheReset } from '@/hooks/useSessionCacheReset';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      // 'offlineFirst' lets the queryFn run so Workbox can answer it, whereas the default aborts the fetch while offline.
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
      <PageSkeleton />
    );
  }

  return <>{children}</>;
}

/** Null-rendering component that keeps the document head in sync with dynamic SiteSettings on every page. */
function DynamicSiteMeta() {
  useDynamicSiteMeta();
  return null;
}

/** Null-rendering component that injects the admin-configured brand palette as CSS variable overrides. */
function BrandColorsApplier() {
  useBrandColors();
  return null;
}

/** Keeps the MessageBell badge and any mounted chat list in sync while the user is away from the group's page. */
function GroupActivityListener() {
  useGroupActivitySocket();
  return null;
}

function SessionCacheReset() {
  useSessionCacheReset();
  return null;
}

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <HelmetProvider>
      {/* PersistQueryClientProvider hydrates the query cache from IndexedDB before children render, and only queries marked `meta: { persist: true }` are stored. */}
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <BrowserRouter>
          <ScrollToTop />
          <ToastProvider>
            <ConfirmProvider>
              <AuthInitializer>
                <SessionCacheReset />
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
