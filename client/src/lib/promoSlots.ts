/**
 * Promo (Google AdSense) slot configuration + route policy.
 *
 * Component naming uses "promo" to keep code reads clean; the underlying
 * markup (`<ins class="adsbygoogle">` + `adsbygoogle.js`) MUST stay as
 * Google specifies — renaming/obfuscating those is a "Circumventing Systems"
 * policy violation that gets accounts permanently banned.
 *
 * SETUP CHECKLIST (after AdSense approval):
 *   1. Set VITE_ADSENSE_CLIENT in client/.env (and Vercel env vars)
 *   2. Create the ad units listed below in AdSense Console
 *   3. Replace each placeholder slot ID with the real 10-digit slot
 *   4. Verify no console warnings on `npm run build` then deploy
 */

// Read at import time. Empty in dev → <Promo> renders nothing, layout is
// preserved by `min-height` reservations on each placement so there is no
// CLS once ads start filling.
export const PROMO_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? '';

/**
 * Slot IDs from AdSense Console → Ads → By ad unit (rdswa.info.bd publisher
 * ca-pub-1036044341182474). Slot IDs are public (visible in DOM) so they
 * are committed to git; the publisher ID lives in env to keep production /
 * staging / dev cleanly separated.
 */
export const PROMO_SLOTS = {
  /** rdswa-sidebar — Display, vertical/responsive. Desktop right rails. */
  sidebar: '4716324992',
  /** rdswa-infeed — In-feed (fluid). Native-feeling cards in lists. */
  infeed: '5837834971',
  /** rdswa-multiplex — Multiplex (autorelaxed). End-of-page grids. */
  multiplex: '2573377382',
  /** rdswa-display-responsive — Display, horizontal/responsive. Bottom banners. */
  displayResponsive: '3503315674',
  /** rdswa-in-article — In-article (fluid, in-article layout). Long-form bodies. */
  inArticle: '5937907323',
} as const;

export type PromoKind = keyof typeof PROMO_SLOTS;

/**
 * Routes where promos are FORBIDDEN.
 *
 * Categories blocked here:
 *   - Auth flows (login pages with ads = "Valuable Inventory: No content"
 *     policy violation).
 *   - User-private records (attendance history, my-donations, profile edit).
 *   - Admin / moderator surfaces (no value to users; private internal data).
 *   - Payment / checkout flows (ads near payment forms = "Deceptive site
 *     navigation" policy risk).
 *
 * The `<Promo>` component reads this list and returns `null` on match, so
 * accidentally dropping a `<Promo>` into one of these pages is a no-op.
 */
export const PROMO_BLOCKED_ROUTES: RegExp[] = [
  // Auth flows
  /^\/login(\/|$)/,
  /^\/register(\/|$)/,
  /^\/forgot-password(\/|$)/,
  /^\/reset-password(\/|$)/,
  /^\/verify-email(\/|$)/,
  /^\/verify-otp(\/|$)/,

  // Admin (entire surface)
  /^\/admin(\/|$)/,

  // Private user records inside dashboard
  /^\/dashboard\/profile(\/|$)/,
  /^\/dashboard\/settings(\/|$)/,
  /^\/dashboard\/attendance(\/|$)/,
  /^\/dashboard\/my-donations(\/|$)/,
  /^\/dashboard\/notifications(\/|$)/,
  /^\/dashboard\/messages(\/|$)/,
  /^\/dashboard\/groups(\/|$)/,
  /^\/dashboard\/chat(\/|$)/,
  /^\/dashboard\/starred(\/|$)/,
  /^\/dashboard\/forms(\/|$)/,
  /^\/dashboard\/mentorship(\/|$)/,

  // Voting (private ballot screens)
  /^\/voting(\/|$)/,

  // Payment-adjacent (defensive — no current routes match, future-proofing)
  /^\/checkout(\/|$)/,
  /^\/payment(\/|$)/,
  /^\/donations\/new(\/|$)/,
];

export function isPromoAllowedOnRoute(pathname: string): boolean {
  if (!pathname) return false;
  return !PROMO_BLOCKED_ROUTES.some((re) => re.test(pathname));
}

/** True only when both the publisher env var and a non-empty slot exist. */
export function isPromoConfigured(kind: PromoKind): boolean {
  if (!PROMO_CLIENT.startsWith('ca-pub-')) return false;
  return Boolean(PROMO_SLOTS[kind]);
}
