import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Scroll offset each history entry was left at, keyed by the router's own location key. */
const positions = new Map<string, number>();

/** Oldest offsets are dropped past this, since no one scrolls back through hundreds of entries. */
const REMEMBERED_ENTRIES = 50;

// Lists restore from cache a frame or two after the route renders, so a single jump can land short.
const RESTORE_ATTEMPTS = 12;

/** Restores the reader's place on back/forward and starts every new page at the top. */
export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const key = location.key;

  // The browser's own restoration fights ours, so take it over.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const remember = () => {
      // Re-inserted so this entry counts as the newest and can never be the one evicted.
      positions.delete(key);
      positions.set(key, window.scrollY);
      if (positions.size > REMEMBERED_ENTRIES) {
        const oldest = positions.keys().next().value;
        if (oldest !== undefined) positions.delete(oldest);
      }
    };
    window.addEventListener('scroll', remember, { passive: true });
    return () => {
      remember();
      window.removeEventListener('scroll', remember);
    };
  }, [key]);

  useEffect(() => {
    const target = navigationType === 'POP' ? positions.get(key) : undefined;

    if (target === undefined || target === 0) {
      window.scrollTo(0, 0);
      return;
    }

    let frame = 0;
    let attempts = 0;
    let cancelled = false;

    // Keep trying while the page is still too short to hold the old offset.
    const restore = () => {
      if (cancelled) return;
      window.scrollTo(0, target);
      attempts += 1;
      if (window.scrollY < target && attempts < RESTORE_ATTEMPTS) {
        frame = requestAnimationFrame(restore);
      }
    };

    frame = requestAnimationFrame(restore);

    // A deliberate scroll means the reader has taken over, so stop chasing the old offset.
    const stop = () => { cancelled = true; };
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    };
  }, [key, navigationType]);

  return null;
}
