import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

export const FOOD_MAP_PATH = path.join(projectRoot, 'data', 'food-map.json');
export const SYNTHESE_CSV_PATH = path.join(projectRoot, 'data', 'raw', 'agribalyse', 'synthese.csv');
export const MANIFEST_PATH = path.join(projectRoot, 'data', 'raw', 'agribalyse', 'manifest.json');
export const FOOD_MODULE_PATH = path.join(projectRoot, 'src', 'food', 'data.ts');

const COLUMNS = {
  agb: 'Code AGB',
  ciqual: 'Code CIQUAL',
  nameFr: 'Nom du Produit en Français',
  climate: 'Changement climatique',
  dqr: 'DQR',
};
const STATES = ['raw', 'dry', 'cooked', 'canned', 'as_sold'];

/**
 * Joins the curated mapping to the AGRIBALYSE synthese CSV. Throws on anything ambiguous
 * (unknown code, duplicate id, conflicting duplicate rows, non-numeric value) so a bad
 * mapping fails the build instead of shipping a wrong number.
 */
export function buildFoodTable({ foods, csvText }) {
  const { headers, rows } = parseCsv(csvText);
  const col = {};
  for (const [key, name] of Object.entries(COLUMNS)) {
    const idx = headers.findIndex((h) => h.replace(/\s+/g, ' ').trim() === name);
    if (idx === -1) throw new Error(`synthese CSV is missing column "${name}"`);
    col[key] = idx;
  }

  const byAgb = new Map();
  for (const row of rows) {
    const key = row[col.agb].trim();
    if (!byAgb.has(key)) byAgb.set(key, []);
    byAgb.get(key).push(row);
  }

  const seenIds = new Set();
  return foods.map((food) => {
    for (const field of ['id', 'label', 'category', 'state', 'agb']) {
      if (typeof food[field] !== 'string' || food[field] === '') {
        throw new Error(`food entry ${JSON.stringify(food)} needs a non-empty "${field}"`);
      }
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(food.id)) throw new Error(`invalid id "${food.id}"`);
    if (!STATES.includes(food.state)) throw new Error(`${food.id}: state must be one of ${STATES.join(', ')}`);
    if (seenIds.has(food.id)) throw new Error(`duplicate id "${food.id}"`);
    seenIds.add(food.id);

    const matches = byAgb.get(food.agb);
    if (!matches) throw new Error(`${food.id}: Code AGB ${food.agb} not found in synthese CSV`);
    if (matches.length > 1) throw new Error(`${food.id}: Code AGB ${food.agb} matches ${matches.length} rows, expected exactly one`);

    const kgCo2ePerKg = Number(matches[0][col.climate]);
    const dqr = Number(matches[0][col.dqr]);
    if (!Number.isFinite(kgCo2ePerKg) || kgCo2ePerKg <= 0) {
      throw new Error(`${food.id}: climate value "${matches[0][col.climate]}" is not a positive number`);
    }
    if (!Number.isFinite(dqr)) throw new Error(`${food.id}: DQR "${matches[0][col.dqr]}" is not a number`);

    return {
      id: food.id,
      label: food.label,
      category: food.category,
      state: food.state,
      agb: food.agb,
      ciqual: matches[0][col.ciqual].trim(),
      nameFr: matches[0][col.nameFr],
      kgCo2ePerKg,
      dqr,
    };
  });
}

/** Renders src/food/data.ts. Output is deterministic so the committed file can be diffed. */
export function renderFoodModule({ table, version, dataUpdatedAt }) {
  const date = dataUpdatedAt.slice(0, 10);
  const year = date.slice(0, 4);
  const q = (value) => JSON.stringify(value);
  const categories = [...new Set(table.map((f) => f.category))];

  const lines = [
    '// GENERATED FILE - do not edit by hand. Regenerate with `npm run generate:food` (also runs in `npm run build`).',
    `// Inputs: data/food-map.json joined to AGRIBALYSE ${version} synthese.csv (data last updated ${date}).`,
    `// Source ADEME, donnees AGRIBALYSE ${version} - ${year}. Licence Ouverte / Open Licence (Etalab). Credit text lives in data/NOTICE.`,
    '',
    `export type FoodCategory = ${categories.map(q).join(' | ')};`,
    `export type FoodState = ${STATES.map(q).join(' | ')};`,
    '',
    'export interface FoodEmissionFactor {',
    '  id: string;',
    '  label: string;',
    '  category: FoodCategory;',
    '  state: FoodState;',
    '  /** AGRIBALYSE product key (Code AGB) this factor comes from. */',
    '  agb: string;',
    '  /** CIQUAL food code of that product. */',
    '  ciqual: string;',
    '  /** AGRIBALYSE product name (French), kept for traceability. */',
    '  nameFr: string;',
    '  /** Climate change indicator, kg CO2e per kg of product, farm to plate. */',
    '  kgCo2ePerKg: number;',
    '  /** AGRIBALYSE data quality rating (lower is better). */',
    '  dqr: number;',
    '}',
    '',
    'export const FOOD_DATA_META = {',
    `  source: ${q('ADEME AGRIBALYSE')},`,
    `  version: ${q(version)},`,
    `  dataUpdatedAt: ${q(date)},`,
    `  indicator: ${q('Changement climatique (Environmental Footprint)')},`,
    `  unit: ${q('kg CO2e per kg of product')},`,
    `  count: ${table.length},`,
    '} as const;',
    '',
    'export const FOOD_EMISSION_FACTORS: readonly FoodEmissionFactor[] = [',
    ...table.map(
      (f) =>
        `  { id: ${q(f.id)}, label: ${q(f.label)}, category: ${q(f.category)}, state: ${q(f.state)}, agb: ${q(f.agb)}, ciqual: ${q(f.ciqual)}, nameFr: ${q(f.nameFr)}, kgCo2ePerKg: ${f.kgCo2ePerKg}, dqr: ${f.dqr} },`
    ),
    '];',
    '',
  ];
  return lines.join('\n');
}

