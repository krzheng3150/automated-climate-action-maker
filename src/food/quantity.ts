/**
 * Splits an ingredient line such as "1 can (15 oz) kidney beans, drained" into a quantity,
 * a unit, an optional per-package weight, and the remaining description. Pure string work,
 * no emission data involved.
 */

export type QuantityUnit =
  | 'lb'
  | 'oz'
  | 'kg'
  | 'g'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'ml'
  | 'l'
  | 'can'
  | 'package'
  | 'clove'
  | 'stick'
  | 'slice'
  | 'dozen'
  | 'other';

export interface ParsedQuantity {
  /** Leading amount, or null when the line has none ("salt to taste"). */
  amount: number | null;
  /** True when the amount was a range ("2-3") and the midpoint was used. */
  isRange: boolean;
  unit: QuantityUnit | null;
  /** Weight from a parenthetical such as "(15 oz)", in grams. */
  sizeGrams: number | null;
  /** True when that parenthetical said "each" ("(8 oz each)"). */
  sizeIsEach: boolean;
  /** Lowercased description left after the quantity and unit were removed. */
  rest: string;
}

const UNICODE_FRACTIONS: Record<string, string> = {
  '¼': ' 1/4',
  '½': ' 1/2',
  '¾': ' 3/4',
  '⅓': ' 1/3',
  '⅔': ' 2/3',
  '⅛': ' 1/8',
  '⅜': ' 3/8',
  '⅝': ' 5/8',
  '⅞': ' 7/8',
  '⅕': ' 1/5',
  '⅖': ' 2/5',
  '⅗': ' 3/5',
  '⅘': ' 4/5',
  '⅙': ' 1/6',
  '⅚': ' 5/6',
};

export const GRAMS_PER_OUNCE = 28.3495;
export const GRAMS_PER_POUND = 453.592;

export function normalizeLine(line: string): string {
  return line
    .replace(/[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]/g, (ch) => UNICODE_FRACTIONS[ch] ?? ch)
    .replace(/⁄/g, '/')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(text: string): number {
  const parts = text.trim().split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (part.includes('/')) {
      const [num, den] = part.split('/');
      total += Number(num) / Number(den);
    } else {
      total += Number(part);
    }
  }
  return total;
}

const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;
const LEADING_AMOUNT = new RegExp(`^(${NUMBER})(?:\\s*(?:-|to)\\s*(${NUMBER}))?`);

const SIZE_PAREN = new RegExp(
  String.raw`\(\s*(?:about\s+|approx(?:imately)?\.?\s+)?(${NUMBER})\s*-?\s*(oz|ounces?|g|grams?|kg|lbs?|pounds?)\b([^)]*)\)`
);

const SIZE_UNITS = String.raw`(oz|ounces?|g|grams?|kg|lbs?|pounds?)`;
const CONTAINER_WORDS = String.raw`(?:cans?|tins?|jars?|packages?|pkgs?\.?|packets?|bags?|containers?|bottles?|blocks?|cartons?|tubs?)`;
// "420g can lentils": the whole line starts with the container's size, so there is one container.
const LEADING_SIZED_CONTAINER = new RegExp(`^(${NUMBER})\\s*-?\\s*${SIZE_UNITS}\\s*-?\\s*(?=${CONTAINER_WORDS}\\b)`);
// "2 x 400g cans" (after the count) and "15 oz can" (after a count of 1).
const MULTIPLIER_SIZE = new RegExp(`^[x×]\\s*(${NUMBER})\\s*-?\\s*${SIZE_UNITS}\\s*-?\\s*`);
const SIZED_CONTAINER = new RegExp(`^(${NUMBER})\\s*-?\\s*${SIZE_UNITS}\\s*-?\\s*(?=${CONTAINER_WORDS}\\b)`);

const UNIT_PATTERNS: Array<[RegExp, QuantityUnit]> = [
  [/^(?:lbs?\.?|pounds?)\b/, 'lb'],
  [/^(?:oz\.?|ounces?)\b/, 'oz'],
  [/^(?:kgs?|kilograms?|kilos?)\b/, 'kg'],
  [/^(?:g|grams?|grammes?)\b/, 'g'],
  [/^cups?\b/, 'cup'],
  [/^(?:tbsps?\.?|tablespoons?|tbs\.?)\b/, 'tbsp'],
  [/^(?:tsps?\.?|teaspoons?)\b/, 'tsp'],
  [/^(?:ml|millilit(?:er|re)s?)\b/, 'ml'],
  [/^(?:l|lit(?:er|re)s?)\b/, 'l'],
  [/^(?:cans?|tins?)\b/, 'can'],
  [/^(?:packages?|pkgs?\.?|packets?|containers?|bags?|jars?|bottles?|blocks?|cartons?|tubs?)\b/, 'package'],
  [/^cloves?\b/, 'clove'],
  [/^sticks?\b/, 'stick'],
  [/^(?:slices?|rashers?|strips?)\b/, 'slice'],
  [/^dozen\b/, 'dozen'],
  [/^(?:pinch(?:es)?|dash(?:es)?|handfuls?|bunch(?:es)?|sprigs?|heads?|pieces?)\b/, 'other'],
];

function sizeToGrams(value: number, unit: string): number {
  if (/^(?:oz|ounce)/.test(unit)) return value * GRAMS_PER_OUNCE;
  if (/^(?:lb|pound)/.test(unit)) return value * GRAMS_PER_POUND;
  if (unit === 'kg') return value * 1000;
  return value;
}

export function parseQuantity(line: string): ParsedQuantity {
  let text = normalizeLine(line);
  let amount: number | null = null;
  let isRange = false;

  let sizeGrams: number | null = null;
  let sizeIsEach = false;

  const sizedFirst = LEADING_SIZED_CONTAINER.exec(text);
  const lead = sizedFirst ? null : LEADING_AMOUNT.exec(text);
  if (sizedFirst) {
    amount = 1;
    sizeGrams = sizeToGrams(parseNumber(sizedFirst[1] as string), sizedFirst[2] as string);
    text = text.slice(sizedFirst[0].length).trim();
  } else if (lead) {
    const first = parseNumber(lead[1] as string);
    if (lead[2]) {
      amount = (first + parseNumber(lead[2])) / 2;
      isRange = true;
    } else {
      amount = first;
    }
    text = text.slice(lead[0].length).replace(/^-\s*/, '').trim();

    const times = MULTIPLIER_SIZE.exec(text);
    const bare = times ? null : SIZED_CONTAINER.exec(text);
    const hit = times ?? bare;
    if (hit) {
      sizeGrams = sizeToGrams(parseNumber(hit[1] as string), hit[2] as string);
      sizeIsEach = true;
      text = text.slice(hit[0].length).trim();
    }
  }

  const size = sizeGrams === null ? SIZE_PAREN.exec(text) : null;
  if (size) {
    sizeGrams = sizeToGrams(parseNumber(size[1] as string), size[2] as string);
    sizeIsEach = /\beach\b/.test(size[3] ?? '');
  }
  text = text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  let unit: QuantityUnit | null = null;
  if (amount !== null || sizeGrams !== null) {
    for (const [pattern, name] of UNIT_PATTERNS) {
      const match = pattern.exec(text);
      if (match) {
        unit = name;
        text = text.slice(match[0].length).replace(/^[.\s]+/, '').replace(/^of\s+/, '').trim();
        break;
      }
    }
  }

  return { amount, isRange, unit, sizeGrams, sizeIsEach, rest: text };
}
