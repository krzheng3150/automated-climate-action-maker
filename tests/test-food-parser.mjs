import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOOD_EMISSION_FACTORS,
  analyzeRecipe,
  getFoodFactor,
  parseIngredient,
  parseServings,
  suggestSwaps,
} from '../dist/food.js';

const __filename = fileURLToPath(import.meta.url);
const testsDir = path.dirname(__filename);
const load = (name) => JSON.parse(readFileSync(path.join(testsDir, 'fixtures', name), 'utf8'));

console.log('[Test: Food Parser] Verifying ingredient parsing, recipe footprint, and the lentil-blend swap...');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failures++;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

const within = (actual, expected, tolerance = 0.01) =>
  actual !== null && Math.abs(actual - expected) <= Math.max(0.05, Math.abs(expected) * tolerance);

// ----------------------------------------------------------------------------
// 1. Ingredient lines: expected foods and weights
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 1: Ingredient lines that must resolve ---');

const { positives, negatives } = load('ingredient-lines.json');
const knownIds = new Set(FOOD_EMISSION_FACTORS.map((f) => f.id));
let positiveFailures = 0;
for (const expected of positives) {
  const parsed = parseIngredient(expected.line);
  const wantStatus = expected.status ?? 'resolved';
  const okFood = parsed.foodId === expected.food && knownIds.has(expected.food);
  const okStatus = parsed.status === wantStatus;
  const okGrams = expected.grams === null ? parsed.grams === null : within(parsed.grams, expected.grams);
  if (!(okFood && okStatus && okGrams)) {
    positiveFailures++;
    console.error(
      `[FAIL] "${expected.line}" -> food=${parsed.foodId} status=${parsed.status} grams=${parsed.grams} (wanted ${expected.food}, ${wantStatus}, ${expected.grams})`
    );
  }
}
failures += positiveFailures;
assert(positiveFailures === 0, `All ${positives.length} real-world style lines resolve to the right food and weight`);

console.log('\n--- Test Part 2: Trap lines that must NOT map to a food ---');

let falsePositives = 0;
let wrongStatus = 0;
for (const trap of negatives) {
  const parsed = parseIngredient(trap.line);
  if (parsed.foodId !== null) {
    falsePositives++;
    console.error(`[FAIL] false positive: "${trap.line}" mapped to ${parsed.foodId}`);
  }
  if (parsed.status !== trap.status) {
    wrongStatus++;
    console.error(`[FAIL] "${trap.line}" status ${parsed.status}, wanted ${trap.status}`);
  }
}
failures += falsePositives + wrongStatus;
assert(falsePositives === 0, `Zero false positives across ${negatives.length} trap lines (broth, eggplant, cream cheese, ...)`);
assert(wrongStatus === 0, 'Trap lines get the expected status (ignored / unknown / ambiguous)');

// ----------------------------------------------------------------------------
// 2. Robustness
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 3: Robustness ---');

for (const weird of ['', ' ', '???', '1', '½', '0 cups flour', '1/0 cup flour', '-5 g beef', '1e9999 g ground beef']) {
  let result;
  try {
    result = parseIngredient(weird);
  } catch (err) {
    result = { error: err.message };
  }
  assert(!result.error && result.grams === null && result.status !== 'resolved', `Odd input ${JSON.stringify(weird)} never resolves to a weight`);
}
assert(throwsNothing(() => analyzeRecipe({ ingredients: [] })), 'Empty ingredient list is handled');
function throwsNothing(fn) {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
}

const started = Date.now();
parseIngredient(`1 cup ${'ground beef and '.repeat(2000)}`);
parseIngredient('1 ' + '('.repeat(5000));
parseIngredient('1 ' + 'a '.repeat(20000));
assert(Date.now() - started < 1000, 'Very long or pathological lines parse in under a second');

const first = JSON.stringify(parseIngredient('2 lbs 80/20 ground beef'));
assert(first === JSON.stringify(parseIngredient('2 lbs 80/20 ground beef')), 'Parsing is deterministic');

// ----------------------------------------------------------------------------
// 3. Servings
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 4: Servings ---');

