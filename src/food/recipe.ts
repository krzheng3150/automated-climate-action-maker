import { co2eKgForGrams, getFoodFactor } from './emissions';
import { parseIngredient, parseServings, type ParsedIngredient } from './parser';

export interface RecipeInput {
  name?: string;
  ingredients: string[];
  /** schema.org recipeYield: number, string, or array. */
  recipeYield?: unknown;
  keywords?: string | string[];
  category?: string | string[];
  cuisine?: string | string[];
}

export interface AnalyzedLine extends ParsedIngredient {
  kgCo2e: number | null;
}

export interface RecipeAnalysis {
  name: string;
  /** Lowercased name, keywords, category and cuisine, used to recognise the kind of dish. */
  context: string;
  servings: number | null;
  servingsApprox: boolean;
  lines: AnalyzedLine[];
  counts: { total: number; resolved: number; ignored: number; unresolved: number };
  /** True when every line is resolved or negligible, so the totals cover the whole dish. */
  complete: boolean;
  /** kg CO2e of the lines we could resolve. A lower bound unless `complete`. */
  resolvedKgCo2e: number;
  totalKgCo2e: number | null;
  perServingKgCo2e: number | null;
  byCategory: Record<string, number>;
}

const asList = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

export function analyzeRecipe(input: RecipeInput): RecipeAnalysis {
  const name = (input.name ?? '').trim();
  const context = [name, ...asList(input.keywords), ...asList(input.category), ...asList(input.cuisine)]
    .join(' ')
    .toLowerCase();

  const lines: AnalyzedLine[] = input.ingredients.map((raw) => {
    const parsed = parseIngredient(raw);
    const kgCo2e =
      parsed.status === 'resolved' && parsed.foodId && parsed.grams !== null
        ? (co2eKgForGrams(parsed.foodId, parsed.grams) ?? null)
        : null;
    return { ...parsed, kgCo2e };
  });

  const byCategory: Record<string, number> = {};
  let resolvedKgCo2e = 0;
  for (const line of lines) {
    if (line.kgCo2e === null || !line.foodId) continue;
    resolvedKgCo2e += line.kgCo2e;
    const category = getFoodFactor(line.foodId)?.category;
    if (category) byCategory[category] = (byCategory[category] ?? 0) + line.kgCo2e;
  }

  const resolved = lines.filter((l) => l.kgCo2e !== null).length;
  const ignored = lines.filter((l) => l.status === 'ignored').length;
  const unresolved = lines.length - resolved - ignored;
  const complete = lines.length > 0 && unresolved === 0 && resolved > 0;

  const served = parseServings(input.recipeYield);
  const totalKgCo2e = complete ? resolvedKgCo2e : null;

  return {
    name,
    context,
    servings: served?.servings ?? null,
    servingsApprox: served?.approx ?? false,
    lines,
    counts: { total: lines.length, resolved, ignored, unresolved },
    complete,
    resolvedKgCo2e,
    totalKgCo2e,
    perServingKgCo2e: totalKgCo2e !== null && served ? totalKgCo2e / served.servings : null,
    byCategory,
  };
}
