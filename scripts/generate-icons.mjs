import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptsDir, '..');
const iconsDir = path.join(projectRoot, 'assets', 'icons');
mkdirSync(iconsDir, { recursive: true });

const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#grad)" />
  <!-- Stylized Eco Leaf / Sprout -->
  <path d="M 64 24 C 64 24, 94 36, 94 72 C 94 92, 78 104, 64 104 C 50 104, 34 92, 34 72 C 34 36, 64 24, 64 24 Z" fill="#ffffff" opacity="0.95" />
  <path d="M 64 36 C 64 56, 64 78, 64 104" stroke="#047857" stroke-width="4" stroke-linecap="round" />
  <path d="M 64 62 C 72 56, 80 58, 86 64" stroke="#047857" stroke-width="3" stroke-linecap="round" />
  <path d="M 64 76 C 56 70, 48 72, 42 78" stroke="#047857" stroke-width="3" stroke-linecap="round" />
</svg>
`;

const sizes = [16, 32, 48, 128];

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background:transparent;">${svgIcon}</body></html>`);

  for (const size of sizes) {
    await page.setViewport({ width: size, height: size });
    const iconPath = path.join(iconsDir, `icon-${size}.png`);
    await page.screenshot({
      path: iconPath,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    console.log(`[Icon Generator] Generated ${iconPath} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
