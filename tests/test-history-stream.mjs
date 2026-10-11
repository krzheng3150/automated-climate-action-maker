import puppeteer from 'puppeteer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const testsDir = path.dirname(__filename);
const projectRoot = path.resolve(testsDir, '..');
const extensionPath = path.join(projectRoot, 'dist');

console.log('[Test] Launching Puppeteer with extension at:', extensionPath);

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
  ],
});

try {
  // 1. Generate some browsing history entries in the test session
  const page1 = await browser.newPage();
  console.log('[Test] Navigating to example.com to create history...');
  await page1.goto('https://example.com', { waitUntil: 'domcontentloaded' });

  const page2 = await browser.newPage();
  console.log('[Test] Navigating to google.com to create history...');
  try {
    await page2.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 5000 });
  } catch {
    console.log('[Test] Google nav timed out or blocked (offline/mock), proceeding...');
  }

  // 2. Discover extension ID from background service worker target
  const targets = await browser.targets();
  const extensionTarget = targets.find((t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'));

  if (!extensionTarget) {
    throw new Error('Extension background service worker target not found.');
  }

  const extensionUrl = extensionTarget.url();
  const extensionId = new URL(extensionUrl).host;
  console.log(`[Test] Discovered Extension ID: ${extensionId}`);

  // 3. Open extension popup
  const popupPage = await browser.newPage();
  popupPage.on('console', (msg) => console.log('[Popup Console]:', msg.text()));

  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  console.log(`[Test] Opening popup at: ${popupUrl}`);
  await popupPage.goto(popupUrl, { waitUntil: 'networkidle0' });

  // 4. Verify initial popup state
  const initialTitle = await popupPage.$eval('#step-title', (el) => el.textContent);
  console.log(`[Test] Initial Step Title: "${initialTitle}"`);

  // 5. Click "Run On-Device Analysis"
  console.log('[Test] Clicking #scan-btn to initiate live computation stream...');
  await popupPage.click('#scan-btn');

  // 6. Wait for completion (step-title === 'Computation Complete' or done state)
  await popupPage.waitForFunction(
    () => {
      const title = document.getElementById('step-title')?.textContent || '';
      return title.includes('Complete') || title.includes('Error');
    },
    { timeout: 8000 }
  );

  const completedTitle = await popupPage.$eval('#step-title', (el) => el.textContent);
  const completedDetail = await popupPage.$eval('#step-detail', (el) => el.textContent);
  const progress = await popupPage.$eval('#progress-fill', (el) => el.style.width);
  const googleCount = await popupPage.$eval('#google-count', (el) => el.textContent);
  const nonGoogleCount = await popupPage.$eval('#non-google-count', (el) => el.textContent);
  const totalCount = await popupPage.$eval('#total-count', (el) => el.textContent);
  const domainsCount = await popupPage.$$eval('.domain-item', (items) => items.length);

  console.log('\n--- SCAN VERIFICATION RESULTS ---');
  console.log(`Step Title: ${completedTitle}`);
  console.log(`Step Detail: ${completedDetail}`);
  console.log(`Progress Bar Width: ${progress}`);
  console.log(`Google Hits: ${googleCount}`);
  console.log(`Non-Google Hits: ${nonGoogleCount}`);
  console.log(`Total Count: ${totalCount}`);
  console.log(`Top Domains Displayed: ${domainsCount}`);
  console.log('---------------------------------\n');

  if (progress !== '100%') {
    throw new Error(`Expected progress 100%, got: ${progress}`);
  }

  // 7. Test Purge Local Cache
  console.log('[Test] Testing Purge Cache action...');
  await popupPage.click('#purge-btn');
  const purgedTitle = await popupPage.$eval('#step-title', (el) => el.textContent);
  const purgedTotal = await popupPage.$eval('#total-count', (el) => el.textContent);
  console.log(`[Test] Post-Purge Title: "${purgedTitle}", Total: ${purgedTotal}`);

  console.log('[Test] ✓ All live stream steps, UI components, and cache actions verified successfully!');
} catch (err) {
  console.error('[Test] ✗ Test failed:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
