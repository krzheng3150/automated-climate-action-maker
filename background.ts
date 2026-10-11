/// <reference types="chrome" />

import {
  DEFAULT_SCAN_CONFIG,
  STORAGE_KEYS,
  createDigitalFootprintSnapshot,
  createHistorySlot,
  migrateStorageState,
  type DigitalFootprintSnapshot,
  type DomainFrequency,
  type ExtensionMessage,
  type HelloStats,
  type HistoryScanResult,
  type StreamStep,
} from './index';

/**
 * Automated Climate Action Maker (ACAM) - Background Service Worker
 * Manages privacy-preserving on-device browsing analysis, trace streaming, and impact state.
 */

export interface ACAMStats extends HelloStats {
  totalCo2SavedKg: number;
  civicPoints: number;
  actionsCount: number;
}

interface RecordActionPayload {
  actionId: string;
  label: string;
  co2SavedKg: number;
  points: number;
}

async function runStorageMigration(): Promise<void> {
  try {
    const allData = await chrome.storage.local.get(null);
    const { updatedState, result } = migrateStorageState(allData);
    if (result.migrated) {
      await chrome.storage.local.set(updatedState);
      console.log(
        `[ACAM] Migrated storage schema v${result.fromVersion} -> v${result.toVersion}. Keys updated:`,
        result.keysUpdated
      );
    }
  } catch (err) {
    console.error('[ACAM] Storage migration error:', err);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await runStorageMigration();
  console.log('[ACAM] Service worker installed and storage initialized/migrated.');
});

chrome.runtime.onStartup.addListener(async () => {
  await runStorageMigration();
});

// Helper for smooth, observable streaming steps
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGoogleDomain(hostname: string): boolean {
  const cleanHost = hostname.toLowerCase();
  return (
    cleanHost === 'google.com' ||
    cleanHost.endsWith('.google.com') ||
    cleanHost === 'youtube.com' ||
    cleanHost.endsWith('.youtube.com') ||
    cleanHost === 'gmail.com' ||
    cleanHost.endsWith('.gmail.com') ||
    cleanHost.endsWith('.googlevideo.com') ||
    cleanHost.endsWith('.gstatic.com') ||
    cleanHost.endsWith('.googleusercontent.com')
  );
}

