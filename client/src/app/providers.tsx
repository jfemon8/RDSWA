import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmModal';
import { useDynamicSiteMeta } from '@/hooks/useDynamicSiteMeta';
import ScrollToTop from '@/components/ScrollToTop';
import Spinner from '@/components/ui/Spinner';

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

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ScrollToTop />
          <ToastProvider>
            <ConfirmProvider>
              <AuthInitializer>
                <DynamicSiteMeta />
                {children}
              </AuthInitializer>
            </ConfirmProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