/**
 * Regenerates src/food/data.ts when the raw AGRIBALYSE CSV is present (local builds).
 * Without it (CI, fresh clones) the committed file is used as is, but it must exist.
 * With `check: true` nothing is written and a stale committed file is an error.
 */
export function generateFoodData({
  mapPath = FOOD_MAP_PATH,
  csvPath = SYNTHESE_CSV_PATH,
  manifestPath = MANIFEST_PATH,
  outPath = FOOD_MODULE_PATH,
  check = false,
} = {}) {
  if (!existsSync(csvPath)) {
    if (!existsSync(outPath)) {
      throw new Error(`${path.relative(projectRoot, outPath)} is missing and ${path.relative(projectRoot, csvPath)} is not available to generate it. Run \`npm run fetch:agribalyse\`.`);
    }
    return { status: 'skipped-no-source' };
  }

  const map = JSON.parse(readFileSync(mapPath, 'utf8'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entry = manifest.files?.['synthese.csv'];
  if (!entry?.version || !entry?.dataUpdatedAt) {
    throw new Error('manifest.json has no version/dataUpdatedAt for synthese.csv. Re-run `npm run fetch:agribalyse -- --force`.');
  }

  const table = buildFoodTable({ foods: map.foods, csvText: readFileSync(csvPath, 'utf8') });
  const output = renderFoodModule({ table, version: entry.version, dataUpdatedAt: entry.dataUpdatedAt });
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;

  if (current === output) return { status: 'unchanged', count: table.length };
  if (check) throw new Error(`${path.relative(projectRoot, outPath)} is stale. Run \`npm run generate:food\` and commit the result.`);
  writeFileSync(outPath, output);
  return { status: 'written', count: table.length };
}

/**
 * Post-build proof that the table really ships: every food id and the dataset version must
 * appear in the background bundle (it is the only place the lookup runs), and none of them may
 * appear in the content script, which is injected on every page the user visits.
 */
export function verifyFoodBundle({ distDir = path.join(projectRoot, 'dist'), modulePath = FOOD_MODULE_PATH } = {}) {
  const source = readFileSync(modulePath, 'utf8');
  const ids = [...source.matchAll(/\{ id: "([a-z0-9-]+)"/g)].map((m) => m[1]);
  const version = /version: "([^"]+)"/.exec(source)?.[1];
  if (ids.length === 0 || !version) throw new Error(`${path.relative(projectRoot, modulePath)} has no foods or version`);

  const problems = [];
  const read = (file) => (existsSync(path.join(distDir, file)) ? readFileSync(path.join(distDir, file), 'utf8') : null);

  const background = read('background.js');
  if (background === null) problems.push('dist/background.js is missing');
  else {
    const missing = ids.filter((id) => !background.includes(id));
    if (missing.length > 0) problems.push(`dist/background.js is missing ${missing.length} food ids (e.g. ${missing[0]})`);
    if (!background.includes(version)) problems.push(`dist/background.js does not contain dataset version ${version}`);
  }
  for (const file of ['content.js', 'popup.js']) {
    const bundle = read(file);
    if (bundle !== null && ids.some((id) => bundle.includes(id))) {
      problems.push(`dist/${file} contains the food table; it must stay in the background bundle`);
    }
  }
  if (problems.length > 0) throw new Error(`Food data bundle check failed:\n  - ${problems.join('\n  - ')}`);
  return { foods: ids.length, version };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = generateFoodData({ check: process.argv.includes('--check') });
  console.log(`[Food data] ${result.status}${result.count ? ` (${result.count} foods)` : ''}`);
}
