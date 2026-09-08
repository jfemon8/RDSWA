import { lazy, Suspense } from 'react';
import Providers from './providers';
import AppRouter from './router';
import ErrorBoundary from '@/components/ErrorBoundary';

// Imported lazily rather than gated at render, because a static import would still run the module
// and inject its script in dev, where Speed Insights throws on performance entries a dev page lacks.
const isProduction = import.meta.env.PROD;

const Analytics = lazy(() =>
  import('@vercel/analytics/react').then((m) => ({ default: m.Analytics }))
);
const SpeedInsights = lazy(() =>
  import('@vercel/speed-insights/react').then((m) => ({ default: m.SpeedInsights }))
);

export default function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <AppRouter />
      </Providers>
      {isProduction && (
        <Suspense fallback={null}>
          <Analytics />
          <SpeedInsights />
        </Suspense>
      )}
    </ErrorBoundary>
  );
}
