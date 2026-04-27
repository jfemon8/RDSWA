import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  PROMO_CLIENT,
  PROMO_SLOTS,
  isPromoAllowedOnRoute,
  isPromoConfigured,
  type PromoKind,
} from '@/lib/promoSlots';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface PromoProps {
  /** Which AdSense unit to render. Determines slot ID + format attributes. */
  kind: PromoKind;
  /** Extra classes for the wrapper. Use to control margins, max-width, etc. */
  className?: string;
  /**
   * Reserved height (px) until the ad fills, prevents Cumulative Layout
   * Shift. Pick something close to the ad's typical rendered height for the
   * placement: sidebar 600, infeed 180, multiplex 280, in-article 250,
   * displayResponsive 250.
   */
  minHeight?: number;
  /**
   * Optional Google-provided layout key for in-feed units. Generated when
   * you create the unit in AdSense Console (e.g., '-fb+5w+4e-db+86').
   */
  layoutKey?: string;
  /** Override 'in-article' layout for `kind="inArticle"`. */
  layout?: 'in-article' | 'fluid';
}

/**
 * Native React wrapper for a single Google AdSense ad unit.
 *
 * Behavior:
 *   - Returns `null` on auth/admin/private-data routes (see promoSlots.ts).
 *   - Returns `null` when env publisher ID or slot ID is unset (e.g., dev
 *     before AdSense approval). Layout space is preserved nowhere — the
 *     parent absorbs the gap so the page looks identical to before.
 *   - Reserves `minHeight` of layout space, so when the ad does fill, no
 *     content jumps. AdSense auto-collapses unfilled slots; we mirror that
 *     by hiding the wrapper if `data-ad-status="unfilled"` lands.
 *   - Animates in with the project's standard fade pattern.
 *
 * Compliance:
 *   - Renders `<ins class="adsbygoogle">` exactly as Google specifies. Do
 *     NOT rename the class or change `adsbygoogle.js` — both are detected
 *     and trigger account-level enforcement.
 *   - Includes a "Sponsored" label per Better Ads / IAB native-ad disclosure
 *     guidelines, which AdSense allows verbatim.
 */
export default function Promo({
  kind,
  className = '',
  minHeight,
  layoutKey,
  layout,
}: PromoProps) {
  const insRef = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);
  const [unfilled, setUnfilled] = useState(false);
  const { pathname } = useLocation();

  const allowedHere = isPromoAllowedOnRoute(pathname);
  const configured = isPromoConfigured(kind);

  useEffect(() => {
    if (!allowedHere || !configured) return;
    if (pushed.current || !insRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      /* AdSense script not yet loaded — fail silently; remount will retry. */
    }

    // Watch for AdSense's "unfilled" signal so we can collapse the slot
    // and avoid leaving an empty bordered box on the page.
    const node = insRef.current;
    if (!node) return;
    const observer = new MutationObserver(() => {
      const status = node.getAttribute('data-ad-status');
      if (status === 'unfilled') setUnfilled(true);
    });
    observer.observe(node, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observer.disconnect();
  }, [allowedHere, configured, pathname]);

  if (!allowedHere) return null;
  if (!configured) return null;
  if (unfilled) return null;

  const slot = PROMO_SLOTS[kind];

  // Format attribute mapping. These exactly mirror what Google's "Get code"
  // snippet generates for each ad-unit type — keep in sync with AdSense
  // Console output if Google adds new attributes.
  const formatProps: Record<string, string> = {
    'data-ad-client': PROMO_CLIENT,
    'data-ad-slot': slot,
  };
  switch (kind) {
    case 'sidebar':
      formatProps['data-ad-format'] = 'auto';
      formatProps['data-full-width-responsive'] = 'true';
      break;
    case 'infeed':
      formatProps['data-ad-format'] = 'fluid';
      if (layoutKey) formatProps['data-ad-layout-key'] = layoutKey;
      break;
    case 'multiplex':
      formatProps['data-ad-format'] = 'autorelaxed';
      break;
    case 'displayResponsive':
      formatProps['data-ad-format'] = 'auto';
      formatProps['data-full-width-responsive'] = 'true';
      break;
    case 'inArticle':
      formatProps['data-ad-format'] = 'fluid';
      formatProps['data-ad-layout'] = layout ?? 'in-article';
      break;
  }

  // Default min-heights chosen to roughly match each unit's typical rendered
  // size, so reserving space keeps CLS near zero. Caller can override.
  const reserved =
    minHeight ??
    (kind === 'sidebar'
      ? 600
      : kind === 'multiplex'
        ? 280
        : kind === 'inArticle'
          ? 250
          : kind === 'displayResponsive'
            ? 250
            : 180);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      aria-label="Sponsored content"
      className={`promo-slot relative w-full overflow-hidden rounded-xl border bg-card/50 ${className}`}
      style={{ minHeight: reserved }}
    >
      <span
        className="absolute top-1.5 left-2 z-10 select-none rounded bg-background/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/80 backdrop-blur-sm"
        aria-hidden="true"
      >
        Sponsored
      </span>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        {...formatProps}
      />
    </motion.div>
  );
}
