import { useEffect } from 'react';
import { useSiteSettings } from './useSiteSettings';
import { hexToHslChannels, autoForegroundChannels, isValidHex } from '@/lib/colorUtils';

/** Fallback palette mirroring the index.css defaults, so the first paint matches the final colors with no theme flash. */
export const DEFAULT_BRAND_COLORS: {
  lightPrimary: string;
  lightSecondary: string;
  darkPrimary: string;
  darkSecondary: string;
} = {
  lightPrimary: '#008f57',
  lightSecondary: '#e6f4ee',
  darkPrimary: '#28b578',
  darkSecondary: '#242424',
};

const STYLE_TAG_ID = 'rdswa-brand-colors';

/** Inject the admin palette as CSS variable overrides, falling back per field to the defaults and auto-computing each foreground for WCAG AA contrast. */
export function useBrandColors() {
  const { settings } = useSiteSettings();
  const custom = settings?.brandColors;

  useEffect(() => {
    const pick = (value: string | undefined, fallback: string): string =>
      value && isValidHex(value) ? value : fallback;

    const lightPrimary = pick(custom?.lightPrimary, DEFAULT_BRAND_COLORS.lightPrimary);
    const lightSecondary = pick(custom?.lightSecondary, DEFAULT_BRAND_COLORS.lightSecondary);
    const darkPrimary = pick(custom?.darkPrimary, DEFAULT_BRAND_COLORS.darkPrimary);
    const darkSecondary = pick(custom?.darkSecondary, DEFAULT_BRAND_COLORS.darkSecondary);

    const css = `
:root {
  --primary: ${hexToHslChannels(lightPrimary)};
  --primary-foreground: ${autoForegroundChannels(lightPrimary)};
  --secondary: ${hexToHslChannels(lightSecondary)};
  --secondary-foreground: ${autoForegroundChannels(lightSecondary)};
  --ring: ${hexToHslChannels(lightPrimary)};
}
.dark {
  --primary: ${hexToHslChannels(darkPrimary)};
  --primary-foreground: ${autoForegroundChannels(darkPrimary)};
  --secondary: ${hexToHslChannels(darkSecondary)};
  --secondary-foreground: ${autoForegroundChannels(darkSecondary)};
  --ring: ${hexToHslChannels(darkPrimary)};
}
`.trim();

    let styleEl = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_TAG_ID;
      // Append to <head> last so it wins against index.css ':root' rules
      // (same specificity: later-declared stylesheet takes precedence).
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }, [custom?.lightPrimary, custom?.lightSecondary, custom?.darkPrimary, custom?.darkSecondary]);
}
