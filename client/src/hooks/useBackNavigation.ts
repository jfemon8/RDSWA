import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/** Sends the reader back where they came from, falling back to a known page when the tab has no history. */
export function useBackNavigation(fallback: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    // React Router tracks its own position, so idx tells us whether going back stays in the app.
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}
