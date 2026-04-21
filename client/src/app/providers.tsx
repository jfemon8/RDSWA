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
                {children}
              </AuthInitializer>
            </ConfirmProvider>
          </ToastProvider>
        </BrowserRouter>
      </PersistQueryClientProvider>
    </HelmetProvider>
  );
}
