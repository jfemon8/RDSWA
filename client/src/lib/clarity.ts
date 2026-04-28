/**
 * Thin wrapper around the Microsoft Clarity browser tracker.
 *
 * Clarity is bootstrapped by the env-gated snippet in index.html, which
 * exposes itself as `window.clarity`. When the project ID env var is
 * unset (local dev), the snippet doesn't run — `window.clarity` is
 * undefined. Every helper here checks for that undefined case and exits
 * silently, so call sites can fire-and-forget without guarding each call.
 *
 * Why this wrapper:
 *   1. Centralised type safety — Clarity's runtime is `(...args: any[])`,
 *      so a wrapper catches typos at compile time.
 *   2. Single place to disable/redirect tracking (e.g. GDPR opt-out toggle
 *      down the line).
 *   3. SSR-safe — `window` doesn't exist during the static-route prerender
 *      step, so every helper guards on `typeof window`.
 *
 * SPA route changes don't need any manual ping — Clarity hooks the History
 * API (pushState/replaceState/popstate) automatically, so React Router
 * navigations are picked up and counted as new pages.
 */

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
  }
}

export const CLARITY_PROJECT_ID: string =
  (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined) || '';

export const isClarityEnabled = (): boolean =>
  typeof window !== 'undefined' &&
  CLARITY_PROJECT_ID.length >= 6 &&
  // We don't require window.clarity to be present yet — the bootstrap
  // snippet defines a queueing shim immediately, so calls before the
  // tag finishes downloading are buffered and replayed once it loads.
  // We just confirm we're in a browser AND the project ID was wired up
  // at build time; the snippet itself decides whether to actually fetch.
  typeof window.clarity === 'function';

/**
 * Tag the current session with a logged-in user identifier. This lets
 * admins filter Clarity recordings + heatmaps by specific user (e.g.
 * "show me all sessions from user X"). The friendly name shows up in
 * the recording header.
 *
 * Pass an opaque ID (e.g. user._id) — NEVER pass an email or any other
 * PII as `customId`. Clarity will hash the value, but treating IDs as
 * opaque is the safer pattern.
 */
export function clarityIdentify(
  customId: string,
  customSessionId?: string,
  customPageId?: string,
  friendlyName?: string,
): void {
  if (!isClarityEnabled()) return;
  window.clarity!('identify', customId, customSessionId, customPageId, friendlyName);
}

/**
 * Attach a key-value tag to the current session. Tags are searchable in
 * the Clarity UI and useful for cohort filtering (e.g. tag every session
 * with the user's role, membership status, or feature-flag bucket).
 *
 * Call this AFTER user data is hydrated — calling with a placeholder
 * value would lock the tag for the rest of the session.
 */
export function claritySetTag(key: string, value: string | string[]): void {
  if (!isClarityEnabled()) return;
  window.clarity!('set', key, value);
}

/**
 * Send a custom event. Eligible for Smart Events / funnel analysis in
 * the Clarity dashboard. Use for moments worth measuring — login
 * succeeded, registration submitted, donation completed, blood-donor
 * contact revealed, bus-schedule searched, event registered, etc.
 *
 * Event names should be short, snake_case, and stable — once a name is
 * tracked it lives forever in your Clarity reports.
 */
export function clarityEvent(name: string): void {
  if (!isClarityEnabled()) return;
  window.clarity!('event', name);
}

/**
 * Manual consent gate. By default Clarity records EU/UK/EEA visitors
 * with a stricter privacy mask until you explicitly grant consent. Call
 * this from your cookie banner once the user accepts analytics.
 */
export function clarityConsent(granted = true): void {
  if (!isClarityEnabled()) return;
  window.clarity!('consent', granted);
}
