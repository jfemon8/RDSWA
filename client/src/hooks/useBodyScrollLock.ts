import { useEffect } from 'react';

/** Lock body scroll for modals and overlays while preserving scroll position, so the page doesn't jump on release. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const scrollY = window.scrollY;
    const lockedOnPath = window.location.pathname;
    const { body } = document;
    const original = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      body.style.overflow = original.overflow;
      body.style.position = original.position;
      body.style.top = original.top;
      body.style.left = original.left;
      body.style.right = original.right;
      body.style.width = original.width;
      // Restore the scroll position only on the same page, or a navigation would open the new page mid-scroll.
      if (window.location.pathname === lockedOnPath) {
        window.scrollTo(0, scrollY);
      }
    };
  }, [locked]);
}
