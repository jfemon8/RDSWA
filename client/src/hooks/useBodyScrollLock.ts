import { useEffect } from 'react';

/**
 * Locks body scroll when `locked` is true. Preserves the current scroll
 * position so the page does not jump when the lock is released (iOS/Android).
 *
 * Use this for modals, drawers, mobile nav menus, and any full-screen overlay
 * that should prevent the background from scrolling while open.
 */
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
      // Only restore the previous scroll position if we're still on the same
      // page. If the lock is being released because the user navigated away
      // (e.g. sidebar auto-closes on route change), restoring scrollY would
      // apply the OLD page's scroll offset to the NEW page — overriding
      // ScrollToTop and making navigated pages open mid-scroll.
      if (window.location.pathname === lockedOnPath) {
        window.scrollTo(0, scrollY);
      }
    };
  }, [locked]);
}
