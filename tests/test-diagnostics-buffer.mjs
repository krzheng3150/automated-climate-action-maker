import puppeteer from 'puppeteer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendDiagnosticEntry, MAX_DIAGNOSTIC_LOGS, STORAGE_KEYS } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const testsDir = path.dirname(__filename);
const projectRoot = path.resolve(testsDir, '..');
const extensionPath = path.join(projectRoot, 'dist');

console.log('[Test: Diagnostics Buffer] Verifying browser-agnostic diagnostics architecture...');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failures++;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// ----------------------------------------------------------------------------
// 1. Pure Unit Assertions: FIFO Ring Buffer Logic
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 1: FIFO Bounded Ring Buffer Mechanics ---');
let logs = [];

// Append 60 items (exceeds default MAX_DIAGNOSTIC_LOGS = 50)
for (let i = 1; i <= 60; i++) {
  logs = appendDiagnosticEntry(logs, {
    source: 'content',
    level: 'info',
    event: `EVENT_${i}`,
    details: `Details for event ${i}`,
  });
}

assert(logs.length === MAX_DIAGNOSTIC_LOGS, `Buffer bounded to exact max limit of ${MAX_DIAGNOSTIC_LOGS} (was 60, now ${logs.length})`);
assert(logs[0].event === 'EVENT_11', `Oldest items shifted (First entry is EVENT_11, got ${logs[0].event})`);
assert(logs[logs.length - 1].event === 'EVENT_60', `Latest item retained at end (Last entry is EVENT_60)`);
assert(typeof logs[0].id === 'string' && logs[0].id.startsWith('diag_'), 'Automatic diagnostic ID prefix assigned');
assert(typeof logs[0].timestamp === 'number' && logs[0].timestamp > 0, 'Timestamp assigned to diagnostic entry');

// ----------------------------------------------------------------------------
// 2. Integration / Headless UI Assertion via Puppeteer
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 2: Headless Popup Diagnostics Drawer & Safe DOM ---');

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
  // Discover background service worker
  const swTarget = await browser.waitForTarget((target) => target.type() === 'service_worker', {
    timeout: 7000,
  });
  const extensionUrl = swTarget.url();
  const extensionId = extensionUrl.split('/')[2];
  assert(Boolean(extensionId), `Discovered Extension ID: ${extensionId}`);

  // Open extension popup page
  const popupPage = await browser.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 600));

  // Verify diagnostic drawer elements exist
  const drawerExists = await popupPage.$eval('#diagnostics-drawer', (el) => Boolean(el));
  assert(drawerExists, 'Diagnostics drawer <details> element exists in popup DOM');

  const countBadgeText = await popupPage.$eval('#diagnostics-count', (el) => el.textContent);
  assert(countBadgeText.includes('event'), `Diagnostics count badge initialized: "${countBadgeText}"`);

  // Verify events list contains POPUP_INITIALIZED
  const eventEntries = await popupPage.$$eval('.diag-entry', (nodes) =>
    nodes.map((n) => n.textContent)
  );
  assert(eventEntries.length > 0, `Diagnostics list rendered ${eventEntries.length} event items`);
  const hasPopupInit = eventEntries.some((txt) => txt.includes('POPUP_INITIALIZED'));
  assert(hasPopupInit, 'POPUP_INITIALIZED diagnostic event captured in audit log');

  // Verify Clear Logs button functionality (expand details first)
  await popupPage.click('.diagnostics-summary');
  await new Promise((r) => setTimeout(r, 200));
  await popupPage.click('#clear-diag-btn');
  await new Promise((r) => setTimeout(r, 300));

  const postClearBadge = await popupPage.$eval('#diagnostics-count', (el) => el.textContent);
  const postClearEmptyState = await popupPage.$eval('.diagnostics-list', (el) => el.textContent);
  assert(postClearBadge === '0 events', `Post-clear count badge reports: "${postClearBadge}"`);
  assert(postClearEmptyState.includes('No diagnostic events'), 'Empty state placeholder rendered upon log clearing');

  console.log('\n----------------------------------------------------');
  if (failures > 0) {
    console.error(`[Test: Diagnostics Buffer] FAILED with ${failures} failure(s).`);
    process.exit(1);
  } else {
    console.log('[Test: Diagnostics Buffer] ALL DIAGNOSTICS TESTS PASSED.');
  }
} finally {
  await browser.close();
}
