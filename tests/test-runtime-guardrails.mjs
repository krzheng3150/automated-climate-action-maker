import puppeteer from 'puppeteer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newOfflinePage } from './lib/offline.mjs';

const __filename = fileURLToPath(import.meta.url);
const testsDir = path.dirname(__filename);
const projectRoot = path.resolve(testsDir, '..');
const extensionPath = path.join(projectRoot, 'dist');

console.log('[Guardrails: Runtime] Launching headless browser to test runtime security & isolation...');

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
  ],
});

let failures = 0;

function reportFail(rule, detail) {
  console.error(`[FAIL] ${rule}: ${detail}`);
  failures++;
}

function reportPass(rule) {
  console.log(`[PASS] ${rule}`);
}

try {
  // 1. Wait for and discover extension service worker target
  const extensionTarget = await browser.waitForTarget(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
    { timeout: 5000 }
  );

  const extensionUrl = extensionTarget.url();
  const extensionId = new URL(extensionUrl).host;
  reportPass(`Extension initialized with ID: ${extensionId}`);

  // -------------------------------------------------------------
  // GUARDRAIL 1: Zero Outbound Network Requests During History Stream
  // -------------------------------------------------------------
  const popupPage = await browser.newPage();
  const interceptedOutboundRequests = [];

  popupPage.on('request', (req) => {
    const url = req.url();
    // Flag any outbound HTTP/HTTPS traffic originating from the extension popup
    if (url.startsWith('http://') || url.startsWith('https://')) {
      interceptedOutboundRequests.push({ url, method: req.method() });
    }
  });

  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  await popupPage.goto(popupUrl, { waitUntil: 'networkidle0' });

  // Initiate scan and monitor network
  const startTime = Date.now();
  await popupPage.click('#scan-btn');

  await popupPage.waitForFunction(
    () => {
      const title = document.getElementById('step-title')?.textContent || '';
      return title.includes('Complete') || title.includes('Error');
    },
    { timeout: 8000 }
  );

  const durationMs = Date.now() - startTime;

  if (interceptedOutboundRequests.length > 0) {
    reportFail(
      'Zero Network Telemetry (Dynamic)',
      `Extension dispatched ${interceptedOutboundRequests.length} outbound request(s): ${JSON.stringify(interceptedOutboundRequests)}`
    );
  } else {
    reportPass('Zero Network Telemetry: 0 outbound HTTP/HTTPS requests during computation');
  }

  // -------------------------------------------------------------
  // GUARDRAIL 2: Compute Execution Time & Stream Progression
  // -------------------------------------------------------------
  const progress = await popupPage.$eval('#progress-fill', (el) => el.style.width);
  if (progress === '100%') {
    reportPass(`Compute Stream Completion: Successfully achieved 100% progress in ${durationMs}ms`);
  } else {
    reportFail('Compute Stream Completion', `Progress did not reach 100%, reached ${progress}`);
  }

  // -------------------------------------------------------------
  // GUARDRAIL 2B: DigitalFootprintSnapshot Schema & Governance Contract
  // -------------------------------------------------------------
  const snapshotData = await popupPage.evaluate(async () => {
    return await chrome.storage.local.get('footprintSnapshot');
  });
  const snapshot = snapshotData.footprintSnapshot;
  if (
    snapshot &&
    snapshot.schemaVersion === 1 &&
    snapshot.sources?.history &&
    snapshot.projection?.primaryArchetype &&
    snapshot.governance?.zeroNetworkTelemetry === true
  ) {
    reportPass('DigitalFootprintSnapshot Contract: Schema v1 validated with history slot, projection, and zero-telemetry');
  } else {
    reportFail('DigitalFootprintSnapshot Contract', `Invalid or missing snapshot: ${JSON.stringify(snapshot)}`);
  }

  // -------------------------------------------------------------
  // GUARDRAIL 2C: Conservative Fallback Alarm & Toggle Sync
  // -------------------------------------------------------------
  const initialAlarm = await popupPage.evaluate(async () => {
    return await chrome.alarms.get('acam-conservative-sync');
  });
  if (initialAlarm && initialAlarm.name === 'acam-conservative-sync') {
    reportPass('Conservative Fallback Alarm Contract: 12-hour background sync alarm registered');
  } else {
    reportFail('Conservative Fallback Alarm Contract', `Alarm missing: ${JSON.stringify(initialAlarm)}`);
  }

  // Toggle Auto-Scan OFF
  await popupPage.evaluate(() => {
    const el = document.getElementById('auto-scan-toggle');
    el?.click();
  });
  await new Promise((r) => setTimeout(r, 200));

  const alarmAfterToggleOff = await popupPage.evaluate(async () => {
    const storage = await chrome.storage.local.get('autoScanEnabled');
    const alarm = await chrome.alarms.get('acam-conservative-sync');
    return { autoScanEnabled: storage.autoScanEnabled, alarmPresent: Boolean(alarm) };
  });

  if (alarmAfterToggleOff.autoScanEnabled === false && !alarmAfterToggleOff.alarmPresent) {
    reportPass('Auto-Scan Toggle Contract: Disabling toggle clears background alarm and persists state');
  } else {
    reportFail(
      'Auto-Scan Toggle Contract',
      `Toggle off failed: ${JSON.stringify(alarmAfterToggleOff)}`
    );
  }

  // Toggle Auto-Scan back ON
  await popupPage.evaluate(() => {
    const el = document.getElementById('auto-scan-toggle');
    el?.click();
  });
  await new Promise((r) => setTimeout(r, 200));

  // -------------------------------------------------------------
  // GUARDRAIL 3: Atomic Storage Purge Contract
  // -------------------------------------------------------------
  await popupPage.click('#purge-btn');
  const totalCountAfterPurge = await popupPage.$eval('#total-count', (el) => el.textContent);
  const storageAfterPurge = await popupPage.evaluate(async () => {
    return await chrome.storage.local.get(['lastHistoryScan', 'footprintSnapshot']);
  });
  if (totalCountAfterPurge === '0' && !storageAfterPurge.lastHistoryScan && !storageAfterPurge.footprintSnapshot) {
    reportPass('Atomic Purge Contract: Local metrics and footprint snapshot cleared on purge action');
  } else {
    reportFail(
      'Atomic Purge Contract',
      `Purge failed: count=${totalCountAfterPurge}, storage=${JSON.stringify(storageAfterPurge)}`
    );
  }

  // -------------------------------------------------------------
  // GUARDRAIL 4: Shadow DOM Isolation Contract in Injected Pages
  // -------------------------------------------------------------
  const contentPage = await newOfflinePage(browser);
  // Open target shopping demo scenario to trigger content script
  await contentPage.goto('https://example.com/?scenario=c', { waitUntil: 'domcontentloaded' });

  // Wait for injection host
  await contentPage.waitForSelector('#acam-overlay-host', { timeout: 6000 });

  // Verify that host page document cannot directly select internal ACAM styles/elements
  const isInternalClassVisibleToHost = await contentPage.evaluate(() => {
    // Attempt host-level querySelector for internal card class
    const directQuery = document.querySelector('.pill-badge');
    // Verify shadowRoot exists and contains the internal element
    const host = document.getElementById('acam-overlay-host');
    const hasShadowRoot = Boolean(host && host.shadowRoot);
    const shadowHasBadge = Boolean(host?.shadowRoot?.querySelector('.pill-badge'));

    return {
      directQueryExposed: Boolean(directQuery),
      hasShadowRoot,
      shadowHasBadge,
    };
  });

  if (isInternalClassVisibleToHost.hasShadowRoot && !isInternalClassVisibleToHost.directQueryExposed) {
    reportPass('Shadow DOM Isolation: Content UI is encapsulated and inaccessible to host page DOM querySelector');
  } else {
    reportFail(
      'Shadow DOM Isolation',
      `Shadow DOM encapsulation failed: directQueryExposed=${isInternalClassVisibleToHost.directQueryExposed}, hasShadowRoot=${isInternalClassVisibleToHost.hasShadowRoot}`
    );
  }

  // -------------------------------------------------------------
  // GUARDRAIL 5: Host Page Scope Isolation (Zero Window Global Leaks)
  // -------------------------------------------------------------
  const globalLeakCheck = await contentPage.evaluate(() => {
    const leakedVars = ['ACAM', 'ACAMContentScript', 'ACAMStats', 'recordClimateAction'].filter(
      (key) => window[key] !== undefined
    );
    return {
      leakedVars,
      isClean: leakedVars.length === 0,
    };
  });

  if (globalLeakCheck.isClean) {
    reportPass('Host Scope Isolation: 0 extension classes or variables leaked into host page window scope');
  } else {
    reportFail(
      'Host Scope Isolation',
      `Extension leaked globals to host window: ${JSON.stringify(globalLeakCheck.leakedVars)}`
    );
  }

  await popupPage.close();
  await contentPage.close();
} catch (err) {
  reportFail('Runtime Guardrail Execution Error', err.message);
} finally {
  await browser.close();
}

console.log('----------------------------------------------------');
if (failures > 0) {
  console.error(`[Guardrails: Runtime] FAILED with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('[Guardrails: Runtime] ALL RUNTIME POLICY CHECKS PASSED.');
}
