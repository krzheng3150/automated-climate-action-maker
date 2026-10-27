import { IGNORABLE, LEXICON, type LexiconEntry, type MatchContext } from './lexicon';
import { GRAMS_PER_OUNCE, GRAMS_PER_POUND, normalizeLine, parseQuantity, type ParsedQuantity } from './quantity';

export type IngredientStatus = 'resolved' | 'ignored' | 'unknown_food' | 'unknown_quantity' | 'ambiguous';

export interface ParsedIngredient {
  raw: string;
  status: IngredientStatus;
  /** Id in the emission table, set for `resolved` and `unknown_quantity`. */
  foodId: string | null;
  grams: number | null;
  /** True when the grams came from a household measure, a count, a range, or a can's drained weight. */
  approxGrams: boolean;
}

const ML_PER_CUP = 236.588;

type Match = { id: string; start: number; end: number };

function matchFood(ctx: MatchContext): { entry: LexiconEntry } | 'ambiguous' | null {
  const found: Array<Match & { entry: LexiconEntry }> = [];
  for (const entry of LEXICON) {
    if (entry.when && !entry.when(ctx)) continue;
    if (entry.exclude.some((rx) => rx.test(ctx.head))) continue;
    for (const rx of entry.include) {
      const m = rx.exec(ctx.head);
      if (m) {
        found.push({ id: entry.id, start: m.index, end: m.index + m[0].length, entry });
        break;
      }
    }
  }
  if (found.length === 0) return null;
  if (found.length === 1) return { entry: (found[0] as (typeof found)[number]).entry };

  // Several foods matched: keep one only if its wording contains all the others ("ground beef"
  // inside "lean ground beef"); two separate foods ("ground beef or turkey") are ambiguous.
  const widest = found.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  const containsAll = found.every((f) => f.start >= widest.start && f.end <= widest.end);
  return containsAll ? { entry: widest.entry } : 'ambiguous';
}

function gramsFor(q: ParsedQuantity, entry: LexiconEntry, head: string): { grams: number; approx: boolean } | null {
  if (q.amount === null && q.sizeGrams === null) return null;
  const amount = q.amount ?? 1;
  const approxRange = q.isRange;
  const done = (grams: number, approx: boolean) => ({ grams, approx: approx || approxRange });

  switch (q.unit) {
    case 'g':
      return done(amount, false);
    case 'kg':
      return done(amount * 1000, false);
    case 'oz':
      return done(amount * GRAMS_PER_OUNCE, false);
    case 'lb':
      return done(amount * GRAMS_PER_POUND, false);
    case 'cup':
      return entry.cupG ? done(amount * entry.cupG, true) : null;
    case 'tbsp':
      return entry.cupG ? done((amount * entry.cupG) / 16, true) : null;
    case 'tsp':
      return entry.cupG ? done((amount * entry.cupG) / 48, true) : null;
    case 'ml':
      return entry.cupG ? done((amount / ML_PER_CUP) * entry.cupG, true) : null;
    case 'l':
      return entry.cupG ? done(((amount * 1000) / ML_PER_CUP) * entry.cupG, true) : null;
    case 'clove':
      return entry.cloveG ? done(amount * entry.cloveG, true) : null;
    case 'stick':
      return entry.stickG ? done(amount * entry.stickG, true) : null;
    case 'slice':
      return entry.sliceG ? done(amount * entry.sliceG, true) : null;
    case 'dozen':
      return entry.eachG ? done(amount * 12 * entry.eachG, true) : null;
    case 'can':
    case 'package':
      if (q.sizeGrams === null) return null;
      return done(amount * q.sizeGrams * (q.unit === 'can' ? (entry.drainedFraction ?? 1) : 1), true);
    case 'other':
      return null;
    case null:
      break;
  }

  // No unit: a count of items. "(8 oz each)" gives the item weight; a single whole item may carry
  // its total weight in the parenthetical ("1 whole chicken (4 lb)").
  if (q.sizeGrams !== null && (q.sizeIsEach || amount === 1)) return done(amount * q.sizeGrams, true);
  if (entry.cloveG && /\bcloves?\b/.test(head)) return done(amount * entry.cloveG, true);
  // A canned or packaged item without a stated size is not "one whole item".
  if (entry.eachG && !/\b(?:cans?|tins?|jars?|packages?|packets?|bags?)\b/.test(head)) return done(amount * entry.eachG, true);
  return null;
}

export function parseIngredient(line: string): ParsedIngredient {
  const base = { raw: line, foodId: null, grams: null, approxGrams: false };
  const q = parseQuantity(line);
  const full = normalizeLine(line);
  const head = (q.rest.split(',')[0] ?? '').trim();
  const ctx: MatchContext = {
    head,
    full,
    unit: q.unit,
    canned: q.unit === 'can' || /\b(?:cans?|tins?|canned|tinned)\b/.test(full),
  };

  const match = head ? matchFood(ctx) : null;
  if (match === 'ambiguous') return { ...base, status: 'ambiguous' };
  if (match === null) {
    return { ...base, status: IGNORABLE.test(full) ? 'ignored' : 'unknown_food' };
  }

  const grams = gramsFor(q, match.entry, head);
  if (!grams || !Number.isFinite(grams.grams) || grams.grams <= 0) {
    return { ...base, status: 'unknown_quantity', foodId: match.entry.id };
  }
  return { ...base, status: 'resolved', foodId: match.entry.id, grams: grams.grams, approxGrams: grams.approx };
}

const NON_SERVING_UNITS =
  /\b(?:cookies?|muffins?|cupcakes?|loaf|loaves|pieces?|bars?|rolls?|buns?|slices?|pancakes?|biscuits?|balls?|patt(?:y|ies)|burgers?|cups?|pints?|quarts?|gallons?|jars?|batch(?:es)?|dozen|pies?|tarts?|bagels?|donuts?|doughnuts?|brownies|crepes?|tortillas?|wraps?|skewers?)\b/;

/**
 * Servings from schema.org `recipeYield`, which may be a number, a string ("Serves 4-6"), or an
 * array of either. Yields counted in items ("12 cookies") are not servings and return null.
 */
export function parseServings(value: unknown): { servings: number; approx: boolean } | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseServings(item);
      if (parsed) return parsed;
    }
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? { servings: value, approx: false } : null;
  }
  if (typeof value !== 'string') return null;

  const text = normalizeLine(value);
  if (NON_SERVING_UNITS.test(text)) return null;
  const m = /(\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*(\d+(?:\.\d+)?))?/.exec(text);
  if (!m) return null;
  const low = Number(m[1]);
  const high = m[2] ? Number(m[2]) : null;
  const servings = high === null ? low : (low + high) / 2;
  return servings > 0 ? { servings, approx: high !== null } : null;
}
