/**
 * Finds a recipe on the current page. Runs in the content script, so it must stay free of any
 * food data: it only reads the page and hands plain text to the background worker.
 * Order of trust: schema.org JSON-LD, then microdata, then common recipe-plugin markup.
 */

export interface DetectedRecipe {
  name: string;
  ingredients: string[];
  recipeYield?: unknown;
  keywords?: string | string[];
  category?: string | string[];
  cuisine?: string | string[];
  via: 'json-ld' | 'microdata' | 'markup';
}

const MIN_INGREDIENTS = 3;
const PLACEHOLDER = /__PLACEHOLDER|{{|<%/;

const MARKUP_INGREDIENT_SELECTORS = [
  '.wprm-recipe-ingredient',
  '.tasty-recipes-ingredients li',
  '.mntl-structured-ingredients__list-item',
  '.ingredients-item-name',
  '.recipe-ingredients li',
  '.ingredient-list li',
];

const clean = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();

function findRecipeNodes(node: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(node)) {
    for (const item of node) findRecipeNodes(item, out);
  } else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    const type = record['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (types.includes('Recipe')) out.push(record);
    for (const key of ['@graph', 'mainEntity', 'itemListElement']) {
      if (key in record) findRecipeNodes(record[key], out);
    }
  }
}

const textList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value])
    .filter((v): v is string => typeof v === 'string')
    .map(clean)
    .filter(Boolean);

function fromJsonLd(doc: Document): DetectedRecipe | null {
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent || '');
    } catch {
      continue;
    }
    const nodes: Record<string, unknown>[] = [];
    findRecipeNodes(data, nodes);
    for (const node of nodes) {
      const ingredients = textList(node['recipeIngredient'] ?? node['ingredients']);
      if (ingredients.length < MIN_INGREDIENTS || ingredients.some((line) => PLACEHOLDER.test(line))) continue;
      return {
        name: clean(typeof node['name'] === 'string' ? node['name'] : ''),
        ingredients,
        recipeYield: node['recipeYield'],
        keywords: node['keywords'] as string | string[] | undefined,
        category: node['recipeCategory'] as string | string[] | undefined,
        cuisine: node['recipeCuisine'] as string | string[] | undefined,
        via: 'json-ld',
      };
    }
  }
  return null;
}

function pageName(doc: Document): string {
  return (
    clean(doc.querySelector('[itemprop="name"]')?.textContent) ||
    clean(doc.querySelector('h1')?.textContent) ||
    clean(doc.querySelector('meta[property="og:title"]')?.getAttribute('content')) ||
    clean(doc.title)
  );
}

function fromElements(doc: Document, selector: string, via: DetectedRecipe['via']): DetectedRecipe | null {
  const ingredients = Array.from(doc.querySelectorAll(selector))
    .map((el) => clean(el.textContent))
    .filter(Boolean);
  if (ingredients.length < MIN_INGREDIENTS || ingredients.some((line) => PLACEHOLDER.test(line))) return null;
  const yieldText = clean(doc.querySelector('[itemprop="recipeYield"], .wprm-recipe-servings')?.textContent);
  return { name: pageName(doc), ingredients, recipeYield: yieldText || undefined, via };
}

export function detectRecipe(doc: Document = document): DetectedRecipe | null {
  const structured = fromJsonLd(doc);
  if (structured) return structured;

  const microdata = fromElements(doc, '[itemprop="recipeIngredient"], [itemprop="ingredients"]', 'microdata');
  if (microdata) return microdata;

  for (const selector of MARKUP_INGREDIENT_SELECTORS) {
    const found = fromElements(doc, selector, 'markup');
    if (found) return found;
  }
  return null;
}
