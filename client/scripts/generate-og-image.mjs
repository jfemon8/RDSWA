#!/usr/bin/env node
/** Generates the canonical 1200x630 Open Graph fallback image via `npm run generate:og --workspace=client`, layering SVG text so no font file is bundled. */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const SOURCE_LOGO = path.join(PUBLIC_DIR, 'icons', 'source-logo.png');
const OUTPUT = path.join(PUBLIC_DIR, 'og-image.png');

const WIDTH = 1200;
const HEIGHT = 630;

// Brand palette — keep in sync with tailwind theme + manifest theme_color.
const BRAND_DARK = '#042f1f';
const BRAND_PRIMARY = '#008f57';
const BRAND_ACCENT = '#10b981';

async function buildBackground() {
  // A diagonal brand gradient that sharp rasterises at final resolution, avoiding scaling artefacts.
  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${BRAND_DARK}" />
          <stop offset="55%" stop-color="${BRAND_PRIMARY}" />
          <stop offset="100%" stop-color="${BRAND_ACCENT}" />
        </linearGradient>
        <radialGradient id="glow" cx="20%" cy="30%" r="60%">
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
  // One SVG carries the whole text overlay so font metrics line up exactly, using system sans with a Bengali fallback.
  const overlay = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .brand { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 800; fill: #ffffff; }
        .sub   { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 600; fill: rgba(255,255,255,0.92); }
        .small { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 500; fill: rgba(255,255,255,0.78); }
        .bn    { font-family: 'Noto Sans Bengali', 'SolaimanLipi', 'Kalpurush', 'Segoe UI', sans-serif; font-weight: 700; fill: #ffffff; }
      </style>

      <!-- Pillar accent bar on the left edge -->
      <rect x="60" y="80" width="6" height="470" rx="3" fill="#ffffff" opacity="0.85" />

      <!-- Acronym -->
      <text x="320" y="200" class="brand" font-size="120" letter-spacing="4">RDSWA</text>

      <!-- English full name (two lines so it never overflows) -->
      <text x="320" y="270" class="sub" font-size="36">Rangpur Divisional Student</text>
      <text x="320" y="316" class="sub" font-size="36">Welfare Association</text>

      <!-- Bengali tagline -->
      <text x="320" y="386" class="bn" font-size="38">রংপুর বিভাগীয় ছাত্র কল্যাণ সমিতি</text>

      <!-- University attribution -->
      <text x="320" y="450" class="small" font-size="28">University of Barishal · বরিশাল বিশ্ববিদ্যালয়</text>

      <!-- Footer URL -->
      <text x="320" y="540" class="small" font-size="24" opacity="0.85">rdswa.info.bd</text>
    </svg>
  `;
  return sharp(Buffer.from(overlay)).png().toBuffer();
}

async function buildLogoBadge() {
  // Render the logo inside a soft white circular badge so it reads against
  // the gradient regardless of which logo variant (light/dark) is in use.
  const BADGE = 220;
  const INNER = 168;

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
  console.log('Generating og-image.png (1200×630)…');

  const [bg, text, badge] = await Promise.all([
    buildBackground(),
    buildTextOverlay(),
    buildLogoBadge(),
  ]);

  await sharp(bg)
    .composite([
      { input: badge, top: 195, left: 70 },
      { input: text, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(OUTPUT);

  console.log(`  ✓ ${path.relative(process.cwd(), OUTPUT)} (1200×630)`);
}

main().catch((err) => {
  console.error('OG image generation failed:', err);
  process.exit(1);
});
