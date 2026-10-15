/// <reference types="chrome" />

// ============================================================================
// 1. Core Message Bus & Legacy Support
// ============================================================================

export interface ExtensionMessage<T = unknown> {
  type: 'HELLO' | 'GET_STATUS' | 'RECORD_ACTION';
  payload?: T;
}

export interface HelloStats {
  greetingCount: number;
}

export interface DomainFrequency {
  domain: string;
  count: number;
}

export interface HistoryScanResult {
  googleCount: number;
  nonGoogleCount: number;
  total: number;
  topDomains: DomainFrequency[];
  timestamp: number;
  timeframeDays: number;
}

export interface StreamStep {
  step: number;
  title: string;
  detail: string;
  progress: number;
  done?: boolean;
  payload?: HistoryScanResult;
  error?: string;
}

export const DEFAULT_SCAN_CONFIG = {
  timeframeDays: 7,
  maxResults: 2000,
} as const;

// ============================================================================
// 2. Extensible Multi-Source Platform & Ingestion Envelopes
// ============================================================================

export type ClientPlatform =
  | 'chromium'   // Chrome, Edge, Brave, Arc, Opera
  | 'gecko'      // Firefox Desktop & Mobile
  | 'desktop-os' // Native background daemon / helper
  | 'unknown';

export type IngestionMode =
  | 'manual_deep_audit'     // User-initiated deep scan (e.g. 7-30 days lookback)
  | 'scheduled_incremental' // Background alarm delta (e.g. last 1h)
  | 'event_driven_stream';  // Real-time passive observation

export type CollectionStrategy =
  | 'delta'    // Ingests only items added since last timestamp (History, Downloads)
  | 'snapshot' // Point-in-time census of state right now (Tabs, Bookmarks)
  | 'stream';  // Passive event-driven ledger

// ============================================================================
// 3. Base Signal Slot Interface (Open-Closed Pattern)
// ============================================================================

/**
 * Common metadata header shared by ALL signal slots.
 * Any new data source (tabs, bookmarks, system metrics) implements this base.
 */
export interface BaseSignalSlot {
  sourceKey: string;
  strategy: CollectionStrategy;
  collectedAt: number;
  durationMs: number;
  recordCount: number;
  confidenceScore: number; // 0.0 - 1.0 (signal quality / data completeness)
}

// ============================================================================
// 4. Concrete Domain Signal Slots
// ============================================================================

/** Slot 1: Historical Browsing Visits */
export interface HistorySignalSlot extends BaseSignalSlot {
  sourceKey: 'history';
  strategy: 'delta';
  lookbackDays: number;
  googleCount: number;
  nonGoogleCount: number;
  totalHits: number;
  topDomains: DomainFrequency[];
}

/** Slot 2: Active Tabs & Context */
export interface TabsSignalSlot extends BaseSignalSlot {
  sourceKey: 'tabs';
  strategy: 'snapshot';
  openTabCount: number;
  heavyMediaTabsCount: number; // Video / audio streaming tabs
  tabHoardingIndex: number;    // Normalized score representing memory pressure
  activeHostnames: string[];
}

/** Slot 3: Bookmarks (Curated Intent) */
export interface BookmarksSignalSlot extends BaseSignalSlot {
  sourceKey: 'bookmarks';
  strategy: 'snapshot';
  totalBookmarkCount: number;
  recentAdditionsCount?: number;
  folderCategoryCounts?: Record<string, number>;
}

/** Future Slot: Download Carbon Footprint */
export interface DownloadsSignalSlot extends BaseSignalSlot {
  sourceKey: 'downloads';
  strategy: 'delta';
  totalBytesDownloaded: number;
  heavyFilesCount: number;
}

/**
 * Open Polymorphic Signal Map.
 * Strongly typed for core slots, open string index for any future platform slot.
 */
export interface SignalSlotMap {
  history: HistorySignalSlot;
  tabs: TabsSignalSlot;
  bookmarks: BookmarksSignalSlot;
  downloads: DownloadsSignalSlot;
  [customSourceKey: string]: BaseSignalSlot;
}

// ============================================================================
// 5. Normalized Climate & Behavioral Projections
// ============================================================================

export type ArchetypeKey =
  | 'circular_deal_hunter'
  | 'purpose_seeker'
  | 'digital_minimalist'
  | 'civic_advocate'
  | 'general_browser';

