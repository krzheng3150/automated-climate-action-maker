import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const projectRoot = path.resolve(scriptsDir, '..');
const extensionPath = path.join(projectRoot, 'dist');

// 1. Run the compilation build step
console.log('[ACAM] Compiling extension...');
execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });

// Ensure Chrome binary is available
const systemPaths = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
];
let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || systemPaths.find((p) => existsSync(p));

if (!executablePath) {
  try {
    executablePath = await puppeteer.executablePath();
  } catch {
    console.log('[ACAM] Chrome binary not found. Downloading Chrome for Puppeteer...');
    execSync('npx puppeteer browsers install chrome', { stdio: 'inherit', cwd: __dirname });
    executablePath = await puppeteer.executablePath();
  }
}

const isMac = process.platform === 'darwin';
const hasDisplay = isMac || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
const headless = !hasDisplay ? 'new' : false;

// 2. Accept custom URL from CLI or default to a scenario test page
const targetUrl = process.argv[2] || 'https://example.com/?scenario=a';

console.log(`[ACAM] Launching browser with unpacked extension from: ${extensionPath}`);
console.log(`[ACAM] Opening target URL: ${targetUrl}`);

const browser = await puppeteer.launch({
  headless,
  ...(executablePath ? { executablePath } : {}),
  defaultViewport: null,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
  ],
});

const pages = await browser.pages();
const page = pages.length > 0 ? pages[0] : await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

page.on('console', (msg) => {
  console.log(`[Browser] ${msg.text()}`);
});

await page.goto(targetUrl);

if (!hasDisplay) {
  console.log('[ACAM] Headless environment detected (Cloud Shell). Testing overlay injection...');
  try {
    await page.waitForSelector('#acam-overlay-host', { timeout: 6000 });
    console.log('[ACAM] ✓ ACAM overlay card successfully injected!');
    const screenshotsDir = path.join(projectRoot, 'assets', 'screenshots');
    mkdirSync(screenshotsDir, { recursive: true });
    const screenshotPath = path.join(screenshotsDir, 'acam-test.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`[ACAM] Screenshot saved to: ${screenshotPath}`);
  } catch (err) {
    console.error('[ACAM] ✗ Timed out waiting for #acam-overlay-host:', err.message);
  }
  await browser.close();
  process.exit(0);
}

browser.on('disconnected', () => {
  console.log('[ACAM] Browser closed.');
  process.exit(0);
});