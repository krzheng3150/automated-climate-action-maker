import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

export const SWAPS_PATH = path.join(projectRoot, 'data', 'swaps.json');
export const SWAPS_MODULE_PATH = path.join(projectRoot, 'src', 'food', 'swaps-data.ts');
const FOOD_MAP_PATH = path.join(projectRoot, 'data', 'food-map.json');

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/** Share of the meat-and-replacement mass that the replacement made up in one published recipe. */
export function evidenceShare(e) {
  const replacement = e.toGrams * e.toMassFactor;
  return replacement / (e.fromGrams + replacement);
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Rounds down to two decimals so the shipped default never exceeds the evidence minimum. */
const floor2 = (v) => Math.floor(v * 100 + 1e-9) / 100;

/**
 * Validates data/swaps.json against the known food ids and derives each rule's replace fraction
 * from its evidence. Throws on anything unsupported, so an unevidenced or carbon-less swap
 * fails the build instead of shipping.
 */
export function buildSwapRules({ data, foodIds }) {
  if (!isObject(data) || !Array.isArray(data.rules)) throw new Error('swaps.json needs a "rules" array');
  const known = new Set(foodIds);
  const seen = new Set();
  const rules = [];

  for (const rule of data.rules) {
    const id = rule?.id;
    const at = `rule "${id}"`;
    if (!nonEmpty(id)) throw new Error('every rule needs an id');
    if (seen.has(id)) throw new Error(`duplicate rule id "${id}"`);
    seen.add(id);

    if (!nonEmpty(rule.title)) throw new Error(`${at}: missing title`);
    if (!Array.isArray(rule.from) || rule.from.length === 0) throw new Error(`${at}: "from" must list at least one food`);
    for (const food of [...rule.from, rule.to]) {
      if (!known.has(food)) throw new Error(`${at}: "${food}" has no emission factor in data/food-map.json`);
    }
    if (rule.from.includes(rule.to)) throw new Error(`${at}: cannot replace a food with itself`);
    for (const key of ['dishPattern', 'excludePattern']) {
      if (rule[key] === undefined && key === 'excludePattern') continue;
      try {
        new RegExp(rule[key]);
      } catch {
        throw new Error(`${at}: ${key} is not a valid regular expression`);
      }
    }
    for (const extra of rule.dishCaveats ?? []) {
      try {
        new RegExp(extra.pattern);
      } catch {
        throw new Error(`${at}: dishCaveats pattern is not a valid regular expression`);
      }
      if (!nonEmpty(extra.text)) throw new Error(`${at}: dishCaveats entry needs text`);
    }
    if (!positive(rule.minFromGrams)) throw new Error(`${at}: minFromGrams must be a positive number`);
    if (!Array.isArray(rule.tips) || !Array.isArray(rule.caveats)) throw new Error(`${at}: tips and caveats must be arrays`);

    if (!Array.isArray(rule.evidence) || rule.evidence.length === 0) {
      throw new Error(`${at}: needs at least one evidence entry (a published alternate recipe)`);
    }
    const shares = [];
    for (const e of rule.evidence) {
      const label = `${at}, evidence "${e?.source}"`;
      if (!nonEmpty(e.source) || !/^https:\/\//.test(e.url ?? '')) throw new Error(`${label}: needs a source name and an https url`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.checked ?? '')) throw new Error(`${label}: "checked" must be a YYYY-MM-DD date`);
      if (!rule.from.includes(e.fromFood)) throw new Error(`${label}: fromFood "${e.fromFood}" is not one of the rule's "from" foods`);
      if (!known.has(e.toFood)) throw new Error(`${label}: toFood "${e.toFood}" has no emission factor`);
      for (const key of ['fromGrams', 'toGrams', 'toMassFactor']) {
        if (!positive(e[key])) throw new Error(`${label}: ${key} must be a positive number`);
      }
      if (e.servings !== null && !positive(e.servings)) throw new Error(`${label}: servings must be a positive number or null`);
      shares.push(evidenceShare(e));
    }

    const min = Math.min(...shares);
    const max = Math.max(...shares);
    const replaceFraction = { default: floor2(min), min: floor2(min), median: floor2(median(shares)), max: floor2(max) };
    if (!(replaceFraction.default > 0 && replaceFraction.default < 1)) {
      throw new Error(`${at}: derived replace fraction ${replaceFraction.default} is outside (0, 1)`);
    }

    rules.push({
      id,
      title: rule.title,
      from: rule.from,
      to: rule.to,
      dishPattern: rule.dishPattern,
      excludePattern: rule.excludePattern ?? null,
      minFromGrams: rule.minFromGrams,
      replaceFraction,
      evidenceCount: rule.evidence.length,
      // URLs stay in data/swaps.json: the extension never carries raw links (see the outbound helper).
      evidence: rule.evidence.map((e) => ({ source: e.source, checked: e.checked, share: Math.round(evidenceShare(e) * 1000) / 1000 })),
      tips: rule.tips,
      caveats: rule.caveats,
      dishCaveats: rule.dishCaveats ?? [],
    });
  }
  return rules;
}

export function renderSwapsModule(rules) {
  return [
    '// Generated by scripts/generate-swaps.mjs from data/swaps.json. Do not edit by hand.',
    '// Curated selections and derived ratios: Copyright (c) 2026 Kevin Zheng. See data/NOTICE.',
    '// Emission numbers come from the food table (ADEME AGRIBALYSE, see data/NOTICE), not from here.',
    '',
    'export interface SwapEvidence {',
    '  source: string;',
    '  checked: string;',
    '  /** Replacement share of the meat-plus-replacement mass in that recipe. */',
    '  share: number;',
    '}',
    '',
    'export interface SwapRule {',
    '  id: string;',
    '  title: string;',
    '  from: readonly string[];',
    '  to: string;',
    '  dishPattern: string;',
    '  excludePattern: string | null;',
    '  minFromGrams: number;',
    '  replaceFraction: { default: number; min: number; median: number; max: number };',
    '  evidenceCount: number;',
    '  evidence: readonly SwapEvidence[];',
    '  tips: readonly string[];',
    '  caveats: readonly string[];',
    '  dishCaveats: ReadonlyArray<{ pattern: string; text: string }>;',
    '}',
    '',
    `export const SWAP_RULES: readonly SwapRule[] = ${JSON.stringify(rules, null, 2)};`,
    '',
  ].join('\n');
}

export function loadFoodIds() {
  return JSON.parse(readFileSync(FOOD_MAP_PATH, 'utf8')).foods.map((f) => f.id);
}

/** Rebuilds src/food/swaps-data.ts. Returns whether the file changed. */
export function generateSwaps({ swapsPath = SWAPS_PATH, modulePath = SWAPS_MODULE_PATH, foodIds = loadFoodIds() } = {}) {
  const data = JSON.parse(readFileSync(swapsPath, 'utf8'));
  const rules = buildSwapRules({ data, foodIds });
  const next = renderSwapsModule(rules);
  let current = '';
  try {
    current = readFileSync(modulePath, 'utf8');
  } catch {
    // first run
  }
  if (current !== next) writeFileSync(modulePath, next);
  return { rules: rules.length, changed: current !== next };
}

if (process.argv[1] === __filename) {
  const result = generateSwaps();
  console.log(`[swaps] ${result.changed ? 'updated' : 'unchanged'} (${result.rules} rule${result.rules === 1 ? '' : 's'})`);
}