export interface BehavioralProjection {
  primaryArchetype: ArchetypeKey;
  archetypeDistribution: Record<ArchetypeKey, number>; // Normalized to sum to 1.0
  recommendedActionsAvailable: number;
}

export interface EstimatedCarbonMetrics {
  networkTransferCo2Grams: number;
  deviceComputeDrainScore: number;
  circularRedirectionSavingsKg: number;
}

// ============================================================================
// 6. The Master Snapshot Contract: DigitalFootprintSnapshot
// ============================================================================

export interface DigitalFootprintSnapshot {
  /** Schema versioning for future-proof migrations */
  schemaVersion: 1;

  /** Unique snapshot ID & timestamp */
  snapshotId: string;
  createdAt: number;

  /** Platform and runtime context */
  platform: {
    client: ClientPlatform;
    os: string;
    extensionVersion: string;
    ingestionMode: IngestionMode;
  };

  /**
   * The Open Polymorphic Signal Registry.
   * Any slot can be present or absent without breaking consumers.
   */
  sources: Partial<SignalSlotMap>;

  /** High-level behavioral synthesis derived from active sources */
  projection: BehavioralProjection;

  /** Estimated footprint impact */
  carbonMetrics: EstimatedCarbonMetrics;

  /** Privacy & Data Hygiene Attestation */
  governance: {
    zeroNetworkTelemetry: true;
    rawUrlsRetained: false;
    retentionExpiresAt: number;
  };
}

// ============================================================================
// 7. Factory Functions & Signal Projection Helpers
// ============================================================================

export function createHistorySlot(
  scanResult: HistoryScanResult,
  options?: { durationMs?: number; confidenceScore?: number }
): HistorySignalSlot {
  return {
    sourceKey: 'history',
    strategy: 'delta',
    collectedAt: scanResult.timestamp,
    durationMs: options?.durationMs ?? 0,
    recordCount: scanResult.total,
    confidenceScore: options?.confidenceScore ?? (scanResult.total > 0 ? 0.95 : 0.5),
    lookbackDays: scanResult.timeframeDays,
    googleCount: scanResult.googleCount,
    nonGoogleCount: scanResult.nonGoogleCount,
    totalHits: scanResult.total,
    topDomains: scanResult.topDomains,
  };
}

export function synthesizeProjection(sources: Partial<SignalSlotMap>): {
  projection: BehavioralProjection;
  carbonMetrics: EstimatedCarbonMetrics;
} {
  const history = sources.history;
  const tabs = sources.tabs;

  // Behavioral archetype distribution estimation
  let circularScore = 0.2;
  let purposeScore = 0.2;
  let minimalistScore = 0.2;
  let civicScore = 0.2;
  let generalScore = 0.2;

  if (history && history.totalHits > 0) {
    const topDomainsStr = history.topDomains.map((d) => d.domain.toLowerCase()).join(' ');
    if (
      topDomainsStr.includes('backmarket') ||
      topDomainsStr.includes('ebay') ||
      topDomainsStr.includes('poshmark') ||
      topDomainsStr.includes('thredup')
    ) {
      circularScore += 0.35;
    }
    if (
      topDomainsStr.includes('un.org') ||
      topDomainsStr.includes('climate') ||
      topDomainsStr.includes('greenpeace') ||
      topDomainsStr.includes('nature')
    ) {
      civicScore += 0.35;
      purposeScore += 0.2;
    }
    if (tabs && tabs.openTabCount <= 5) {
      minimalistScore += 0.3;
    }
  }

  const sumScores = circularScore + purposeScore + minimalistScore + civicScore + generalScore;
  const dist: Record<ArchetypeKey, number> = {
    circular_deal_hunter: Number((circularScore / sumScores).toFixed(3)),
    purpose_seeker: Number((purposeScore / sumScores).toFixed(3)),
    digital_minimalist: Number((minimalistScore / sumScores).toFixed(3)),
    civic_advocate: Number((civicScore / sumScores).toFixed(3)),
    general_browser: Number((generalScore / sumScores).toFixed(3)),
  };

  // Find primary archetype
  let primaryArchetype: ArchetypeKey = 'general_browser';
  let maxScore = -1;
  for (const [key, val] of Object.entries(dist) as [ArchetypeKey, number][]) {
    if (val > maxScore) {
      maxScore = val;
      primaryArchetype = key;
    }
  }

  // Carbon metrics estimate
  // ~0.08g CO2 estimated per web page interaction / data transfer
  const pageViews = history?.totalHits ?? 0;
  const networkTransferCo2Grams = Number((pageViews * 0.08).toFixed(2));
  const deviceComputeDrainScore = Math.min(
    100,
    Math.round((tabs?.openTabCount ?? 1) * 3 + (history?.totalHits ?? 0) / 50)
  );
  const circularRedirectionSavingsKg = Number(
    (dist.circular_deal_hunter * 1.5 + dist.civic_advocate * 0.8).toFixed(2)
  );

  return {
    projection: {
      primaryArchetype,
      archetypeDistribution: dist,
      recommendedActionsAvailable: 4,
    },
    carbonMetrics: {
      networkTransferCo2Grams,
      deviceComputeDrainScore,
      circularRedirectionSavingsKg,
    },
  };
}

