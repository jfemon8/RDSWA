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
import { useSiteSettings } from '@/hooks/useSiteSettings';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface PromoProps {
  /** Which AdSense unit to render, determining the slot ID and format attributes. */
  kind: PromoKind;
  /** Extra classes for the wrapper. Use to control margins, max-width, etc. */
  className?: string;
  /** Height reserved in px until the ad fills, ideally close to the placement's typical rendered height. */
  minHeight?: number;
  /** Optional Google-provided layout key for in-feed units, generated in the AdSense Console. */
  layoutKey?: string;
  /** Override 'in-article' layout for `kind="inArticle"`. */
  layout?: 'in-article' | 'fluid';
}

/** Native React wrapper for one AdSense unit that returns `null` on forbidden routes and reserves `minHeight` so a filled ad shifts nothing. */
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
  const { settings } = useSiteSettings();

  // Missing or loading settings count as enabled, so the flag only suppresses ads once it is explicitly `false`.
  const adsenseEnabled = settings?.adsenseEnabled !== false;

  const allowedHere = isPromoAllowedOnRoute(pathname);
  const configured = isPromoConfigured(kind);

  useEffect(() => {
    if (!adsenseEnabled || !allowedHere || !configured) return;
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
  }, [adsenseEnabled, allowedHere, configured, pathname]);

  if (!adsenseEnabled) return null;
  if (!allowedHere) return null;
  if (!configured) return null;
  if (unfilled) return null;

  const slot = PROMO_SLOTS[kind];

  // Format attributes mirror Google's "Get code" snippet per unit type, so keep them in sync with the AdSense Console.
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

  // Default min-heights roughly match each unit's rendered size to keep layout shift near zero, and callers may override them.
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
