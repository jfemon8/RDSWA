import * as Sentry from '@sentry/node';
import { env } from './env';

let initialized = false;

/**
 * Initialize Sentry error tracking.
 * Only initializes if SENTRY_DSN is set in environment variables.
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    console.log('Sentry DSN not configured — skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });

  initialized = true;
  console.log(`Sentry initialized for ${env.NODE_ENV} environment`);
}

/**
 * Capture an exception in Sentry.
 * Only sends if Sentry has been initialized.
 */
export function captureException(err: Error): void {
  if (initialized) {
    Sentry.captureException(err);
  }
}