export function createDigitalFootprintSnapshot(options?: {
  ingestionMode?: IngestionMode;
  clientPlatform?: ClientPlatform;
  sources?: Partial<SignalSlotMap>;
  os?: string;
  extensionVersion?: string;
  retentionDays?: number;
}): DigitalFootprintSnapshot {
  const sources = options?.sources ?? {};
  const { projection, carbonMetrics } = synthesizeProjection(sources);
  const now = Date.now();
  const retentionMs = (options?.retentionDays ?? 30) * 24 * 60 * 60 * 1000;

  return {
    schemaVersion: 1,
    snapshotId: `snap_${now}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    platform: {
      client: options?.clientPlatform ?? 'chromium',
      os: options?.os ?? 'unknown',
      extensionVersion: options?.extensionVersion ?? '1.0.0',
      ingestionMode: options?.ingestionMode ?? 'manual_deep_audit',
    },
    sources,
    projection,
    carbonMetrics,
    governance: {
      zeroNetworkTelemetry: true,
      rawUrlsRetained: false,
      retentionExpiresAt: now + retentionMs,
    },
  };
}

// ============================================================================
// 8. Storage Key Registry & Schema Migration Framework
// ============================================================================

export const STORAGE_KEYS = {
  STATS: 'stats',
  LAST_HISTORY_SCAN: 'lastHistoryScan',
  FOOTPRINT_SNAPSHOT: 'footprintSnapshot',
  AUTO_SCAN_ENABLED: 'autoScanEnabled',
  LAST_INCREMENTAL_TIMESTAMP: 'lastIncrementalTimestamp',
  SCHEMA_VERSION: 'schemaVersion',
  PENDING_VISITS: 'pendingVisits',
  DIAGNOSTICS_LOG: 'diagnosticsLog',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// ============================================================================
// 8.1. Browser-Agnostic Diagnostics Architecture (Zero Host Console Pollution)
// ============================================================================

export interface DiagnosticEntry {
  id: string;
  timestamp: number;
  source: 'content' | 'background' | 'popup';
  level: 'info' | 'warn' | 'error';
  event: string;
  details?: string;
}

export const MAX_DIAGNOSTIC_LOGS = 50;

/**
 * Pure FIFO bounded append for diagnostic logs.
 * Keeps LevelDB storage footprint strictly < 50 KB.
 */
export function appendDiagnosticEntry(
  existingLogs: DiagnosticEntry[],
  newEntry: Omit<DiagnosticEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number },
  maxEntries = MAX_DIAGNOSTIC_LOGS
): DiagnosticEntry[] {
  const entry: DiagnosticEntry = {
    id: newEntry.id || `diag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: newEntry.timestamp || Date.now(),
    source: newEntry.source,
    level: newEntry.level,
    event: newEntry.event,
    details: newEntry.details,
  };

  const updated = [...existingLogs, entry];
  if (updated.length > maxEntries) {
    return updated.slice(updated.length - maxEntries);
  }
  return updated;
}

/**
 * Browser-agnostic async diagnostic recorder.
 * Writes directly to chrome.storage.local without touching host page window/console.
 */
export async function recordDiagnostic(
  entry: Omit<DiagnosticEntry, 'id' | 'timestamp'>,
  maxEntries = MAX_DIAGNOSTIC_LOGS
): Promise<DiagnosticEntry[]> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return [];
    }
    const data = await chrome.storage.local.get(STORAGE_KEYS.DIAGNOSTICS_LOG);
    const existing = Array.isArray(data[STORAGE_KEYS.DIAGNOSTICS_LOG])
      ? (data[STORAGE_KEYS.DIAGNOSTICS_LOG] as DiagnosticEntry[])
      : [];
    const updated = appendDiagnosticEntry(existing, entry, maxEntries);
    await chrome.storage.local.set({ [STORAGE_KEYS.DIAGNOSTICS_LOG]: updated });
    return updated;
  } catch {
    // Fail-safe: diagnostic logging must never throw or break caller logic
    return [];
  }
}

