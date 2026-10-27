import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractRecipes } from './lib/recipe-page.mjs';

/**
 * Discovery: the always-on, read-only half of the swap pipeline. Given recipe pages (URLs or local
 * HTML files), it reads each recipe, runs the ingredient analyzer, and records what each rule
 * would learn from it in data/discovery/inbox.json (git-ignored, never shipped). It never edits
 * data/swaps.json: accepting a candidate is a separate human step (scripts/curate-swaps.mjs).
 *
 *   node scripts/discover-swaps.mjs <url-or-file> [...]
 *
 * Fetching is manual and low volume: one request every 2 seconds, at most 20 pages per run, with
 * an honest user agent. Only derived numbers are written, never recipe text.
 */

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
export const INBOX_PATH = path.join(projectRoot, 'data', 'discovery', 'inbox.json');
const MAX_PAGES = 20;
const DELAY_MS = 2000;

/** Dry legumes and grains weigh more once cooked; the same factor as data/swaps.json notes. */
const DRY_TO_COOKED = 2.4;

const roundTo = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Foods that count as "the replacement" for a rule: same product, any state (lentils-dry, lentils-canned...). */
const familyOf = (foodId) => foodId.replace(/-(?:dry|cooked|canned|raw)$/, '');

/**
 * What one recipe says about one rule. Pure: takes the analyzer's output, no network.
 * Rejects (with a reason) anything where a changed food has no carbon number, an amount is
 * unknown, or the recipe has no from-food at all.
 */
export function evaluateRecipe({ analysis, rule, getFoodFactor, url, source }) {
  const base = { ruleId: rule.id, url, source, name: analysis.name, servings: analysis.servings };
  const fromLines = analysis.lines.filter((l) => l.foodId && rule.from.includes(l.foodId));
  const toLines = analysis.lines.filter((l) => l.foodId && familyOf(l.foodId) === familyOf(rule.to));

  if (fromLines.length === 0) return { ...base, status: 'skip', reason: 'no ingredient the rule reduces' };
  if (toLines.length === 0) return { ...base, status: 'skip', reason: 'no replacement food in this recipe' };
  const changed = [...fromLines, ...toLines];
  if (changed.some((l) => !getFoodFactor(l.foodId))) return { ...base, status: 'reject', reason: 'a changed food has no carbon number' };
  if (changed.some((l) => l.grams === null)) return { ...base, status: 'reject', reason: 'a changed ingredient has no readable amount' };

  const fromGrams = fromLines.reduce((sum, l) => sum + l.grams, 0);
  const toListed = toLines.reduce((sum, l) => sum + l.grams, 0);
  const toGrams = toLines.reduce((sum, l) => sum + l.grams * (l.foodId.endsWith('-dry') && rule.to.endsWith('-cooked') ? DRY_TO_COOKED : 1), 0);
  const toFoods = [...new Set(toLines.map((l) => l.foodId))];
  const share = toGrams / (fromGrams + toGrams);
  const lowestEvidence = rule.replaceFraction.min;

  return {
    ...base,
    status: 'candidate',
    fromFood: fromLines[0].foodId,
    fromGrams: roundTo(fromGrams),
    toFoods,
    toGramsListed: roundTo(toListed),
    toGramsCookedEquivalent: roundTo(toGrams),
    share: roundTo(share, 3),
    perServing: analysis.servings ? { fromGrams: roundTo(fromGrams / analysis.servings), toGrams: roundTo(toGrams / analysis.servings) } : null,
    insideKnownRange: share >= rule.replaceFraction.min - 0.05 && share <= rule.replaceFraction.max + 0.05,
    belowDefault: share < lowestEvidence,
  };
}

async function readPage(target) {
  if (existsSync(target)) return readFileSync(target, 'utf8');
  if (!/^https:\/\//.test(target)) throw new Error('not an https URL or an existing file');
  const response = await fetch(target, { headers: { 'user-agent': 'ACAM-research (manual, low volume; krzheng3150@gmail.com)' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function discover(targets, { analyzeRecipe, getFoodFactor, rules, read = readPage, delayMs = DELAY_MS }) {
  if (targets.length > MAX_PAGES) throw new Error(`at most ${MAX_PAGES} pages per run (got ${targets.length})`);
  const results = [];
  for (const [i, target] of targets.entries()) {
    if (i > 0 && delayMs) await new Promise((r) => setTimeout(r, delayMs));
    let html;
    try {
      html = await read(target);
    } catch (err) {
      results.push({ url: target, status: 'error', reason: String(err.message) });
      continue;
    }
    const recipes = extractRecipes(html);
    if (recipes.length === 0) {
      results.push({ url: target, status: 'no-structured-recipe', reason: 'no JSON-LD Recipe on the page' });
      continue;
    }
    for (const recipe of recipes) {
      if (recipe.ingredients.some((line) => /__PLACEHOLDER|{{/.test(line))) {
        results.push({ url: target, status: 'no-structured-recipe', reason: 'ingredient list is a template placeholder' });
        continue;
      }
      const analysis = analyzeRecipe(recipe);
      for (const rule of rules) {
        results.push(evaluateRecipe({ analysis, rule, getFoodFactor, url: target, source: new URL(target.startsWith('http') ? target : 'https://local.invalid').hostname }));
      }
    }
  }
  return results;
}

if (process.argv[1] === __filename) {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error('usage: node scripts/discover-swaps.mjs <https-url-or-html-file> [...]');
    process.exit(1);
  }
  const { analyzeRecipe, getFoodFactor, SWAP_RULES } = await import('../dist/food.js');
  const results = await discover(targets, { analyzeRecipe, getFoodFactor, rules: SWAP_RULES });
  mkdirSync(path.dirname(INBOX_PATH), { recursive: true });
  const previous = existsSync(INBOX_PATH) ? JSON.parse(readFileSync(INBOX_PATH, 'utf8')) : [];
  writeFileSync(INBOX_PATH, JSON.stringify([...previous, ...results.map((r) => ({ ...r, found: new Date().toISOString().slice(0, 10) }))], null, 2));
  for (const r of results) {
    console.log(`${r.status.padEnd(22)} ${r.ruleId ?? '-'} ${r.url}${r.share !== undefined ? `  share=${r.share} from=${r.fromGrams}g to≈${r.toGramsCookedEquivalent}g servings=${r.servings ?? '?'}` : r.reason ? `  (${r.reason})` : ''}`);
  }
  console.log(`\nWrote ${results.length} result(s) to data/discovery/inbox.json (not shipped). Curate with scripts/curate-swaps.mjs.`);
}
