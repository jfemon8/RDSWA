import { useEffect } from 'react';
import { useSiteSettings } from './useSiteSettings';
import { hexToHslChannels, autoForegroundChannels, isValidHex } from '@/lib/colorUtils';

/**
 * Hardcoded fallback palette used when SiteSettings has no custom brand
 * colors configured. Kept in sync with the defaults in client/src/index.css
 * so the first paint (before the settings API responds) matches the
 * final-rendered colors — no flash of different theme.
 */
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

/**
 * Applies the admin-configured brand palette app-wide by injecting a small
 * `<style>` tag that overrides the `--primary`, `--primary-foreground`,
 * `--secondary`, `--secondary-foreground`, and `--ring` CSS variables on
 * `:root` (light) and `.dark` (dark mode).
 *
 * Override precedence (each field is independent):
 *   1. SiteSettings.brandColors.<field> (if valid hex)
 *   2. DEFAULT_BRAND_COLORS (matches the hardcoded defaults in index.css)
 *
 * Empty strings / invalid values fall through to step 2, so partial
 * configuration (e.g. only lightPrimary) works.
 *
 * The foreground color for each surface is auto-computed from relative
 * luminance — picking white or near-black to maintain WCAG AA contrast
 * regardless of what the admin picked. The admin doesn't have to manage it.
 */
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
      // (same specificity — later-declared stylesheet takes precedence).
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }, [custom?.lightPrimary, custom?.lightSecondary, custom?.darkPrimary, custom?.darkSecondary]);
}
