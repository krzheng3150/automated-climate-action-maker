import { resolveNudgeCooldown, DEFAULT_NUDGE_COOLDOWN_HOURS, STORAGE_KEYS } from '../dist/index.js';

console.log('[Test: Nudge Cooldown] Verifying cooldown resolution logic...');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failures++;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

const HOUR = 60 * 60 * 1000;
const NOW = 1700000000000;

// --------------------------------------------------------------------------
// 1. Default cooldown constant
// --------------------------------------------------------------------------
assert(DEFAULT_NUDGE_COOLDOWN_HOURS === 22, `Default cooldown is 22 hours (got ${DEFAULT_NUDGE_COOLDOWN_HOURS})`);

// --------------------------------------------------------------------------
// 2. Storage keys registered
// --------------------------------------------------------------------------
assert(STORAGE_KEYS.NUDGE_COOLDOWNS === 'nudgeCooldowns', 'NUDGE_COOLDOWNS storage key registered');
assert(STORAGE_KEYS.NUDGE_CATEGORY_OVERRIDES === 'nudgeCategoryOverrides', 'NUDGE_CATEGORY_OVERRIDES storage key registered');

// --------------------------------------------------------------------------
// 3. First visit (no prior timestamp) — always allowed
// --------------------------------------------------------------------------
assert(
  resolveNudgeCooldown({ category: 'electronics', now: NOW, cooldowns: {}, overrides: {} }) === true,
  'First visit with no prior cooldown: allowed'
);

// --------------------------------------------------------------------------
// 4. Within default cooldown window — suppressed
// --------------------------------------------------------------------------
assert(
  resolveNudgeCooldown({
    category: 'electronics',
    now: NOW,
    cooldowns: { electronics: NOW - 10 * HOUR },
    overrides: {},
  }) === false,
  'Within 22h default cooldown: suppressed'
);

// --------------------------------------------------------------------------
// 5. After default cooldown expires — allowed
// --------------------------------------------------------------------------
assert(
  resolveNudgeCooldown({
    category: 'electronics',
    now: NOW,
    cooldowns: { electronics: NOW - 23 * HOUR },
    overrides: {},
  }) === true,
  'After 22h default cooldown: allowed'
);

// --------------------------------------------------------------------------
// 6. Exactly at boundary — allowed (>= comparison)
// --------------------------------------------------------------------------
assert(
  resolveNudgeCooldown({
    category: 'fashion',
    now: NOW,
    cooldowns: { fashion: NOW - 22 * HOUR },
    overrides: {},
  }) === true,
  'Exactly at 22h boundary: allowed'
);

// --------------------------------------------------------------------------
// 7. Category override — 7 day cooldown
// --------------------------------------------------------------------------
assert(
  resolveNudgeCooldown({
    category: 'fashion',
    now: NOW,
    cooldowns: { fashion: NOW - 3 * 24 * HOUR },
    overrides: { fashion: 168 },
  }) === false,
  '7-day override, only 3 days elapsed: suppressed'
);

assert(
  resolveNudgeCooldown({
    category: 'fashion',
    now: NOW,
    cooldowns: { fashion: NOW - 8 * 24 * HOUR },
    overrides: { fashion: 168 },
  }) === true,
  '7-day override, 8 days elapsed: allowed'
);

// --------------------------------------------------------------------------
// 8. Permanently disabled (-1) — always suppressed
// --------------------------------------------------------------------------
assert(
  resolveNudgeCooldown({
    category: 'books',
    now: NOW,
    cooldowns: {},
    overrides: { books: -1 },
  }) === false,
  'Permanently disabled (-1), no prior visit: suppressed'
);

assert(
  resolveNudgeCooldown({
    category: 'books',
    now: NOW,
    cooldowns: { books: NOW - 365 * 24 * HOUR },
    overrides: { books: -1 },
  }) === false,
  'Permanently disabled (-1), year-old timestamp: still suppressed'
);

// --------------------------------------------------------------------------
// 9. Override only affects its own category
// --------------------------------------------------------------------------
assert(
  resolveNudgeCooldown({
    category: 'electronics',
    now: NOW,
    cooldowns: { electronics: NOW - 23 * HOUR },
    overrides: { fashion: -1 },
  }) === true,
  'Fashion disabled does not affect electronics'
);

// --------------------------------------------------------------------------
// 10. 30-day override
// --------------------------------------------------------------------------
assert(
  resolveNudgeCooldown({
    category: 'home',
    now: NOW,
    cooldowns: { home: NOW - 15 * 24 * HOUR },
    overrides: { home: 720 },
  }) === false,
  '30-day override, 15 days elapsed: suppressed'
);

assert(
  resolveNudgeCooldown({
    category: 'home',
    now: NOW,
    cooldowns: { home: NOW - 31 * 24 * HOUR },
    overrides: { home: 720 },
  }) === true,
  '30-day override, 31 days elapsed: allowed'
);

console.log('----------------------------------------------------');
if (failures > 0) {
  console.error(`[Test: Nudge Cooldown] FAILED with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('[Test: Nudge Cooldown] ALL TESTS PASSED.');
}
