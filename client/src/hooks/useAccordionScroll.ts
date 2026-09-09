import { useCallback } from 'react';

/** Clears the sticky 64px header and leaves a little breathing room above the card. */
const SCROLL_MARGIN = 80;

/** Matches the 0.25s height animation, so the target is measured after the collapsing card has settled. */
const SETTLE_MS = 300;

/** Picks the rendered node when a page mounts the same item twice, once for the table and once for the mobile card. */
function findItem(id: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(
    `[data-accordion-item="${CSS.escape(id)}"]`,
  );
  for (const node of Array.from(nodes)) {
    if (node.getClientRects().length > 0) return node;
  }
  return null;
}

/** Smoothly brings an expanded accordion item's top into view, taking a node or a `data-accordion-item` value. */
export function scrollAccordionIntoView(target: HTMLElement | string | number | null) {
  if (target === null) return;
  window.setTimeout(() => {
    const el = typeof target === 'object' ? target : findItem(String(target));
    if (!el) return;
    el.style.scrollMarginTop = `${SCROLL_MARGIN}px`;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, SETTLE_MS);
}

/** Toggles a single-open accordion and scrolls whichever card just expanded to the top of the viewport. */
export function useAccordionToggle<T extends string | number>(
  openId: T | null,
  setOpenId: (next: T | null) => void,
) {
  return useCallback(
    (id: T) => {
      const next = openId === id ? null : id;
      setOpenId(next);
      scrollAccordionIntoView(next);
    },
    [openId, setOpenId],
  );
}
