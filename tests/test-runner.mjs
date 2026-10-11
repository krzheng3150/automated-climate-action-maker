import puppeteer from 'puppeteer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const pathToExtension = path.join(projectRoot, 'dist');

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    `--disable-extensions-except=${pathToExtension}`,
    `--load-extension=${pathToExtension}`,
    '--no-sandbox',
  ],
});

const page = await browser.newPage();
page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

await page.goto('https://example.com');
console.log('Page loaded with extension injected.');

await browser.close();
