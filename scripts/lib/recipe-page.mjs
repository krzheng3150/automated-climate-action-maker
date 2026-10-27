/** Pulls schema.org Recipe objects out of a page's JSON-LD blocks. Dev tooling only. */

const decode = (text) =>
  text.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function* walk(node) {
  if (Array.isArray(node)) {
    for (const item of node) yield* walk(item);
  } else if (node && typeof node === 'object') {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.includes('Recipe')) yield node;
    for (const key of ['@graph', 'mainEntity', 'itemListElement']) if (key in node) yield* walk(node[key]);
  }
}

export function extractRecipes(html) {
  const found = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const raw of [m[1].trim(), decode(m[1]).trim()]) {
      try {
        found.push(...walk(JSON.parse(raw)));
        break;
      } catch {
        // try the next form
      }
    }
  }
  return found.map((r) => ({
    name: String(r.name ?? ''),
    recipeYield: r.recipeYield ?? null,
    keywords: r.keywords ?? undefined,
    category: r.recipeCategory ?? undefined,
    cuisine: r.recipeCuisine ?? undefined,
    ingredients: (r.recipeIngredient ?? r.ingredients ?? []).map((i) => decode(String(i))),
  }));
}
