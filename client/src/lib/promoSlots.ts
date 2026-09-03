/** Promo (Google AdSense) slot configuration and route policy, where only the naming says "promo" since the `adsbygoogle` markup must stay exactly as Google specifies. */

// Read at import time and empty in dev, where each placement's `min-height` still reserves space so ads cause no layout shift.
export const PROMO_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? '';

/** Slot IDs are public so they live in git, while the publisher ID stays in env to keep environments separated. */
export const PROMO_SLOTS = {
  /** rdswa-sidebar — vertical responsive display unit for desktop right rails. */
  sidebar: '4716324992',
  /** rdswa-infeed — fluid in-feed unit for native-feeling cards in lists. */
  infeed: '5837834971',
  /** rdswa-multiplex — autorelaxed multiplex unit for end-of-page grids. */
  multiplex: '2573377382',
  /** rdswa-display-responsive — horizontal responsive display unit for bottom banners. */
  displayResponsive: '3503315674',
  /** rdswa-in-article — fluid in-article unit for long-form bodies. */
  inArticle: '5937907323',
} as const;

export type PromoKind = keyof typeof PROMO_SLOTS;

/** Routes where promos are forbidden — auth flows, private records, admin surfaces, and payment flows — on which `<Promo>` returns `null`. */
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
