/// <reference types="chrome" />

import {
  DEFAULT_SCAN_CONFIG,
  STORAGE_KEYS,
  aggregateIncrementalVisits,
  createDigitalFootprintSnapshot,
  createHistorySlot,
  migrateStorageState,
  recordDiagnostic,
  type DigitalFootprintSnapshot,
  type DomainFrequency,
  type ExtensionMessage,
  type HelloStats,
  type HistoryScanResult,
  type IngestionMode,
  type StreamStep,
  type VisitedDomainDelta,
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
      recordDiagnostic({
        source: 'background',
        level: 'info',
        event: 'STORAGE_MIGRATED',
        details: `Migrated schema v${result.fromVersion} -> v${result.toVersion} (${result.keysUpdated.length} keys)`,
      });
    }
  } catch (err) {
    recordDiagnostic({
      source: 'background',
      level: 'error',
      event: 'STORAGE_MIGRATION_ERROR',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

// Storage-backed visit buffer for activity-driven batching
const FLUSH_BATCH_SIZE = 10;
const CONSERVATIVE_ALARM_NAME = 'acam-conservative-sync';

async function getPendingVisits(): Promise<VisitedDomainDelta[]> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.PENDING_VISITS);
    const visits = data[STORAGE_KEYS.PENDING_VISITS];
    return Array.isArray(visits) ? (visits as VisitedDomainDelta[]) : [];
  } catch {
    return [];
  }
}

async function appendPendingVisit(visit: VisitedDomainDelta): Promise<number> {
  const current = await getPendingVisits();
  current.push(visit);
  await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_VISITS]: current });
  return current.length;
}

async function clearPendingVisits(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.PENDING_VISITS);
}

async function configureConservativeAlarm(enabled: boolean): Promise<void> {
  if (enabled) {
    chrome.alarms.create(CONSERVATIVE_ALARM_NAME, {
      periodInMinutes: 720, // 12-hour conservative fallback
    });
  } else {
    await chrome.alarms.clear(CONSERVATIVE_ALARM_NAME);
  }
}

async function flushPendingVisits(mode: IngestionMode = 'event_driven_stream'): Promise<void> {
  const batchToProcess = await getPendingVisits();
  if (batchToProcess.length === 0) return;

  // Clear pending buffer in storage before processing
  await clearPendingVisits();

  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.FOOTPRINT_SNAPSHOT,
      STORAGE_KEYS.AUTO_SCAN_ENABLED,
    ]);

    const autoScanEnabled = data[STORAGE_KEYS.AUTO_SCAN_ENABLED] !== false;
    if (!autoScanEnabled) return;

    let snapshot = data[STORAGE_KEYS.FOOTPRINT_SNAPSHOT] as DigitalFootprintSnapshot | undefined;
    if (!snapshot) {
      snapshot = createDigitalFootprintSnapshot({
        ingestionMode: mode,
        clientPlatform: 'chromium',
        extensionVersion: '1.0.0',
      });
    }

    const currentHistorySlot = snapshot.sources?.history ?? {
      sourceKey: 'history',
      strategy: 'delta',
      collectedAt: Date.now(),
      durationMs: 0,
      recordCount: 0,
      confidenceScore: 0.9,
      lookbackDays: 7,
      googleCount: 0,
      nonGoogleCount: 0,
      totalHits: 0,
      topDomains: [],
    };

    // Layer 1 pure aggregation (<2ms, decoupled from recommendations)
    const updatedSlot = aggregateIncrementalVisits(currentHistorySlot, batchToProcess);
    snapshot.sources.history = updatedSlot;
    snapshot.platform.ingestionMode = mode;

    await chrome.storage.local.set({
      [STORAGE_KEYS.FOOTPRINT_SNAPSHOT]: snapshot,
      [STORAGE_KEYS.LAST_INCREMENTAL_TIMESTAMP]: Date.now(),
    });

    recordDiagnostic({
      source: 'background',
      level: 'info',
      event: 'PENDING_VISITS_FLUSHED',
      details: `Processed ${batchToProcess.length} visits into on-device footprint (${mode})`,
    });
  } catch (err) {
    console.error('[ACAM] Failed to flush pending visits:', err);
  }
}

