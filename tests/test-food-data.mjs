import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOOD_DATA_META,
  FOOD_EMISSION_FACTORS,
  checkFoodData,
  co2eKgForGrams,
  getFoodFactor,
} from '../dist/food.js';
import {
  FOOD_MODULE_PATH,
  SYNTHESE_CSV_PATH,
  buildFoodTable,
  generateFoodData,
  renderFoodModule,
  verifyFoodBundle,
} from '../scripts/generate-food-data.mjs';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

console.log('[Test: Food Data] Verifying the AGRIBALYSE-derived emission table and its bundling...');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failures++;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

function throwsWith(fn, pattern) {
  try {
    fn();
    return false;
  } catch (err) {
    return pattern.test(err.message);
  }
}

const closeTo = (a, b) => Math.abs(a - b) < 1e-9;

// ----------------------------------------------------------------------------
// 1. Generator: joins and failure modes (fake CSV)
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 1: Generator joins and failure modes ---');

const csv = [
  'Code AGB,Code CIQUAL,Nom du Produit en Français,Changement climatique,DQR',
  '100,100,"Bœuf, haché, cru",35.7,2.9',
  '200,200,Lentille,0.58,2.8',
  '300_1,300,"Tomate, crue",0.75,2.7',
  '300_2,300,"Tomate de saison, crue",0.626,2.4',
  '400,400,Mystère,abc,2.0',
  ',,,,',
  ',,,,',
].join('\n');
const food = (over) => ({ id: 'beef', label: 'Beef', category: 'beef', state: 'raw', agb: '100', ...over });
const build = (foods) => buildFoodTable({ foods, csvText: csv });

const ok = build([food(), food({ id: 'lentils', label: 'Lentils', category: 'legume', state: 'dry', agb: '200' }), food({ id: 'tomato', agb: '300_1', category: 'vegetable' })]);
assert(ok.length === 3 && ok[0].kgCo2ePerKg === 35.7 && ok[0].nameFr === 'Bœuf, haché, cru' && ok[0].ciqual === '100', 'Joins on Code AGB and copies value, French name, CIQUAL code');
assert(ok[2].kgCo2ePerKg === 0.75 && ok[2].agb === '300_1' && ok[2].ciqual === '300', 'A seasonal variant is selected by its unique Code AGB, not the shared CIQUAL code');
assert(throwsWith(() => build([food({ agb: '999' })]), /not found/), 'Unknown Code AGB fails the build');
assert(throwsWith(() => build([food(), food()]), /duplicate id/), 'Duplicate ids fail the build');
assert(throwsWith(() => build([food({ agb: '400' })]), /not a positive number/), 'Non-numeric climate value fails the build');
assert(throwsWith(() => build([food({ state: 'fresh' })]), /state must be one of/), 'Unknown state fails the build');
assert(throwsWith(() => build([food({ id: 'Bad_Id' })]), /invalid id/), 'Malformed id fails the build');
assert(throwsWith(() => build([food({ label: '' })]), /non-empty "label"/), 'Empty required field fails the build');
assert(
  throwsWith(() => buildFoodTable({ foods: [food()], csvText: `${csv}\n100,100,Duplicate,1,1` }), /matches 2 rows/),
  'A Code AGB matching several rows fails instead of picking one'
);
assert(throwsWith(() => buildFoodTable({ foods: [food()], csvText: 'a,b\n1,2' }), /missing column/), 'CSV without the expected columns fails');

const rendered = renderFoodModule({ table: ok, version: 'v3.2', dataUpdatedAt: '2025-02-27T16:23:27.602Z' });
assert(rendered === renderFoodModule({ table: ok, version: 'v3.2', dataUpdatedAt: '2025-02-27T16:23:27.602Z' }), 'Rendering is deterministic');
assert(rendered.includes('Source ADEME, donnees AGRIBALYSE v3.2 - 2025') && rendered.includes('GENERATED FILE'), 'Generated module carries the attribution and generated-file header');
assert(/dataUpdatedAt: "2025-02-27"/.test(rendered), 'Metadata records the data-update date (date only)');

// ----------------------------------------------------------------------------
// 2. The committed table (as compiled into dist/food.js)
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 2: Table integrity ---');

const table = FOOD_EMISSION_FACTORS;
assert(table.length >= 30 && table.length === FOOD_DATA_META.count, `Table has ${table.length} foods and matches its metadata count`);
assert(new Set(table.map((f) => f.id)).size === table.length, 'Food ids are unique');
assert(new Set(table.map((f) => f.agb)).size === table.length, 'No AGRIBALYSE product is mapped twice');
assert(
  table.every((f) => f.id && f.label && f.category && f.state && f.agb && f.ciqual && f.nameFr && Number.isFinite(f.kgCo2ePerKg) && Number.isFinite(f.dqr)),
  'Every row has every field populated'
);
assert(table.every((f) => f.kgCo2ePerKg >= 0.1 && f.kgCo2ePerKg <= 100), 'Every factor is within 0.1-100 kg CO2e/kg (catches unit mistakes)');

