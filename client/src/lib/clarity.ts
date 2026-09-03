/** Thin wrapper around the Microsoft Clarity tracker whose helpers exit silently when `window.clarity` is absent. */

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
  // The bootstrap snippet buffers early calls, so this only confirms a browser context and a build-time project ID.
  typeof window.clarity === 'function';

/** Tag the session with an opaque user id, never an email, so admins can filter recordings by person. */
export function clarityIdentify(
  customId: string,
  customSessionId?: string,
  customPageId?: string,
  friendlyName?: string,
): void {
  if (!isClarityEnabled()) return;
  window.clarity!('identify', customId, customSessionId, customPageId, friendlyName);
}

/** Attach a searchable key-value tag for cohort filtering, only after user data is hydrated. */
export function claritySetTag(key: string, value: string | string[]): void {
  if (!isClarityEnabled()) return;
  window.clarity!('set', key, value);
}

/** Send a custom event for funnel analysis, using a short snake_case name that lives forever in the reports. */
export function clarityEvent(name: string): void {
  if (!isClarityEnabled()) return;
  window.clarity!('event', name);
}

/** Manual consent gate to call from a cookie banner, lifting the stricter mask Clarity applies to EU visitors by default. */
export function clarityConsent(granted = true): void {
  if (!isClarityEnabled()) return;
  window.clarity!('consent', granted);
}
