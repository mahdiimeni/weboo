// Build the extension PNG icons + the app icon from the SVG logo (assets/logo.svg).
// Optional tool — the generated icons are committed, so running this is only
// needed when the logo changes. Requires sharp:  bun add -d sharp
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(ROOT, 'assets', 'logo.svg'));

const targets = [
  ['extension/icons/icon16.png', 16],
  ['extension/icons/icon32.png', 32],
  ['extension/icons/icon48.png', 48],
  ['extension/icons/icon128.png', 128],
  ['src/app/icon.png', 256],
];

mkdirSync(join(ROOT, 'extension', 'icons'), { recursive: true });

for (const [out, size] of targets) {
  await sharp(svg, { density: 400 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(ROOT, out));
  console.log('ok', out, size + 'px');
}
