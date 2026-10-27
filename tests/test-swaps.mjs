import { readFileSync } from 'node:fs';
import { buildSwapRules, evidenceShare, loadFoodIds, SWAPS_PATH } from '../scripts/generate-swaps.mjs';
import { SWAP_RULES, analyzeRecipe, getFoodFactor, suggestSwaps } from '../dist/food.js';
import { discover } from '../scripts/discover-swaps.mjs';

console.log('[Test: Swaps] Verifying the evidence-backed swap registry...');

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failures++;
  } else {
    console.log(`[PASS] ${message}`);
  }
}
const throwsWith = (fn, text) => {
  try {
    fn();
    return false;
  } catch (err) {
    return String(err.message).includes(text);
  }
};

const data = JSON.parse(readFileSync(SWAPS_PATH, 'utf8'));
const foodIds = loadFoodIds();
const clone = () => JSON.parse(JSON.stringify(data));
const build = (d) => buildSwapRules({ data: d, foodIds });

// 1. The shipped registry
const rules = build(data);
assert(rules.length === data.rules.length && rules.length === SWAP_RULES.length, 'Every rule in data/swaps.json compiles into the bundle');
for (const rule of data.rules) {
  const compiled = SWAP_RULES.find((r) => r.id === rule.id);
  const shares = rule.evidence.map(evidenceShare);
  assert(compiled && compiled.replaceFraction.default <= Math.min(...shares) + 1e-9, `${rule.id}: shipped default never exceeds the weakest evidence`);
  assert(compiled && compiled.replaceFraction.max <= Math.max(...shares) + 1e-9, `${rule.id}: range stays inside the evidence`);
  assert(rule.evidence.every((e) => e.checked && e.url.startsWith('https://')), `${rule.id}: every evidence entry has an https link and a checked date in the data file`);
}

// 2. Validation failure modes: each must stop the build
const mutate = (fn) => {
  const d = clone();
  fn(d.rules[0]);
  return d;
};
assert(throwsWith(() => build(mutate((r) => (r.evidence = []))), 'evidence'), 'A rule without evidence is rejected');
assert(throwsWith(() => build(mutate((r) => (r.to = 'oat-drink'))), 'no emission factor'), 'A replacement food without a carbon number is rejected');
assert(throwsWith(() => build(mutate((r) => (r.from = ['pork-mince-raw']))), 'no emission factor'), 'A reduced food without a carbon number is rejected');
assert(throwsWith(() => build(mutate((r) => (r.to = r.from[0]))), 'itself'), 'Swapping a food for itself is rejected');
assert(throwsWith(() => build(mutate((r) => (r.evidence[0].url = 'http://example.org'))), 'https'), 'Insecure evidence links are rejected');
assert(throwsWith(() => build(mutate((r) => (r.evidence[0].checked = 'last week'))), 'checked'), 'Evidence without a checked date is rejected');
assert(throwsWith(() => build(mutate((r) => (r.evidence[0].toGrams = 0))), 'toGrams'), 'Zero or negative grams are rejected');
assert(throwsWith(() => build(mutate((r) => (r.evidence[0].fromFood = 'chicken-raw'))), 'fromFood'), 'Evidence about a different food is rejected');
assert(throwsWith(() => build(mutate((r) => (r.dishPattern = '(unclosed'))), 'regular expression'), 'A broken dish pattern is rejected');
assert(throwsWith(() => build({ rules: [clone().rules[0], clone().rules[0]] }), 'duplicate'), 'Duplicate rule ids are rejected');

// 3. The ratio comes from evidence, not from a constant
const lean = mutate((r) => r.evidence.forEach((e) => ((e.toGrams = 50), (e.toMassFactor = 1))));
const leanDefault = build(lean)[0].replaceFraction.default;
assert(leanDefault < 0.15, `Weaker evidence gives a smaller default (${leanDefault}), so the ratio is derived`);

// 4. A rule for a different food works with no beef involved (food-agnostic engine)
const chickenRule = {
  ...SWAP_RULES[0],
  id: 'chicken-to-chickpeas',
  from: ['chicken-raw'],
  to: 'chickpeas-cooked',
  dishPattern: '\\bcurry\\b',
  excludePattern: null,
  minFromGrams: 200,
  dishCaveats: [],
};
const curry = analyzeRecipe({ name: 'Chicken Curry', ingredients: ['1 lb chicken breast', '1 can coconut milk (13.5 oz)'] });
const found = suggestSwaps(curry, [chickenRule])[0];
assert(found && found.fromFoodIds[0] === 'chicken-raw' && found.toFoodId === 'chickpeas-cooked' && found.lineKgCo2eAfter < found.lineKgCo2eBefore, 'The engine swaps any food pair it is given, not just beef');
assert(suggestSwaps(curry).length === 0, 'Rules only fire for the foods and dishes they name');

// 5. Discovery reads recipe pages but only reports; unusable pages are named, not guessed at
const page = (recipe) => `<html><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Recipe', ...recipe })}</script></html>`;
const pages = {
  'https://a.test/good': page({ name: 'Beef and Lentil Chili', recipeYield: '6 servings', recipeIngredient: ['1 lb ground beef', '1 cup dry lentils', '1 can (15 oz) diced tomatoes'] }),
  'https://a.test/nocarbon': page({ name: 'Beef Chili', recipeIngredient: ['1 lb ground beef', '1 can black beans'] }),
  'https://a.test/noamount': page({ name: 'Beef and Lentil Chili', recipeIngredient: ['ground beef', '1 cup dry lentils'] }),
  'https://a.test/placeholder': page({ name: 'Chili', recipeIngredient: ['__PLACEHOLDER_ING__'] }),
  'https://a.test/bare': '<html><body>no structured data</body></html>',
};
const discovered = await discover(Object.keys(pages), {
  analyzeRecipe,
  getFoodFactor,
  rules: SWAP_RULES,
  read: async (url) => pages[url],
  delayMs: 0,
});
const byUrl = (u) => discovered.find((r) => r.url === u);
const good = byUrl('https://a.test/good');
assert(good?.status === 'candidate' && good.fromGrams === 453.6 && Math.abs(good.share - 0.504) < 0.01, 'Discovery turns a real alternate into a candidate with the right share');
assert(good?.perServing && Math.abs(good.perServing.fromGrams - 75.6) < 0.2, 'Candidates carry per-serving amounts when servings are known');
assert(byUrl('https://a.test/nocarbon').status === 'skip', 'A recipe without the replacement food teaches nothing');
assert(byUrl('https://a.test/noamount').status === 'reject', 'A changed ingredient with no readable amount is rejected');
assert(byUrl('https://a.test/placeholder').status === 'no-structured-recipe', 'Template placeholders are not treated as recipes');
assert(byUrl('https://a.test/bare').status === 'no-structured-recipe', 'Pages without structured data are reported, not guessed');
assert(throwsWith(() => { throw new Error('x'); }, 'x') && (await discover(Array(21).fill('https://a.test/good'), { analyzeRecipe, getFoodFactor, rules: SWAP_RULES, read: async () => '', delayMs: 0 }).then(() => false, (e) => e.message.includes('at most'))), 'A run is capped at 20 pages');

console.log('----------------------------------------------------');
if (failures > 0) {
  console.error(`[Test: Swaps] FAILED with ${failures} failure(s).`);
  process.exit(1);
}
console.log('[Test: Swaps] ALL CHECKS PASSED.');