export interface StorageMigrationResult {
  migrated: boolean;
  fromVersion: number;
  toVersion: number;
  keysUpdated: string[];
}

/**
 * Validates and migrates stored data to the current schema (Schema Version 1).
 * Seamlessly upgrades legacy states (e.g. raw lastHistoryScan without footprintSnapshot)
 * while preserving user civic points and impact statistics.
 */
export function migrateStorageState(
  rawData: Record<string, unknown>
): { updatedState: Record<string, unknown>; result: StorageMigrationResult } {
  const updatedState: Record<string, unknown> = { ...rawData };
  const keysUpdated: string[] = [];

  const currentVersion = (rawData[STORAGE_KEYS.SCHEMA_VERSION] as number) || 0;
  let migrated = false;

  // 1. Upgrade stats structure if missing fields
  const rawStats = rawData[STORAGE_KEYS.STATS] as Record<string, unknown> | undefined;
  const initialStats = {
    greetingCount: 0,
    totalCo2SavedKg: 0,
    civicPoints: 0,
    actionsCount: 0,
  };

  if (!rawStats) {
    updatedState[STORAGE_KEYS.STATS] = initialStats;
    keysUpdated.push(STORAGE_KEYS.STATS);
    migrated = true;
  } else {
    let statsNeedsFix = false;
    const sanitizedStats = { ...initialStats, ...rawStats };
    for (const key of Object.keys(initialStats) as (keyof typeof initialStats)[]) {
      if (rawStats[key] === undefined) {
        statsNeedsFix = true;
      }
    }
    if (statsNeedsFix) {
      updatedState[STORAGE_KEYS.STATS] = sanitizedStats;
      keysUpdated.push(STORAGE_KEYS.STATS);
      migrated = true;
    }
  }

  // 2. Upgrade legacy lastHistoryScan to footprintSnapshot if snapshot is missing
  const legacyScan = rawData[STORAGE_KEYS.LAST_HISTORY_SCAN] as HistoryScanResult | undefined;
  const existingSnapshot = rawData[STORAGE_KEYS.FOOTPRINT_SNAPSHOT] as DigitalFootprintSnapshot | undefined;

  if (legacyScan && (!existingSnapshot || existingSnapshot.schemaVersion !== 1)) {
    // Keep domains bounded (top 100) to protect local storage footprint
    const boundedDomains = (legacyScan.topDomains || []).slice(0, 100);
    const sanitizedScan: HistoryScanResult = {
      ...legacyScan,
      topDomains: boundedDomains,
    };

    const historySlot = createHistorySlot(sanitizedScan);
    const migratedSnapshot = createDigitalFootprintSnapshot({
      ingestionMode: 'manual_deep_audit',
      clientPlatform: 'chromium',
      sources: {
        history: historySlot,
      },
    });

    updatedState[STORAGE_KEYS.FOOTPRINT_SNAPSHOT] = migratedSnapshot;
    keysUpdated.push(STORAGE_KEYS.FOOTPRINT_SNAPSHOT);
    migrated = true;
  }

  // 3. Mark current storage schema version
  if (currentVersion !== 1) {
    updatedState[STORAGE_KEYS.SCHEMA_VERSION] = 1;
    keysUpdated.push(STORAGE_KEYS.SCHEMA_VERSION);
    migrated = true;
  }

  return {
    updatedState,
    result: {
      migrated,
      fromVersion: currentVersion,
      toVersion: 1,
      keysUpdated,
    },
  };
}

// ============================================================================
// 9. Layer 1: Decoupled Incremental Ingestion Aggregator
// ============================================================================

export interface VisitedDomainDelta {
  domain: string;
  isGoogle: boolean;
}

/**
 * Pure mathematical aggregation of new visits into a HistorySignalSlot.
 * Runs in <2ms with zero recommendation or behavioral inference coupling.
 */
