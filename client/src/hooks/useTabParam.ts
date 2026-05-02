import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Tab state synced to a URL search param so navigating away and pressing
 * back returns to the same tab. Drop-in replacement for `useState<Tab>(default)`.
 *
 * Tab changes use `replace: true` so they don't flood browser history.
 * If the URL value isn't in `validValues`, the hook falls back to `defaultValue`.
 */
export function useTabParam<T extends string>(
  validValues: readonly T[],
  defaultValue: T,
  key = "tab",
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(key);
  const tab = (validValues as readonly string[]).includes(raw ?? "")
    ? (raw as T)
    : defaultValue;

  const setTab = useCallback(
    (next: T) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === defaultValue) params.delete(key);
          else params.set(key, next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaultValue, key],
  );

  return [tab, setTab];
}
