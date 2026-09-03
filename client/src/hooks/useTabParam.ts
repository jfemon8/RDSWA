import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** Tab state synced to a URL param with `replace: true`, falling back to `defaultValue` when the URL value isn't valid. */
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
