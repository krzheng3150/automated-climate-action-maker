import { resolveRegion, inferFromDomains, COUNTRY_NAMES } from '../dist/civic/region.js';
import { computeTopicAffinities, topTopics, ALL_TOPICS } from '../dist/civic/topics.js';
import { matchCivicActions, getFallbackPlatforms } from '../dist/civic/recommend.js';
import { CIVIC_ACTIONS, CIVIC_DATA_META } from '../dist/civic/data.js';

console.log('[Test: Civic Actions] Verifying region detection, topic affinity, and action ranking...');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failures++;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Region detection from domains
// ---------------------------------------------------------------------------
console.log('\n--- Region Detection ---');

const ukDomains = [
  { domain: 'bbc.co.uk', count: 30 },
  { domain: 'theguardian.com', count: 20 },
  { domain: 'google.com', count: 50 },
];
const ukResult = inferFromDomains(ukDomains);
assert(ukResult !== null && ukResult.country === 'GB', 'UK news domains infer GB');

const caDomains = [
  { domain: 'cbc.ca', count: 40 },
  { domain: 'globalnews.ca', count: 15 },
  { domain: 'google.com', count: 30 },
];
const caResult = inferFromDomains(caDomains);
assert(caResult !== null && caResult.country === 'CA', 'Canadian news domains infer CA');

const auDomains = [
  { domain: 'abc.net.au', count: 25 },
  { domain: 'smh.com.au', count: 20 },
];
const auResult = inferFromDomains(auDomains);
assert(auResult !== null && auResult.country === 'AU', 'Australian news domains infer AU');

const tldDomains = [
  { domain: 'spiegel.de', count: 20 },
  { domain: 'random-shop.de', count: 30 },
];
const deResult = inferFromDomains(tldDomains);
assert(deResult !== null && deResult.country === 'DE', 'German TLDs infer DE');

const emptyResult = inferFromDomains([]);
assert(emptyResult === null, 'Empty domains returns null');

const genericResult = inferFromDomains([{ domain: 'google.com', count: 100 }]);
assert(genericResult === null || genericResult.country !== undefined, 'Generic domain handled gracefully');

// Override
const overrideResult = resolveRegion(ukDomains, 'FR');
assert(overrideResult.country === 'FR' && overrideResult.source === 'override', 'Manual override takes precedence');
assert(overrideResult.confidence === 1.0, 'Override has full confidence');

// Country names
assert(COUNTRY_NAMES['US'] === 'United States', 'US name lookup');
assert(COUNTRY_NAMES['GB'] === 'United Kingdom', 'GB name lookup');
assert(COUNTRY_NAMES['JP'] === 'Japan', 'JP name lookup');

// ---------------------------------------------------------------------------
// Topic affinity
// ---------------------------------------------------------------------------
console.log('\n--- Topic Affinity ---');

const civicSnapshot = {
  projection: {
    archetypeDistribution: {
      circular_deal_hunter: 0.0,
      purpose_seeker: 0.1,
      digital_minimalist: 0.0,
      civic_advocate: 0.8,
      general_browser: 0.1,
    },
  },
  sources: {
    history: {
      topDomains: [
        { domain: 'epa.gov', count: 10 },
        { domain: 'sierraclub.org', count: 5 },
      ],
    },
  },
};
const civicAff = computeTopicAffinities(civicSnapshot);
assert(civicAff.policy > 0.5, 'Civic advocate has high policy affinity');
assert(civicAff.energy > 0, 'Civic advocate has some energy affinity');
const civicTop = topTopics(civicAff, 3);
assert(civicTop.includes('policy'), 'Policy is a top topic for civic advocate');

const circularSnapshot = {
  projection: {
    archetypeDistribution: {
      circular_deal_hunter: 0.7,
      purpose_seeker: 0.1,
      digital_minimalist: 0.1,
      civic_advocate: 0.0,
      general_browser: 0.1,
    },
  },
  sources: {
    history: {
      topDomains: [
        { domain: 'backmarket.com', count: 15 },
        { domain: 'ifixit.com', count: 8 },
      ],
    },
  },
};
const circAff = computeTopicAffinities(circularSnapshot);
assert(circAff['circular-economy'] > 0.5, 'Circular archetype has high circular-economy affinity');
const circTop = topTopics(circAff, 3);
assert(circTop.includes('circular-economy'), 'Circular-economy is a top topic');

// Null snapshot fallback
const nullAff = computeTopicAffinities(null);
assert(nullAff.energy > 0, 'Null snapshot still returns baseline affinities');
assert(nullAff.policy > 0, 'Null snapshot has policy baseline');

// Food swap bonus
const foodAff = computeTopicAffinities(circularSnapshot, true);
assert(foodAff.food > circAff.food, 'Food swap engagement boosts food affinity');

