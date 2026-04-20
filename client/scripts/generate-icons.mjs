#!/usr/bin/env node
/**
 * Regenerates PWA / APK icon variants from the canonical source logo.
 *
 *   Source:  client/public/icons/source-logo.png
 *   Outputs: client/public/icons/icon-192x192.png
 *            client/public/icons/icon-512x512.png
 *            client/public/icons/icon-maskable-512x512.png
 *            client/public/icons/favicon-32x32.png
 *            client/public/icons/apple-touch-icon.png   (180x180)
 *
 * Run after replacing the source logo:
 *   npm run generate:icons --workspace=client
 *
 * Maskable icons need a safe zone: Android adaptive icons clip to a circle
 * or squircle, so all meaningful content must sit inside the inner 80%.
 * We pad the logo down to 80% on a solid background so nothing is cropped.
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_ICONS = path.resolve(__dirname, '../public/icons');
const SOURCE = path.join(PUBLIC_ICONS, 'source-logo.png');

// Brand background color for the maskable icon — matches manifest background_color
// so the icon looks intentional against Android adaptive icon masks.
const MASKABLE_BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function generateSquare(size, output) {
  // `contain` fits the whole logo without cropping; pads with transparent.
  await sharp(SOURCE)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(output);
  console.log(`  ✓ ${path.basename(output)} (${size}×${size})`);
}

async function generateMaskable(size, output) {
  // Scale the logo to 80% of the final size, then composite onto a solid
  // background canvas so the Android mask can crop safely.
  const inner = Math.round(size * 0.8);
  const logoBuffer = await sharp(SOURCE)
    .resize(inner, inner, { fit: 'contain', background: MASKABLE_BG })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: MASKABLE_BG,
    },
  })
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(output);
  console.log(`  ✓ ${path.basename(output)} (${size}×${size}, maskable)`);
}

async function main() {
  await mkdir(PUBLIC_ICONS, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  console.log(`Source: ${path.basename(SOURCE)} (${meta.width}×${meta.height}, ${meta.format})`);
  console.log('Generating variants…');

  await generateSquare(192, path.join(PUBLIC_ICONS, 'icon-192x192.png'));
  await generateSquare(512, path.join(PUBLIC_ICONS, 'icon-512x512.png'));
  await generateMaskable(512, path.join(PUBLIC_ICONS, 'icon-maskable-512x512.png'));
  await generateSquare(32, path.join(PUBLIC_ICONS, 'favicon-32x32.png'));
  await generateSquare(180, path.join(PUBLIC_ICONS, 'apple-touch-icon.png'));

  console.log('Done.');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
