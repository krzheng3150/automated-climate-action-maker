import { getFoodFactor } from './emissions';
import { analyzeRecipe } from './recipe';
import { suggestSwaps } from './swaps';

/**
 * The only food entry point the background worker needs: takes the plain text a content script
 * collected (untrusted), and returns at most one display-ready suggestion or null. Everything
 * the card shows is computed here, so the content script carries no food data.
 */

export interface RecipeSuggestionView {
  ruleId: string;
  title: string;
  summary: string;
  fromLabel: string;
  toLabel: string;
  /** Amounts in grams, rounded to the nearest 5 for display. */
  fromGramsBefore: number;
  fromGramsAfter: number;
  toGrams: number;
  lineReductionPercent: number;
  dishReductionPercent: number | null;
  /** kg CO2e saved by the changed foods if the recipe is made as suggested. */
  co2eSavedKg: number;
  evidenceCount: number;
  caveat: string | null;
  tips: string[];
}

const MAX_LINES = 150;
const MAX_LINE_LENGTH = 300;
const MAX_TEXT = 500;

const text = (value: unknown, max = MAX_TEXT): string => (typeof value === 'string' ? value.slice(0, max) : '');
const textOrList = (value: unknown): string | string[] | undefined => {
  if (typeof value === 'string') return value.slice(0, MAX_TEXT);
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string').slice(0, 20).map((v) => v.slice(0, 100));
  return undefined;
};
const round5 = (grams: number): number => Math.max(5, Math.round(grams / 5) * 5);

export function suggestForRecipe(input: unknown): RecipeSuggestionView | null {
  if (typeof input !== 'object' || input === null) return null;
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw['ingredients'])) return null;

  const ingredients = raw['ingredients']
    .filter((line): line is string => typeof line === 'string')
    .slice(0, MAX_LINES)
    .map((line) => line.slice(0, MAX_LINE_LENGTH));
  if (ingredients.length === 0) return null;

  const rawYield = raw['recipeYield'];
  const analysis = analyzeRecipe({
    name: text(raw['name'], 200),
    ingredients,
    recipeYield: typeof rawYield === 'number' || typeof rawYield === 'string' || Array.isArray(rawYield) ? rawYield : undefined,
    keywords: textOrList(raw['keywords']),
    category: textOrList(raw['category']),
    cuisine: textOrList(raw['cuisine']),
  });

  const best = suggestSwaps(analysis)[0];
  if (!best) return null;
  const labels = (ids: string[]): string => ids.map((id) => (getFoodFactor(id)?.label ?? id).replace(/\s*\(.*?\)/g, '').toLowerCase()).join(' / ');

  return {
    ruleId: best.id,
    title: best.title,
    summary: best.summary,
    fromLabel: labels(best.fromFoodIds),
    toLabel: labels([best.toFoodId]),
    fromGramsBefore: round5(best.fromGramsBefore),
    fromGramsAfter: round5(best.fromGramsAfter),
    toGrams: round5(best.toGrams),
    lineReductionPercent: best.lineReductionPercent,
    dishReductionPercent: best.dish.reductionPercent,
    co2eSavedKg: Math.round((best.lineKgCo2eBefore - best.lineKgCo2eAfter) * 100) / 100,
    evidenceCount: best.evidence.length,
    caveat: best.caveats[0] ?? null,
    tips: best.tips.slice(0, 2),
  };
}
