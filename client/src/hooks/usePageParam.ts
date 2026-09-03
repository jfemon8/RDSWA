import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** Page state synced to a URL param with `replace: true`, so back navigation returns to the same page without flooding history. */
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
