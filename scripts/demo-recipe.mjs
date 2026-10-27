import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { goOffline } from '../tests/lib/offline.mjs';

/**
 * Prototype loop for the food feature: builds the extension, opens a real browser with it loaded,
 * and shows a recipe page. Fixture pages are served offline, so this works with no network.
 *
 *   npm run demo:recipe                 chili fixture
 *   npm run demo:recipe -- salad        another fixture (see tests/fixtures/pages)
 *   npm run demo:recipe -- ./my.html    any local recipe page you saved
 *   npm run demo:recipe -- https://...  a live page (real network)
 *
 * Uses Puppeteer's Chrome for Testing: branded Google Chrome ignores --load-extension.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = path.join(projectRoot, 'tests', 'fixtures', 'pages');
const fixtures = readdirSync(pagesDir).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''));

const arg = process.argv[2] ?? 'chili';
let url;
let routes = {};
if (/^https:\/\//.test(arg)) {
  url = arg;
} else {
  const file = existsSync(arg) ? arg : path.join(pagesDir, `${arg}.html`);
  if (!existsSync(file)) {
    console.error(`No such page "${arg}". Fixtures: ${fixtures.join(', ')}; or pass a local .html file or an https URL.`);
    process.exit(1);
  }
  url = 'https://recipes.test/demo';
  routes = { [url]: readFileSync(file, 'utf8') };
}

if (!process.env.ACAM_SKIP_BUILD) execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });
const extensionPath = path.join(projectRoot, 'dist');
const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: null,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
});
const page = (await browser.pages())[0] ?? (await browser.newPage());
if (Object.keys(routes).length) await goOffline(page, routes);
await page.goto(url);
console.log(`[demo] ${url}\n[demo] The swap card appears after about 2 seconds if a swap fits. Close the browser to exit.`);
browser.on('disconnected', () => process.exit(0));