export function aggregateIncrementalVisits(
  currentSlot: HistorySignalSlot,
  newVisits: VisitedDomainDelta[]
): HistorySignalSlot {
  if (newVisits.length === 0) return currentSlot;

  let addedGoogle = 0;
  let addedNonGoogle = 0;
  const domainMap: Record<string, number> = {};

  for (const item of currentSlot.topDomains) {
    domainMap[item.domain] = item.count;
  }

  for (const visit of newVisits) {
    if (visit.isGoogle) {
      addedGoogle++;
    } else {
      addedNonGoogle++;
    }
    const cleanDomain = visit.domain.toLowerCase().trim();
    if (cleanDomain) {
      domainMap[cleanDomain] = (domainMap[cleanDomain] || 0) + 1;
    }
  }

  const boundedDomains: DomainFrequency[] = Object.entries(domainMap)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  const newGoogleCount = currentSlot.googleCount + addedGoogle;
  const newNonGoogleCount = currentSlot.nonGoogleCount + addedNonGoogle;
  const newTotal = newGoogleCount + newNonGoogleCount;

  return {
    ...currentSlot,
    collectedAt: Date.now(),
    recordCount: newTotal,
    googleCount: newGoogleCount,
    nonGoogleCount: newNonGoogleCount,
    totalHits: newTotal,
    topDomains: boundedDomains,
  };
}

// ============================================================================
// 10. Layer 2: Decoupled Recommendation & Intervention Engine
// ============================================================================

export interface ClimateActionRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'circular' | 'civic' | 'digital_efficiency' | 'clean_energy';
  estimatedCo2SavingsKg: number;
  potentialPoints: number;
}

/**
 * Pure recommendation engine that executes on-demand (e.g. popup rendering or in-page nudge).
 * Decoupled from the background ingestion loop.
 */
export function computeRecommendations(
  snapshot: DigitalFootprintSnapshot
): ClimateActionRecommendation[] {
  const archetype = snapshot.projection?.primaryArchetype || 'general_browser';
  const recommendations: ClimateActionRecommendation[] = [];

  switch (archetype) {
    case 'circular_deal_hunter':
      recommendations.push(
        {
          id: 'rec-circular-refurb',
          title: 'Prioritize Certified Refurbished',
          description: 'Search Back Market, Swappa, or eBay Refurbished before buying new electronics.',
          category: 'circular',
          estimatedCo2SavingsKg: 65.0,
          potentialPoints: 50,
        },
        {
          id: 'rec-circular-repair',
          title: 'Right-to-Repair Guides',
          description: 'Explore iFixit manuals to extend hardware lifespan before replacement.',
          category: 'circular',
          estimatedCo2SavingsKg: 35.0,
          potentialPoints: 30,
        }
      );
      break;

    case 'digital_minimalist':
      recommendations.push(
        {
          id: 'rec-minimalist-tabs',
          title: 'Hibernate Unused Tabs',
          description: 'Consolidate active tabs to reduce browser memory drain and background sync wattage.',
          category: 'digital_efficiency',
          estimatedCo2SavingsKg: 12.0,
          potentialPoints: 20,
        },
        {
          id: 'rec-minimalist-cache',
          title: 'Purge Local Media Cache',
          description: 'Keep local LevelDB and video buffer footprint minimal.',
          category: 'digital_efficiency',
          estimatedCo2SavingsKg: 5.0,
          potentialPoints: 15,
        }
      );
      break;

    case 'civic_advocate':
      recommendations.push(
        {
          id: 'rec-civic-comment',
          title: 'Submit EPA Clean Energy Comment',
          description: 'Voice support on pending regional clean energy regulatory dockets.',
          category: 'civic',
          estimatedCo2SavingsKg: 80.0,
          potentialPoints: 80,
        },
        {
          id: 'rec-civic-share',
          title: 'Share Climate Action Petitions',
          description: 'Amplify open environmental policy petitions across civic networks.',
          category: 'civic',
          estimatedCo2SavingsKg: 40.0,
          potentialPoints: 40,
        }
      );
      break;

    default:
      recommendations.push(
        {
          id: 'rec-general-search',
          title: 'Eco-Friendly Search Providers',
          description: 'Consider green search engines that plant trees or run on 100% renewables.',
          category: 'clean_energy',
          estimatedCo2SavingsKg: 15.0,
          potentialPoints: 25,
        },
        {
          id: 'rec-general-circular',
          title: 'Explore Secondhand Alternatives',
          description: 'Browse refurbished marketplaces when searching for tech hardware.',
          category: 'circular',
          estimatedCo2SavingsKg: 50.0,
          potentialPoints: 45,
        }
      );
      break;
  }

  return recommendations;
}
