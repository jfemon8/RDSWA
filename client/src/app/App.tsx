import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Providers from './providers';
import AppRouter from './router';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <AppRouter />
      </Providers>
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  );
}
