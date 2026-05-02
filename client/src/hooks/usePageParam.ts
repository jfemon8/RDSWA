import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Page state synced to a URL search param so that navigating away and
 * pressing back returns to the same page. Drop-in replacement for
 * `useState<number>(1)` when paired with the shared `Pagination` component.
 *
 * Pagination changes use `replace: true` so they don't flood browser history,
 * but the URL still preserves the page, so back navigation from a detail page
 * returns to the correct page.
 */
export function usePageParam(
  key = "page",
): [number, (page: number) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(key);
  const parsed = raw ? parseInt(raw, 10) : 1;
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const setPage = useCallback(
    (next: number) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next <= 1) params.delete(key);
          else params.set(key, String(next));
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams, key],
  );

  return [page, setPage];
}
