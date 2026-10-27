import { getFoodFactor } from './emissions';
import type { RecipeAnalysis } from './recipe';
import { SWAP_RULES, type SwapRule } from './swaps-data';

export { SWAP_RULES, type SwapRule, type SwapEvidence } from './swaps-data';

/**
 * Intent-preserving swaps driven by the evidence-backed rules in data/swaps.json. A rule names
 * the foods to reduce, the food to use instead, and the dishes where that is plausible; it does
 * not care which food it is. Silence is the default: a swap is returned only when the dish fits
 * and the quantity of every food to be reduced was read with confidence. The comparison holds
 * every other ingredient (and so the number of servings) fixed: replaced mass is swapped
 * mass-for-mass, so only the changed foods differ.
 */

export interface SwapSuggestion {
  id: string;
  title: string;
  summary: string;
  fromFoodIds: string[];
  toFoodId: string;
  /** Total weight of the foods being reduced, before and after, in grams. */
  fromGramsBefore: number;
  fromGramsAfter: number;
  /** Weight of the replacement food added, in grams. */
  toGrams: number;
  /** Share of the reduced foods that is replaced, 0-1. */
  replaceFraction: number;
  /** Emissions of just the changed foods, before and after, kg CO2e. */
  lineKgCo2eBefore: number;
  lineKgCo2eAfter: number;
  /** Reduction on the changed foods, rounded to the nearest 5 percent. */
  lineReductionPercent: number;
  /** Whole-dish figures; null unless every ingredient was understood. */
  dish: {
    reductionPercent: number | null;
    perServingBefore: number | null;
    perServingAfter: number | null;
  };
  evidence: SwapRule['evidence'];
  tips: string[];
  caveats: string[];
}

const roundTo5 = (percent: number): number => Math.max(5, Math.round(percent / 5) * 5);

function suggestFor(rule: SwapRule, analysis: RecipeAnalysis): SwapSuggestion | null {
  if (!new RegExp(rule.dishPattern).test(analysis.context)) return null;
  if (rule.excludePattern && new RegExp(rule.excludePattern).test(analysis.context)) return null;

  const fromLines = analysis.lines.filter((l) => l.foodId !== null && rule.from.includes(l.foodId));
  // A line we could not weigh makes the total unreliable, so stay quiet.
  if (fromLines.length === 0 || fromLines.some((l) => l.grams === null)) return null;
  // "ground beef or turkey" and similar leave the amount uncertain.
  if (analysis.lines.some((l) => l.status === 'ambiguous')) return null;

  const fromGrams = fromLines.reduce((sum, l) => sum + (l.grams ?? 0), 0);
  if (fromGrams < rule.minFromGrams) return null;

  // Every changed food needs a carbon number; without one the saving cannot be stated.
  const to = getFoodFactor(rule.to);
  if (!to) return null;
  let before = 0;
  for (const line of fromLines) {
    const factor = getFoodFactor(line.foodId as string);
    if (!factor) return null;
    before += (factor.kgCo2ePerKg * (line.grams as number)) / 1000;
  }

  const fraction = rule.replaceFraction.default;
  const toGrams = fromGrams * fraction;
  const after = before * (1 - fraction) + (to.kgCo2ePerKg * toGrams) / 1000;
  const lineReductionPercent = roundTo5(((before - after) / before) * 100);
  if (!(after < before)) return null;

  let dishReduction: number | null = null;
  let perServingBefore: number | null = null;
  let perServingAfter: number | null = null;
  if (analysis.complete && analysis.totalKgCo2e !== null && analysis.totalKgCo2e > 0) {
    const dishAfter = analysis.totalKgCo2e - before + after;
    dishReduction = roundTo5(((analysis.totalKgCo2e - dishAfter) / analysis.totalKgCo2e) * 100);
    if (analysis.servings) {
      perServingBefore = analysis.totalKgCo2e / analysis.servings;
      perServingAfter = dishAfter / analysis.servings;
    }
  }

  const caveats = [...rule.caveats];
  for (const extra of rule.dishCaveats) {
    if (new RegExp(extra.pattern).test(analysis.context)) caveats.push(extra.text);
  }

  const percent = Math.round(fraction * 100);
  return {
    id: rule.id,
    title: rule.title,
    summary: `Replace about ${percent}% of the ${getFoodFactor(rule.from[0] as string)?.label.toLowerCase() ?? 'main ingredient'} with ${to.label.replace(/\s*\(.*?\)/g, '').toLowerCase()}: about ${lineReductionPercent}% less CO2e for those ingredients, and the dish stays a ${analysis.name || 'recipe'} you recognise.`,
    fromFoodIds: [...rule.from],
    toFoodId: rule.to,
    fromGramsBefore: fromGrams,
    fromGramsAfter: fromGrams - toGrams,
    toGrams,
    replaceFraction: fraction,
    lineKgCo2eBefore: before,
    lineKgCo2eAfter: after,
    lineReductionPercent,
    dish: { reductionPercent: dishReduction, perServingBefore, perServingAfter },
    evidence: rule.evidence,
    tips: [...rule.tips],
    caveats,
  };
}

/** Suggestions for a recipe, best line-level saving first. */
export function suggestSwaps(analysis: RecipeAnalysis, rules: readonly SwapRule[] = SWAP_RULES): SwapSuggestion[] {
  return rules
    .map((rule) => suggestFor(rule, analysis))
    .filter((s): s is SwapSuggestion => s !== null)
    .sort((a, b) => b.lineKgCo2eBefore - b.lineKgCo2eAfter - (a.lineKgCo2eBefore - a.lineKgCo2eAfter));
}
