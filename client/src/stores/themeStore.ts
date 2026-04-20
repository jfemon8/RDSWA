import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'theme';
const VALID: ReadonlyArray<Theme> = ['light', 'dark', 'system'];

/**
 * Resolves the initial theme in strict priority order:
 *   1. User's saved preference in localStorage (if valid)
 *   2. OS preference via prefers-color-scheme (only applied when no saved choice)
 *   3. Default 'light'
 *
 * The returned value is always 'light' | 'dark' | 'system' — 'system' means
 * "keep tracking the OS preference live", so we do NOT resolve it to light/dark
 * here. applyTheme() handles that at paint time.
 */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (VALID as string[]).includes(saved)) return saved as Theme;
  } catch { /* localStorage blocked */ }
  // No saved choice → follow system preference while it remains unset.
  return 'system';
}

function prefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', isDark);
  // Mirror the resolved mode to a data attribute so CSS / other tools can
  // target the effective theme even when the stored preference is 'system'.
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* blocked */ }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));

// Apply once at module load so there's no flash.
applyTheme(getInitialTheme());

// Keep 'system' mode responsive to OS theme changes while the app is open.
// Without this listener, switching OS dark mode mid-session wouldn't update
// the app until a reload.
if (typeof window !== 'undefined' && window.matchMedia) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    const current = useThemeStore.getState().theme;
    if (current === 'system') applyTheme('system');
  };
  // addEventListener is the modern API; older Safari used addListener.
  if (mql.addEventListener) mql.addEventListener('change', handler);
  else mql.addListener?.(handler);
}
