import puppeteer from 'puppeteer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { keepBrowserOffline, newOfflinePage } from './lib/offline.mjs';

const __filename = fileURLToPath(import.meta.url);
const testsDir = path.dirname(__filename);
const projectRoot = path.resolve(testsDir, '..');
const extensionPath = path.join(projectRoot, 'dist');

console.log('[E2E Regression Check] Testing all extension subsystems...');

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
  ],
});

keepBrowserOffline(browser);

try {
  // 1. Discover service worker target
  const workerTarget = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
    { timeout: 5000 }
  );
  const extensionId = new URL(workerTarget.url()).host;
  console.log('[1/4] Background worker active with ID:', extensionId);

  // 2. Test Scenario A (Civic Action Overlay)
  const pageA = await newOfflinePage(browser);
  await pageA.goto('https://example.com/?scenario=a', { waitUntil: 'domcontentloaded' });
  await pageA.waitForSelector('#acam-overlay-host', { timeout: 6000 });

  const hostA = await pageA.$('#acam-overlay-host');
  const shadowA = await hostA.evaluateHandle((el) => el.shadowRoot);
  const actionBtn = await shadowA.$('#action-btn');
  if (!actionBtn) throw new Error('Action button missing in Scenario A');
  await actionBtn.click();

  await pageA.waitForFunction(
    () => {
      const h = document.getElementById('acam-overlay-host');
      return Boolean(h?.shadowRoot?.querySelector('.success-title'));
    },
    { timeout: 4000 }
  );
  const successA = await shadowA.$eval('.success-title', (el) => el.textContent);
  console.log('[2/4] Scenario A interaction succeeded:', successA);

  // 3. Test Scenario C (Shopping Refurbished Circular Overlay)
  const pageC = await newOfflinePage(browser);
  await pageC.goto('https://example.com/?scenario=c&item=ThinkPad+T14', { waitUntil: 'domcontentloaded' });
  await pageC.waitForSelector('#acam-overlay-host', { timeout: 6000 });

  const hostC = await pageC.$('#acam-overlay-host');
  const shadowC = await hostC.evaluateHandle((el) => el.shadowRoot);
  const snippetText = await shadowC.$eval('.snippet-box', (el) => el.textContent);
  if (!snippetText.includes('ThinkPad T14')) {
    throw new Error('Dynamic product title not sanitized/displayed in snippet');
  }

  const circularBtn = await shadowC.$('.circular-btn');
  if (!circularBtn) throw new Error('Circular button missing in Scenario C');
  await circularBtn.click();

  await pageC.waitForFunction(
    () => {
      const h = document.getElementById('acam-overlay-host');
      return Boolean(h?.shadowRoot?.querySelector('.success-title'));
    },
    { timeout: 4000 }
  );
  const successC = await shadowC.$eval('.success-title', (el) => el.textContent);
  console.log('[3/4] Scenario C circular interaction succeeded:', successC);

  // 4. Test Background Storage & Popup Trace Stream
  const popupPage = await browser.newPage();
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  await popupPage.goto(popupUrl, { waitUntil: 'networkidle0' });

  // Verify stored points from interactions
  const storageData = await popupPage.evaluate(async () => {
    return await chrome.storage.local.get('stats');
  });
  const stats = storageData.stats || {};
  console.log(`[4/4] Impact stats in storage: Civic Points = ${stats.civicPoints}, CO2 Saved = ${stats.totalCo2SavedKg} kg`);

  if ((stats.civicPoints || 0) < 50) throw new Error('Civic points not recorded');
  if ((stats.totalCo2SavedKg || 0) < 65) throw new Error('CO2 savings not recorded');

  // Outbound helper: the circular click must have opened its tab through openOutbound()
  const outboundTab = await browser
    .waitForTarget((t) => t.url().includes('backmarket.com'), { timeout: 5000 })
    .catch(() => null);
  if (!outboundTab) throw new Error('Back Market tab was not opened by the circular button');
  const outboundUrl = new URL(outboundTab.url());
  if (outboundUrl.searchParams.get('q') !== 'ThinkPad T14') {
    throw new Error(`Outbound URL lost the product query: ${outboundTab.url()}`);
  }
  const diagnostics = await popupPage.evaluate(async () => {
    return (await chrome.storage.local.get('diagnosticsLog')).diagnosticsLog || [];
  });
  const outboundMarkers = diagnostics.filter((d) => d.event === 'OUTBOUND_OPEN');
  if (!outboundMarkers.some((d) => d.details.includes('partner=backmarket') && d.details.includes('host=www.backmarket.com'))) {
    throw new Error('Opened tab has no matching OUTBOUND_OPEN marker: it bypassed the helper');
  }
  if (diagnostics.some((d) => d.event === 'OUTBOUND_UNREGISTERED_HOST' || d.event === 'OUTBOUND_REFUSED')) {
    throw new Error('Outbound helper reported an unregistered or refused host for a registry partner');
  }
  console.log('[Outbound] Circular redirect opened via helper with marker:', outboundMarkers[0].details);

  // Food emission table: the background worker must report the bundled AGRIBALYSE table as loaded
  const foodReady = diagnostics.find((d) => d.event === 'FOOD_DATA_READY');
  if (!foodReady) throw new Error('Background worker never reported FOOD_DATA_READY: the food table is not loaded in the extension');
  if (diagnostics.some((d) => d.event === 'FOOD_DATA_INVALID')) throw new Error('Background worker reported FOOD_DATA_INVALID');
  console.log('[Food data] Background loaded the bundled table:', foodReady.details);

  // Trigger history scan in popup
  await popupPage.click('#scan-btn');
  await popupPage.waitForFunction(
    () => {
      const title = document.getElementById('step-title')?.textContent || '';
      return title.includes('Complete');
    },
    { timeout: 8000 }
  );

  const googleCount = await popupPage.$eval('#google-count', (el) => el.textContent);
  const totalCount = await popupPage.$eval('#total-count', (el) => el.textContent);
  const domainsCount = await popupPage.$$eval('.domain-item', (items) => items.length);

  console.log(`[Popup Stream] Scan complete: ${googleCount} Google hits, ${totalCount} total visits, ${domainsCount} domains rendered.`);

  console.log('\n[VERIFIED] All plugin subsystems (Background, Content Scripts A & C, Popup Stream, Storage) are fully functional with 0 regressions!');
} catch (err) {
  console.error('[Regression Failure]', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