const { recipes, servings } = load('recipes.json');
for (const item of servings) {
  const got = parseServings(item.value);
  const ok = item.expect === null ? got === null : got !== null && got.servings === item.expect && (item.approx ?? false) === got.approx;
  assert(ok, `recipeYield ${JSON.stringify(item.value)} -> ${item.expect === null ? 'not servings' : item.expect}`);
}

// ----------------------------------------------------------------------------
// 4. Recipes: footprint and swap
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 5: Recipe footprint and swap suggestions ---');

const beefFactor = getFoodFactor('beef-ground-raw').kgCo2ePerKg;
const lentilFactor = getFoodFactor('lentils-cooked').kgCo2ePerKg;

for (const recipe of recipes) {
  const analysis = analyzeRecipe(recipe);
  const swaps = suggestSwaps(analysis);

  if (recipe.swap === null) {
    assert(swaps.length === 0, `${recipe.name}: stays silent`);
    continue;
  }

  const swap = swaps[0];
  assert(swaps.length === 1 && swap.id === recipe.swap, `${recipe.name}: suggests ${recipe.swap}`);
  if (!swap) continue;

  assert(analysis.complete === recipe.complete, `${recipe.name}: complete=${recipe.complete}`);
  assert(swap.replaceFraction === 0.33 && swap.evidence.length === 3, `${recipe.name}: uses the evidence-derived 33% default with its 3 sources`);
  assert(
    within(swap.lineKgCo2eBefore, (beefFactor * swap.fromGramsBefore) / 1000, 1e-9) &&
      within(swap.lineKgCo2eAfter, (beefFactor * swap.fromGramsAfter + lentilFactor * swap.toGrams) / 1000, 1e-9) &&
      Math.abs(swap.lineReductionPercent - ((swap.lineKgCo2eBefore - swap.lineKgCo2eAfter) / swap.lineKgCo2eBefore) * 100) <= 2.5,
    `${recipe.name}: swap numbers are computed from the emission table, not hardcoded`
  );
  assert(
    swap.lineKgCo2eAfter < swap.lineKgCo2eBefore && within(swap.fromGramsAfter + swap.toGrams, swap.fromGramsBefore, 1e-9),
    `${recipe.name}: lowers emissions and keeps total mass the same`
  );
  if (recipe.beefGrams) assert(within(swap.fromGramsBefore, recipe.beefGrams), `${recipe.name}: sums all ground-beef lines (${recipe.beefGrams} g)`);
  if (recipe.caveatContains) assert(swap.caveats.some((c) => c.includes(recipe.caveatContains)), `${recipe.name}: includes the burger texture caveat`);

  if (recipe.dishReduction === null) {
    assert(swap.dish.reductionPercent === null && swap.dish.perServingAfter === null, `${recipe.name}: no whole-dish figure when some ingredients are not understood`);
  } else {
    const [low, high] = recipe.dishReduction;
    assert(
      swap.dish.reductionPercent >= low && swap.dish.reductionPercent <= high,
      `${recipe.name}: whole-dish reduction ${swap.dish.reductionPercent}% is within ${low}-${high}%`
    );
    assert(
      within(swap.dish.perServingBefore * analysis.servings, analysis.totalKgCo2e, 1e-9) && swap.dish.perServingAfter < swap.dish.perServingBefore,
      `${recipe.name}: per-serving figures are consistent with the total`
    );
  }
}

// Whole-dish totals must equal the sum of the resolved lines (no hidden terms)
const chili = analyzeRecipe(recipes[0]);
assert(
  within(chili.totalKgCo2e, chili.lines.reduce((sum, l) => sum + (l.kgCo2e ?? 0), 0), 1e-9),
  'Chili: dish total equals the sum of its line footprints'
);
assert(chili.byCategory['beef'] > 0.8 * chili.totalKgCo2e, 'Chili: beef accounts for most of the footprint (sanity)');

console.log('----------------------------------------------------');
if (failures > 0) {
  console.error(`[Test: Food Parser] FAILED with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('[Test: Food Parser] ALL CHECKS PASSED.');
}
