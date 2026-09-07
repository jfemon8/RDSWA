/** Pure color helpers that return `null` on invalid hex and emit the space-separated `"H S% L%"` channels Tailwind's CSS variables expect. */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace(/^#/, '').match(/^([\da-f]{6})$/i);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

/** RGB (0-255) → `"H S% L%"` channels (as Tailwind expects). */
export function rgbToHslString(r: number, g: number, b: number): string {
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN: h = (gN - bN) / d + (gN < bN ? 6 : 0); break;
      case gN: h = (bN - rN) / d + 2; break;
      case bN: h = (rN - gN) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** `#008f57` → `"158 100% 28%"`, or null if invalid. */
export function hexToHslChannels(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHslString(rgb.r, rgb.g, rgb.b);
}

/** WCAG relative luminance, used to pick readable foreground text against a custom brand color. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/** Picks a legible foreground HSL (white vs near-black) for a given BG hex. */
export function autoForegroundChannels(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? '0 0% 9%' : '0 0% 100%';
}

/** Validate a 6-digit hex string like `#ABCDEF`, in either case. */
export function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex.trim());
}
