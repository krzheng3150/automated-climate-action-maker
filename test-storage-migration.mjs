import { migrateStorageState, STORAGE_KEYS } from './dist/index.js';

console.log('[Test: Storage Migration] Verifying schema upgrade and data protection...');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failures++;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

try {
  // --------------------------------------------------------------------------
  // TEST CASE 1: Migrating Unversioned Legacy v0 State
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 1: Unversioned Legacy v0 State ---');

  // Generate 120 synthetic domains to test bounding/pruning
  const syntheticDomains = Array.from({ length: 120 }, (_, i) => ({
    domain: `site-${i}.org`,
    count: 120 - i,
  }));

  const legacyV0Data = {
    [STORAGE_KEYS.STATS]: {
      greetingCount: 12,
      totalCo2SavedKg: 45.5,
      // civicPoints and actionsCount missing in old versions
    },
    [STORAGE_KEYS.LAST_HISTORY_SCAN]: {
      googleCount: 150,
      nonGoogleCount: 350,
      total: 500,
      topDomains: syntheticDomains,
      timestamp: 1728500000000,
      timeframeDays: 7,
    },
  };

  const { updatedState, result } = migrateStorageState(legacyV0Data);

  assert(result.migrated === true, 'Migration flag reported true for legacy state');
  assert(result.fromVersion === 0, 'Correctly detected source schemaVersion 0');
  assert(result.toVersion === 1, 'Target schemaVersion is 1');
  assert(updatedState[STORAGE_KEYS.SCHEMA_VERSION] === 1, 'Schema version key set to 1 in storage');

  // Verify Footprint Snapshot creation & fields
  const snapshot = updatedState[STORAGE_KEYS.FOOTPRINT_SNAPSHOT];
  assert(Boolean(snapshot), 'DigitalFootprintSnapshot generated during migration');
  assert(snapshot?.schemaVersion === 1, 'Snapshot schemaVersion is 1');
  assert(snapshot?.sources?.history?.totalHits === 500, 'Snapshot history slot preserves totalHits (500)');
  assert(snapshot?.sources?.history?.googleCount === 150, 'Snapshot history slot preserves googleCount (150)');
  assert(snapshot?.governance?.zeroNetworkTelemetry === true, 'Snapshot governance guarantees zeroNetworkTelemetry');

  // Verify Bounded Domains (Top 100)
  const snapshotDomains = snapshot?.sources?.history?.topDomains || [];
  assert(
    snapshotDomains.length === 100,
    `Top domains pruned to 100 max entries (was 120, now ${snapshotDomains.length})`
  );

  // Verify Stats Preservation
  const stats = updatedState[STORAGE_KEYS.STATS];
  assert(stats?.greetingCount === 12, 'Existing greetingCount (12) preserved without data loss');
  assert(stats?.totalCo2SavedKg === 45.5, 'Existing totalCo2SavedKg (45.5) preserved without data loss');
  assert(stats?.civicPoints === 0, 'Missing civicPoints filled with default 0');
  assert(stats?.actionsCount === 0, 'Missing actionsCount filled with default 0');

  // --------------------------------------------------------------------------
  // TEST CASE 2: Idempotency (Already on v1 Schema)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 2: Idempotent Run on v1 State ---');
  const secondRun = migrateStorageState(updatedState);
  assert(secondRun.result.migrated === false, 'Second migration pass reports migrated=false');
  assert(secondRun.result.fromVersion === 1, 'Correctly identified existing version 1');

  // --------------------------------------------------------------------------
  // TEST CASE 3: Fresh Empty State Initialization
  // --------------------------------------------------------------------------
  console.log('\n--- Test Case 3: Empty Storage Initialization ---');
  const freshRun = migrateStorageState({});
  assert(freshRun.result.migrated === true, 'Fresh state initialized');
  assert(freshRun.updatedState[STORAGE_KEYS.SCHEMA_VERSION] === 1, 'Fresh schemaVersion set to 1');
  assert(Boolean(freshRun.updatedState[STORAGE_KEYS.STATS]), 'Fresh stats object created');
} catch (err) {
  console.error('[FAIL] Unexpected exception during test:', err);
  failures++;
}

console.log('\n----------------------------------------------------');
if (failures > 0) {
  console.error(`[Test: Storage Migration] FAILED with ${failures} error(s).`);
  process.exit(1);
} else {
  console.log('[Test: Storage Migration] ALL MIGRATION CHECKS PASSED.');
}
