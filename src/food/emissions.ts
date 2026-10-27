import { FOOD_DATA_META, FOOD_EMISSION_FACTORS, type FoodEmissionFactor } from './data';

export { FOOD_DATA_META, FOOD_EMISSION_FACTORS, type FoodEmissionFactor } from './data';

const FACTORS_BY_ID: ReadonlyMap<string, FoodEmissionFactor> = new Map(
  FOOD_EMISSION_FACTORS.map((factor) => [factor.id, factor])
);

export function getFoodFactor(id: string): FoodEmissionFactor | undefined {
  return FACTORS_BY_ID.get(id);
}

/**
 * kg CO2e for a quantity of a known food. Returns undefined for an unknown id or a
 * non-finite/negative quantity, so callers must treat the ingredient as unknown instead
 * of silently counting it as zero.
 */
export function co2eKgForGrams(id: string, grams: number): number | undefined {
  const factor = FACTORS_BY_ID.get(id);
  if (!factor || !Number.isFinite(grams) || grams < 0) return undefined;
  return (factor.kgCo2ePerKg * grams) / 1000;
}

export interface FoodDataStatus {
  ok: boolean;
  count: number;
  version: string;
  reason?: string;
}

/** Cheap runtime self-check that the bundled table is present and usable. */
export function checkFoodData(): FoodDataStatus {
  const base = { count: FOOD_EMISSION_FACTORS.length, version: FOOD_DATA_META.version };
  if (base.count === 0) return { ok: false, ...base, reason: 'emission factor table is empty' };
  if (base.count !== FOOD_DATA_META.count) {
    return { ok: false, ...base, reason: `table has ${base.count} rows but metadata says ${FOOD_DATA_META.count}` };
  }
  const anchor = co2eKgForGrams('beef-ground-raw', 1000);
  if (anchor === undefined || !(anchor > 0)) {
    return { ok: false, ...base, reason: 'anchor lookup (beef-ground-raw) failed' };
  }
  return { ok: true, ...base };
}