// Trace streaming port listener for foreground UI
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'acam-trace-stream') return;

  port.onMessage.addListener(async (msg: { action: string; timeframeDays?: number; maxResults?: number }) => {
    if (msg.action !== 'start') return;

    const timeframeDays = msg.timeframeDays ?? DEFAULT_SCAN_CONFIG.timeframeDays;
    const maxResults = msg.maxResults ?? DEFAULT_SCAN_CONFIG.maxResults;

    try {
      const hasHistory = await chrome.permissions.contains({ permissions: ['history'] });
      if (!hasHistory) {
        port.postMessage({
          step: -1,
          title: 'Permission Required',
          detail: 'Local history permission is not granted. Please click "Grant Local Access" in the popup.',
          progress: 0,
          error: 'PERMISSION_NOT_GRANTED',
        } satisfies StreamStep);
        return;
      }

      // STEP 1: Storage / DB initialization
      port.postMessage({
        step: 1,
        title: 'Accessing Local Storage',
        detail: 'Connecting to Chromium on-device history SQLite database (0 network traffic)...',
        progress: 15,
      } satisfies StreamStep);

      await delay(250);

      const startTime = Date.now() - timeframeDays * 24 * 60 * 60 * 1000;

      // STEP 2: Query history items into memory
      port.postMessage({
        step: 2,
        title: 'Memory Ingestion',
        detail: `Querying history from the past ${timeframeDays} days (capped at ${maxResults} records)...`,
        progress: 40,
      } satisfies StreamStep);

      const historyItems = await chrome.history.search({
        text: '',
        startTime,
        maxResults,
      });

      await delay(300);

      port.postMessage({
        step: 2,
        title: 'Memory Ingestion',
        detail: `Loaded ${historyItems.length} records into local RAM. Initiating regex & hostname evaluation...`,
        progress: 55,
      } satisfies StreamStep);

      await delay(250);

      // STEP 3: Domain Classification
      let googleCount = 0;
      let nonGoogleCount = 0;
      const domainMap: Record<string, number> = {};

      for (const item of historyItems) {
        if (!item.url) continue;
        try {
          const parsed = new URL(item.url);
          const hostname = parsed.hostname.toLowerCase();
          if (!hostname) continue;

          domainMap[hostname] = (domainMap[hostname] || 0) + (item.visitCount || 1);

          if (isGoogleDomain(hostname)) {
            googleCount++;
          } else {
            nonGoogleCount++;
          }
        } catch {
          // Ignore unparseable or internal pseudo-URLs (e.g. chrome://)
        }
      }

      const topDomains: DomainFrequency[] = Object.entries(domainMap)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      port.postMessage({
        step: 3,
        title: 'Domain Classification',
        detail: `Evaluated ${historyItems.length} items: ${googleCount} Google vs ${nonGoogleCount} non-Google across ${Object.keys(domainMap).length} distinct hostnames.`,
        progress: 80,
      } satisfies StreamStep);

      await delay(300);

      // STEP 4: Store results locally and dispatch completion
      const result: HistoryScanResult = {
        googleCount,
        nonGoogleCount,
        total: googleCount + nonGoogleCount,
        topDomains,
        timestamp: Date.now(),
        timeframeDays,
      };

      const historySlot = createHistorySlot(result, { durationMs: 1100 });
      const footprintSnapshot = createDigitalFootprintSnapshot({
        ingestionMode: 'manual_deep_audit',
        clientPlatform: 'chromium',
        sources: {
          history: historySlot,
        },
        extensionVersion: '0.1.0',
      });

      await chrome.storage.local.set({
        [STORAGE_KEYS.LAST_HISTORY_SCAN]: result,
        [STORAGE_KEYS.FOOTPRINT_SNAPSHOT]: footprintSnapshot,
      });

      port.postMessage({
        step: 4,
        title: 'Computation Complete',
        detail: 'Analysis stored in local storage sandbox. Zero data transmitted externally.',
        progress: 100,
        done: true,
        payload: result,
      } satisfies StreamStep);
    } catch (err) {
      console.error('[ACAM] History stream failed:', err);
      port.postMessage({
        step: -1,
        title: 'Analysis Error',
        detail: err instanceof Error ? err.message : 'Unknown execution error',
        progress: 100,
        error: String(err),
      } satisfies StreamStep);
    }
  });
});

// Regular runtime message dispatcher for content script interventions and stats
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ) => {
    if (message.type === 'HELLO') {
      handleGreeting().then((updatedStats) => {
        sendResponse({ success: true, message: 'Hello, World!', stats: updatedStats });
      });
      return true;
    }

    const msg = message as any;

    if (msg.type === 'RECORD_ACTION') {
      recordClimateAction(msg.payload).then((updatedStats) => {
        sendResponse({ success: true, stats: updatedStats });
      });
      return true;
    }

    if (message.type === 'GET_STATUS') {
      chrome.storage.local
        .get([STORAGE_KEYS.STATS, STORAGE_KEYS.LAST_HISTORY_SCAN, STORAGE_KEYS.FOOTPRINT_SNAPSHOT])
        .then((data) => {
          sendResponse({
            status: 'active',
            stats: data[STORAGE_KEYS.STATS] || { greetingCount: 0, totalCo2SavedKg: 0, civicPoints: 0, actionsCount: 0 },
            lastHistoryScan: data[STORAGE_KEYS.LAST_HISTORY_SCAN] || null,
            footprintSnapshot: data[STORAGE_KEYS.FOOTPRINT_SNAPSHOT] || null,
          });
        });
      return true;
    }

    return false;
  }
);

async function recordClimateAction(payload: RecordActionPayload): Promise<ACAMStats> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.STATS);
  const stats: ACAMStats = data[STORAGE_KEYS.STATS] || {
    greetingCount: 0,
    totalCo2SavedKg: 0,
    civicPoints: 0,
    actionsCount: 0,
  };

  stats.totalCo2SavedKg = Number((stats.totalCo2SavedKg + (payload.co2SavedKg || 0)).toFixed(2));
  stats.civicPoints += payload.points || 0;
  stats.actionsCount += 1;
  stats.greetingCount += 1;

  await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
  return stats;
}

async function handleGreeting(): Promise<HelloStats> {
  return recordClimateAction({
    actionId: 'greeting',
    label: 'Greeting',
    co2SavedKg: 0,
    points: 1,
  });
}
