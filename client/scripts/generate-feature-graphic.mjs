#!/usr/bin/env node
/**
 * Generates the 1024×500 feature graphic used by app stores (APKPure,
 * Google Play, Aptoide, Samsung Galaxy Store) as the hero banner shown
 * above the screenshots in a listing.
 *
 *   Source:  client/public/icons/source-logo.png
 *   Output:  client/public/feature-graphic.png
 *
 * Re-run after rebranding:
 *   npm run generate:feature --workspace=client
 *
 * Why custom-built rather than reusing the OG image:
 *   The OG image is 1200×630 (1.91:1) and tuned for social-card crop
 *   ratios — Facebook/Twitter tend to centre-crop the top + bottom.
 *   Feature graphics are 1024×500 (~2.05:1), wider and shorter, with a
 *   strict requirement that NO essential text or logo fall in the
 *   horizontal centre of the image (Google Play overlays the install
 *   button there on some surfaces). This script lays the badge on the
 *   far left and pushes title text to the right, keeping the centre
 *   uncluttered.
 *
 * Brand palette is shared with manifest.theme_color and the OG image
 * generator so apnar visual identity stays coherent across stores,
 * social shares, and the PWA chrome.
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const SOURCE_LOGO = path.join(PUBLIC_DIR, 'icons', 'source-logo.png');
const OUTPUT = path.join(PUBLIC_DIR, 'feature-graphic.png');

const WIDTH = 1024;
const HEIGHT = 500;

// Brand palette — keep in sync with tailwind theme + manifest theme_color
// + OG image generator.
const BRAND_DARK = '#042f1f';
const BRAND_PRIMARY = '#008f57';
const BRAND_ACCENT = '#10b981';

async function buildBackground() {
  // Diagonal gradient — same vibe as the OG image so the visual identity
  // is consistent across every channel a visitor first encounters.
  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${BRAND_DARK}" />
          <stop offset="55%" stop-color="${BRAND_PRIMARY}" />
          <stop offset="100%" stop-color="${BRAND_ACCENT}" />
        </linearGradient>
        <radialGradient id="glow" cx="22%" cy="35%" r="55%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)" />
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function buildTextOverlay() {
  // Layout principle: badge on the LEFT (centred between 50px–340px),
  // text block on the RIGHT (starting at x=370). Centre column
  // (around x=450–600) deliberately left clean so app-store install
  // buttons / overlays don't crash into critical content.
  const overlay = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .brand { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 800; fill: #ffffff; }
        .sub   { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 600; fill: rgba(255,255,255,0.92); }
        .small { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 500; fill: rgba(255,255,255,0.78); }
        .bn    { font-family: 'Noto Sans Bengali', 'SolaimanLipi', 'Kalpurush', 'Segoe UI', sans-serif; font-weight: 700; fill: #ffffff; }
      </style>

      <!-- Pillar accent bar on the far left edge -->
      <rect x="36" y="80" width="5" height="340" rx="2.5" fill="#ffffff" opacity="0.82" />

      <!-- Acronym (big hero text) -->
      <text x="370" y="180" class="brand" font-size="96" letter-spacing="3">RDSWA</text>

      <!-- English full name (two-line so it never overflows the right edge) -->
      <text x="370" y="232" class="sub" font-size="26">Rangpur Divisional Student</text>
      <text x="370" y="266" class="sub" font-size="26">Welfare Association</text>

      <!-- Bengali tagline -->
      <text x="370" y="320" class="bn" font-size="28">রংপুর বিভাগীয় ছাত্র কল্যাণ সমিতি</text>

      <!-- University attribution -->
      <text x="370" y="362" class="small" font-size="22">University of Barishal · বরিশাল বিশ্ববিদ্যালয়</text>

      <!-- Footer URL — bottom-aligned -->
      <text x="370" y="442" class="small" font-size="20" opacity="0.85">rdswa.info.bd</text>
    </svg>
  `;
  return sharp(Buffer.from(overlay)).png().toBuffer();
}

async function buildLogoBadge() {
  // White circular badge so the logo reads cleanly on the green
  // gradient regardless of which logo variant (light/dark) is in use.
  // Sized to fit within the left third of the canvas (50–340 = 290px,
  // so badge=280px gives 5px breathing room on each side).
  const BADGE = 280;
  const INNER = 215;

  const badgeSvg = `
    <svg width="${BADGE}" height="${BADGE}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${BADGE / 2}" cy="${BADGE / 2}" r="${BADGE / 2 - 4}" fill="#ffffff" opacity="0.96" />
      <circle cx="${BADGE / 2}" cy="${BADGE / 2}" r="${BADGE / 2 - 4}" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="2" />
    </svg>
  `;
  const badge = await sharp(Buffer.from(badgeSvg)).png().toBuffer();

  const logo = await sharp(SOURCE_LOGO)
    .resize(INNER, INNER, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp(badge)
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  console.log('Generating feature-graphic.png (1024×500)…');

  const [bg, text, badge] = await Promise.all([
    buildBackground(),
    buildTextOverlay(),
    buildLogoBadge(),
  ]);

  await sharp(bg)
    .composite([
      // Badge: vertically centred (top = (500-280)/2 = 110), left = 60.
      { input: badge, top: 110, left: 60 },
      { input: text, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(OUTPUT);

  console.log(`  ✓ ${path.relative(process.cwd(), OUTPUT)} (1024×500)`);
}

main().catch((err) => {
  console.error('Feature graphic generation failed:', err);
  process.exit(1);
});