const byCat = (...cats) => table.filter((f) => cats.includes(f.category)).map((f) => f.kgCo2ePerKg);
const redMeat = byCat('beef', 'lamb');
const midMeat = byCat('pork', 'poultry');
const staples = byCat('legume', 'soy', 'grain', 'vegetable', 'plant_fat');
assert(Math.min(...redMeat) > 2 * Math.max(...midMeat), 'Ordering: beef and lamb are more than 2x pork and poultry');
assert(Math.min(...midMeat) > 1.5 * Math.max(...staples), 'Ordering: pork and poultry are more than 1.5x legumes, soy, grains, vegetables');
assert(getFoodFactor('beef-ground-raw').kgCo2ePerKg > 10 * getFoodFactor('lentils-cooked').kgCo2ePerKg, 'Ordering: ground beef is over 10x cooked lentils');

// ----------------------------------------------------------------------------
// 3. Calculator
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 3: Calculator ---');

const beef = getFoodFactor('beef-ground-raw').kgCo2ePerKg;
assert(closeTo(co2eKgForGrams('beef-ground-raw', 1000), beef), '1000 g gives exactly the per-kg factor');
assert(closeTo(co2eKgForGrams('beef-ground-raw', 500), beef / 2), '500 g gives half the factor');
assert(co2eKgForGrams('beef-ground-raw', 0) === 0, '0 g gives 0');
assert(co2eKgForGrams('not-a-food', 100) === undefined, 'Unknown food is undefined, never zero');
for (const bad of [-1, NaN, Infinity, undefined, '500']) {
  assert(co2eKgForGrams('beef-ground-raw', bad) === undefined, `Invalid quantity ${String(bad)} is undefined`);
}
const status = checkFoodData();
assert(status.ok && status.count === table.length && status.version === FOOD_DATA_META.version, 'Runtime self-check passes on the bundled table');

// ----------------------------------------------------------------------------
// 4. Credit and bundling
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 4: Credit and bundling ---');

const notice = readFileSync(path.join(projectRoot, 'data', 'NOTICE'), 'utf8');
assert(notice.includes(`AGRIBALYSE ${FOOD_DATA_META.version}`), `data/NOTICE names the dataset version in use (${FOOD_DATA_META.version})`);
assert(notice.includes(FOOD_DATA_META.dataUpdatedAt), `data/NOTICE states the data-update date in use (${FOOD_DATA_META.dataUpdatedAt})`);

const generatedSource = readFileSync(FOOD_MODULE_PATH, 'utf8');
assert(generatedSource.includes(`donnees AGRIBALYSE ${FOOD_DATA_META.version}`), 'Generated module header carries the attribution');

const distDir = path.join(projectRoot, 'dist');
const bundled = verifyFoodBundle({ distDir });
assert(bundled.foods === table.length, `Built dist/background.js contains all ${bundled.foods} food ids and the dataset version`);

const scratch = path.join(projectRoot, '.cache', `test-food-${process.pid}`);
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
try {
  const ids = table.map((f) => f.id).join('|');
  const write = (file, text) => writeFileSync(path.join(scratch, file), text);
  write('background.js', `${ids}|${FOOD_DATA_META.version}`);
  write('content.js', 'nothing here');
  assert(verifyFoodBundle({ distDir: scratch }).foods === table.length, 'Bundle check passes for a bundle that has the table only in the background');

  write('content.js', `leak ${table[0].id}`);
  assert(throwsWith(() => verifyFoodBundle({ distDir: scratch }), /content\.js contains the food table/), 'Bundle check fails if the table leaks into the all-pages content script');

  write('content.js', 'nothing here');
  write('background.js', `${ids.split('|').slice(1).join('|')}|${FOOD_DATA_META.version}`);
  assert(throwsWith(() => verifyFoodBundle({ distDir: scratch }), /missing 1 food ids/), 'Bundle check fails if a food id is missing from the background bundle');

  write('background.js', ids);
  assert(throwsWith(() => verifyFoodBundle({ distDir: scratch }), /dataset version/), 'Bundle check fails if the dataset version is missing');

  rmSync(path.join(scratch, 'background.js'));
  assert(throwsWith(() => verifyFoodBundle({ distDir: scratch }), /background\.js is missing/), 'Bundle check fails if there is no background bundle');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// ----------------------------------------------------------------------------
// 5. Cross-check against the raw AGRIBALYSE download (local only)
// ----------------------------------------------------------------------------
console.log('\n--- Test Part 5: Committed table vs raw AGRIBALYSE CSV ---');

if (existsSync(SYNTHESE_CSV_PATH)) {
  let result;
  try {
    result = generateFoodData({ check: true });
  } catch (err) {
    result = { status: `error: ${err.message}` };
  }
  assert(result.status === 'unchanged', `Committed src/food/data.ts equals a fresh regeneration from the raw CSV (${result.status})`);
} else {
  console.log('[SKIP] data/raw/agribalyse/synthese.csv not present (gitignored). Run `npm run fetch:agribalyse` to enable this check locally.');
}

console.log('----------------------------------------------------');
if (failures > 0) {
  console.error(`[Test: Food Data] FAILED with ${failures} failure(s).`);
  process.exit(1);
} else {
  console.log('[Test: Food Data] ALL CHECKS PASSED.');
}