// Activity-Driven Trigger: Listen to new visits in real time
chrome.history.onVisited.addListener(async (item) => {
  if (!item.url) return;
  try {
    const parsed = new URL(item.url);
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname) return;

    const bufferCount = await appendPendingVisit({
      domain: hostname,
      isGoogle: isGoogleDomain(hostname),
    });

    if (bufferCount >= FLUSH_BATCH_SIZE) {
      await flushPendingVisits('event_driven_stream');
    }
  } catch {
    // Ignore internal or unparseable URLs
  }
});

// Conservative Fallback Alarm Listener
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CONSERVATIVE_ALARM_NAME) {
    await flushPendingVisits('scheduled_incremental');
  }
});

// React immediately to Auto-Scan toggle changes from popup
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEYS.AUTO_SCAN_ENABLED]) {
    const isEnabled = changes[STORAGE_KEYS.AUTO_SCAN_ENABLED].newValue !== false;
    await configureConservativeAlarm(isEnabled);
    if (!isEnabled) {
      await clearPendingVisits();
    }
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await runStorageMigration();
  const stored = await chrome.storage.local.get(STORAGE_KEYS.AUTO_SCAN_ENABLED);
  const autoScanEnabled = stored[STORAGE_KEYS.AUTO_SCAN_ENABLED] !== false;
  await configureConservativeAlarm(autoScanEnabled);
  recordDiagnostic({
    source: 'background',
    level: 'info',
    event: 'SERVICE_WORKER_INSTALLED',
    details: `Service worker installed. Auto-scan: ${autoScanEnabled ? 'enabled' : 'disabled'}`,
  });
});

chrome.runtime.onStartup.addListener(async () => {
  await runStorageMigration();
  const stored = await chrome.storage.local.get(STORAGE_KEYS.AUTO_SCAN_ENABLED);
  const autoScanEnabled = stored[STORAGE_KEYS.AUTO_SCAN_ENABLED] !== false;
  await configureConservativeAlarm(autoScanEnabled);
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
        extensionVersion: '1.0.0',
      });

      await chrome.storage.local.set({
        [STORAGE_KEYS.LAST_HISTORY_SCAN]: result,
        [STORAGE_KEYS.FOOTPRINT_SNAPSHOT]: footprintSnapshot,
      });

      recordDiagnostic({
        source: 'background',
        level: 'info',
        event: 'HISTORY_STREAM_COMPLETE',
        details: `Classified ${result.total} visits (${result.googleCount} Google vs ${result.nonGoogleCount} non-Google across ${result.topDomains.length} top domains)`,
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
      flushPendingVisits().then(() => {
        chrome.storage.local
          .get([
            STORAGE_KEYS.STATS,
            STORAGE_KEYS.LAST_HISTORY_SCAN,
            STORAGE_KEYS.FOOTPRINT_SNAPSHOT,
            STORAGE_KEYS.AUTO_SCAN_ENABLED,
          ])
          .then((data) => {
            sendResponse({
              status: 'active',
              stats: data[STORAGE_KEYS.STATS] || { greetingCount: 0, totalCo2SavedKg: 0, civicPoints: 0, actionsCount: 0 },
              lastHistoryScan: data[STORAGE_KEYS.LAST_HISTORY_SCAN] || null,
              footprintSnapshot: data[STORAGE_KEYS.FOOTPRINT_SNAPSHOT] || null,
              autoScanEnabled: data[STORAGE_KEYS.AUTO_SCAN_ENABLED] !== false,
            });
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

  recordDiagnostic({
    source: 'background',
    level: 'info',
    event: 'ACTION_RECORDED',
    details: `${payload.label}: +${payload.points} pts, +${payload.co2SavedKg} kg CO2 (Total: ${stats.civicPoints} pts)`,
  });

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