// All topics present
for (const topic of ALL_TOPICS) {
  assert(typeof civicAff[topic] === 'number', `Topic ${topic} has a numeric value`);
}

// ---------------------------------------------------------------------------
// Action ranking
// ---------------------------------------------------------------------------
console.log('\n--- Action Ranking ---');

const fakeActions = [
  { id: 'a1', title: 'Energy Petition', url: 'https://example.com/1', platform: 'Test', region: 'GB', topics: ['energy'], type: 'petition', signatures: 5000, fetchedAt: Date.now() },
  { id: 'a2', title: 'Policy Campaign', url: 'https://example.com/2', platform: 'Test', region: 'GB', topics: ['policy', 'fossil-fuels'], type: 'campaign', fetchedAt: Date.now() },
  { id: 'a3', title: 'US Only', url: 'https://example.com/3', platform: 'Test', region: 'US', topics: ['energy'], type: 'petition', fetchedAt: Date.now() },
  { id: 'a4', title: 'Global Action', url: 'https://example.com/4', platform: 'Test', region: 'global', topics: ['conservation'], type: 'campaign', fetchedAt: Date.now() },
  { id: 'a5', title: 'Expired', url: 'https://example.com/5', platform: 'Test', region: 'GB', topics: ['policy'], type: 'petition', deadline: '2020-01-01', fetchedAt: Date.now() },
];

const gbAffinities = { energy: 0.8, transport: 0.1, food: 0.0, 'fossil-fuels': 0.3, conservation: 0.2, waste: 0.0, policy: 0.6, 'circular-economy': 0.0 };
const ranked = matchCivicActions('GB', gbAffinities, fakeActions, 5);

assert(ranked.length <= 5, `Ranked results capped at max`);
assert(!ranked.some(a => a.id === 'a3'), 'US-only action filtered out for GB user');
assert(!ranked.some(a => a.id === 'a5'), 'Expired action filtered out');
assert(ranked.some(a => a.id === 'a4'), 'Global action included for GB user');
assert(ranked.every(a => typeof a.score === 'number'), 'All ranked actions have a score');
assert(ranked[0].score >= ranked[ranked.length - 1].score, 'Actions sorted by score descending');

// Topic relevance drives ranking
const policyOnly = { energy: 0.0, transport: 0.0, food: 0.0, 'fossil-fuels': 0.0, conservation: 0.0, waste: 0.0, policy: 1.0, 'circular-economy': 0.0 };
const policyRanked = matchCivicActions('GB', policyOnly, fakeActions, 2);
assert(policyRanked[0].topics.includes('policy'), 'Policy-focused user gets policy action first');

// Empty region
const emptyRanked = matchCivicActions('XX', gbAffinities, fakeActions, 3);
const onlyGlobal = emptyRanked.every(a => a.region === 'global');
assert(onlyGlobal || emptyRanked.length === 0, 'Unknown region only gets global actions');

// ---------------------------------------------------------------------------
// Fallback platforms
// ---------------------------------------------------------------------------
console.log('\n--- Fallback Platforms ---');

const usFallback = getFallbackPlatforms('US');
assert(usFallback.length > 0, 'US has fallback platforms');
assert(usFallback.every(p => p.name && p.url), 'Fallback platforms have name and url');

const unknownFallback = getFallbackPlatforms('XX');
assert(unknownFallback.length > 0, 'Unknown region falls back to global platforms');

// ---------------------------------------------------------------------------
// Generated data integrity
// ---------------------------------------------------------------------------
console.log('\n--- Generated Data ---');

assert(CIVIC_ACTIONS.length > 0, `Civic actions data is non-empty (${CIVIC_ACTIONS.length} actions)`);
assert(CIVIC_ACTIONS.length === CIVIC_DATA_META.actionCount, 'Action count matches metadata');
assert(CIVIC_DATA_META.regions.length > 0, 'At least one region in data');

const ids = new Set();
for (const a of CIVIC_ACTIONS) {
  assert(!ids.has(a.id), `Action ID "${a.id}" is unique`);
  ids.add(a.id);
}

for (const a of CIVIC_ACTIONS) {
  assert(typeof a.title === 'string' && a.title.length > 0, `Action "${a.id}" has a title`);
  assert(typeof a.url === 'string' && a.url.startsWith('https://'), `Action "${a.id}" has a valid URL`);
  assert(a.topics.length > 0, `Action "${a.id}" has at least one topic`);
  assert(['petition', 'comment', 'campaign', 'event'].includes(a.type), `Action "${a.id}" has a valid type`);
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log('\n----------------------------------------------------');
if (failures > 0) {
  console.error(`[Test: Civic Actions] FAILED with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('[Test: Civic Actions] ALL CHECKS PASSED.');
}
