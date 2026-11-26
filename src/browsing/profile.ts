/// <reference types="chrome" />

/**
 * Deep browsing profile extraction — single pass over chrome.history to build
 * topic affinities, motivator signals, and shopping flexibility scores.
 * No URLs are retained; only aggregated counters survive.
 */

import type { ClimateTopic } from '../civic/topics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Motivator = 'cost' | 'health' | 'community' | 'identity';

export interface ShoppingProfile {
  traitFlexibility: number;
  recentCategories: string[];
  comparisonSitesCount: number;
  secondhandSitesCount: number;
  retailerDiversity: number;
}

export interface BrowsingProfile {
  topicSignals: Record<ClimateTopic, number>;
  motivators: Record<Motivator, number>;
  shoppingProfile: ShoppingProfile;
  totalUniqueUrls: number;
  lookbackDays: number;
  scannedAt: number;
}

// ---------------------------------------------------------------------------
// Path keyword → topic mapping
// Bigrams checked first (more precise), then unigrams as fallback.
// ---------------------------------------------------------------------------

const PATH_BIGRAM_TOPICS: Record<string, ClimateTopic[]> = {
  'clean energy': ['energy'],
  'wind farm': ['energy'],
  'wind power': ['energy'],
  'solar panel': ['energy'],
  'solar energy': ['energy'],
  'renewable energy': ['energy'],
  'energy bill': ['energy'],
  'power grid': ['energy'],
  'heat pump': ['energy'],
  'electric vehicle': ['transport'],
  'public transit': ['transport'],
  'bike lane': ['transport'],
  'car review': ['transport'],
  'flight deal': ['transport'],
  'food waste': ['food', 'waste'],
  'meal prep': ['food'],
  'plant based': ['food'],
  'organic food': ['food'],
  'food safety': ['food'],
  'fossil fuel': ['fossil-fuels'],
  'oil drilling': ['fossil-fuels'],
  'natural gas': ['fossil-fuels'],
  'air quality': ['conservation'],
  'climate change': ['conservation', 'policy'],
  'climate action': ['conservation', 'policy'],
  'global warming': ['conservation', 'policy'],
  'national park': ['conservation'],
  'marine conservation': ['conservation'],
  'zero waste': ['waste', 'circular-economy'],
  'fast fashion': ['waste', 'circular-economy'],
  'right repair': ['circular-economy'],
  'carbon tax': ['policy'],
  'carbon offset': ['policy'],
  'green new': ['policy', 'energy'],
  'climate policy': ['policy'],
  'emission standard': ['policy'],
  'circular economy': ['circular-economy'],
};

const PATH_UNIGRAM_TOPICS: Record<string, ClimateTopic[]> = {
  // Energy
  solar: ['energy'], renewable: ['energy'], electricity: ['energy'],
  grid: ['energy'], battery: ['energy'], nuclear: ['energy'],
  // Transport
  ev: ['transport'], hybrid: ['transport'], cycling: ['transport'],
  transit: ['transport'], commute: ['transport'], aviation: ['transport'],
  // Food
  recipe: ['food'], recipes: ['food'], cooking: ['food'], cook: ['food'],
  ingredient: ['food'], ingredients: ['food'], dinner: ['food'],
  breakfast: ['food'], lunch: ['food'], vegan: ['food'],
  vegetarian: ['food'], nutrition: ['food'], grocery: ['food'],
  // Fossil fuels
  petroleum: ['fossil-fuels'], fracking: ['fossil-fuels'],
  pipeline: ['fossil-fuels'], drilling: ['fossil-fuels'],
  // Conservation
  wildlife: ['conservation'], ecosystem: ['conservation'],
  biodiversity: ['conservation'], endangered: ['conservation'],
  deforestation: ['conservation'], reforestation: ['conservation'],
  pollution: ['conservation'], ocean: ['conservation'],
  environment: ['conservation'], environmental: ['conservation'],
  conservation: ['conservation'], habitat: ['conservation'],
  // Waste
  recycling: ['waste'], compost: ['waste'], composting: ['waste'],
  landfill: ['waste'], packaging: ['waste'], plastic: ['waste'],
  // Policy
  petition: ['policy'], legislation: ['policy'], regulation: ['policy'],
  emissions: ['policy'], climate: ['policy', 'conservation'],
  sustainability: ['policy', 'conservation'],
  // Circular economy
  refurbished: ['circular-economy'], secondhand: ['circular-economy'],
  resale: ['circular-economy'], thrift: ['circular-economy'],
  upcycle: ['circular-economy'], repair: ['circular-economy'],
  reuse: ['circular-economy'], vintage: ['circular-economy'],
};

// ---------------------------------------------------------------------------
// Path keyword → motivator mapping
// ---------------------------------------------------------------------------

const PATH_BIGRAM_MOTIVATORS: Record<string, Motivator[]> = {
  'save money': ['cost'], 'best budget': ['cost'], 'best cheap': ['cost'],
  'price comparison': ['cost'], 'deal alert': ['cost'],
  'coupon code': ['cost'], 'discount code': ['cost'],
  'air quality': ['health'], 'food safety': ['health'],
  'water quality': ['health'], 'mental health': ['health'],
  'child safety': ['health'], 'health risk': ['health'],
  'local event': ['community'], 'community event': ['community'],
  'town hall': ['community'], 'neighborhood watch': ['community'],
};

const PATH_UNIGRAM_MOTIVATORS: Record<string, Motivator[]> = {
  // Cost
  budget: ['cost'], cheap: ['cost'], affordable: ['cost'],
  discount: ['cost'], coupon: ['cost'], deal: ['cost'],
  deals: ['cost'], savings: ['cost'], frugal: ['cost'],
  clearance: ['cost'], sale: ['cost'],
  // Health
  health: ['health'], wellness: ['health'], fitness: ['health'],
  medical: ['health'], doctor: ['health'], nutrition: ['health'],
  allergy: ['health'], asthma: ['health'], pregnancy: ['health'],
  parenting: ['health'], pediatric: ['health'], organic: ['health'],
  pesticide: ['health'], toxin: ['health'],
  // Community
  local: ['community'], neighborhood: ['community'],
  volunteer: ['community'], community: ['community'],
  municipal: ['community'], council: ['community'],
  // Identity
  hiking: ['identity'], camping: ['identity'], outdoor: ['identity'],
  outdoors: ['identity'], trail: ['identity'], climbing: ['identity'],
  surfing: ['identity'], fishing: ['identity'], garden: ['identity'],
  gardening: ['identity'], diy: ['identity'], maker: ['identity'],
  craft: ['identity'], homestead: ['identity'],
};

// ---------------------------------------------------------------------------
// Domain name keyword analysis (option B)
// ---------------------------------------------------------------------------

const DOMAIN_KEYWORD_TOPICS: Record<string, ClimateTopic[]> = {
  solar: ['energy'], energy: ['energy'], power: ['energy'],
  electric: ['energy'], renewable: ['energy'], wind: ['energy'],
  auto: ['transport'], car: ['transport'], motor: ['transport'],
  vehicle: ['transport'], bike: ['transport'], transit: ['transport'],
  flight: ['transport'], aviation: ['transport'],
  food: ['food'], recipe: ['food'], cook: ['food'], eat: ['food'],
  restaurant: ['food'], meal: ['food'], grocery: ['food'],
  farm: ['food'], vegan: ['food'], diet: ['food'],
  oil: ['fossil-fuels'], gas: ['fossil-fuels'], petrol: ['fossil-fuels'],
  fossil: ['fossil-fuels'], coal: ['fossil-fuels'],
  nature: ['conservation'], wildlife: ['conservation'],
  forest: ['conservation'], ocean: ['conservation'],
  marine: ['conservation'], park: ['conservation'],
  garden: ['conservation'], bird: ['conservation'],
  recycle: ['waste'], waste: ['waste'], compost: ['waste'],
  trash: ['waste'], cleanup: ['waste'],
  resale: ['circular-economy'], thrift: ['circular-economy'],
  refurb: ['circular-economy'], repair: ['circular-economy'],
  reuse: ['circular-economy'], swap: ['circular-economy'],
  vintage: ['circular-economy'], secondhand: ['circular-economy'],
};

// ---------------------------------------------------------------------------
// Shopping signal detection
// ---------------------------------------------------------------------------

const COMPARISON_SITES = new Set([
  'wirecutter.com', 'rtings.com', 'consumerreports.org',
  'tomsguide.com', 'techradar.com', 'cnet.com',
  'slickdeals.net', 'retailmenot.com', 'dealnews.com',
  'camelcamelcamel.com', 'pricespy.com', 'shopzilla.com',
  'google.com/shopping', 'shopping.yahoo.com',
  'pcmag.com', 'bestreviews.com', 'reviewed.com',
]);

const SECONDHAND_SITES = new Set([
  'ebay.com', 'backmarket.com', 'swappa.com', 'decluttr.com',
  'mercari.com', 'poshmark.com', 'thredup.com', 'depop.com',
  'offerup.com', 'craigslist.org', 'facebook.com/marketplace',
  'reverb.com', 'grailed.com', 'tradesy.com', 'kidizen.com',
  'gazelle.com', 'ifixit.com', 'refurbed.com',
]);

const RETAILER_DOMAINS = new Set([
  'amazon.com', 'walmart.com', 'target.com', 'bestbuy.com',
  'homedepot.com', 'lowes.com', 'costco.com', 'wayfair.com',
  'ikea.com', 'nordstrom.com', 'macys.com', 'zappos.com',
  'nike.com', 'adidas.com', 'gap.com', 'hm.com', 'zara.com',
  'etsy.com', 'overstock.com', 'newegg.com', 'bhphotovideo.com',
  'rei.com', 'dickssportinggoods.com', 'ulta.com', 'sephora.com',
  'chewy.com', 'petco.com', 'anthropologie.com', 'urbanoutfitters.com',
  'asos.com', 'shein.com', 'aliexpress.com',
]);

const BRAND_DIRECT_SITES = new Set([
  'nike.com', 'adidas.com', 'apple.com', 'samsung.com', 'sony.com',
  'dyson.com', 'bose.com', 'lululemon.com', 'patagonia.com',
  'northface.com', 'underarmour.com', 'newbalance.com', 'asics.com',
  'brooks.com', 'allbirds.com', 'bombas.com', 'everlane.com',
  'tesla.com', 'peloton.com', 'yeti.com', 'hydroflask.com',
  'levis.com', 'gap.com', 'coach.com', 'katespade.com',
  'dell.com', 'hp.com', 'lenovo.com', 'asus.com', 'msi.com',
  'lg.com', 'whirlpool.com', 'kitchenaid.com',
]);

const SHOPPING_PATH_KEYWORDS = new Set([
  'product', 'products', 'shop', 'buy', 'cart', 'checkout',
  'store', 'catalog', 'category', 'departments',
]);

const PRODUCT_CATEGORY_KEYWORDS: Record<string, string> = {
  laptop: 'electronics', computer: 'electronics', phone: 'electronics',
  tablet: 'electronics', headphone: 'electronics', speaker: 'electronics',
  camera: 'electronics', monitor: 'electronics', keyboard: 'electronics',
  printer: 'electronics', tv: 'electronics', television: 'electronics',
  furniture: 'home', desk: 'home', chair: 'home', sofa: 'home',
  couch: 'home', mattress: 'home', table: 'home', shelf: 'home',
  dresser: 'home', lamp: 'home', rug: 'home',
  shoes: 'fashion', sneakers: 'fashion', boots: 'fashion',
  jacket: 'fashion', dress: 'fashion', jeans: 'fashion',
  shirt: 'fashion', pants: 'fashion', coat: 'fashion',
  handbag: 'fashion', watch: 'fashion', jewelry: 'fashion',
  bike: 'sports', bicycle: 'sports', kayak: 'sports',
  tent: 'sports', skis: 'sports', surfboard: 'sports',
  guitar: 'instruments', piano: 'instruments', drum: 'instruments',
  stroller: 'kids', crib: 'kids', toys: 'kids', carseat: 'kids',
  book: 'books', books: 'books', textbook: 'books',
};

// ---------------------------------------------------------------------------
// URL processing helpers
// ---------------------------------------------------------------------------

const SKIP_SCHEMES = /^(chrome|chrome-extension|about|file|data|blob|javascript):/i;
const SKIP_PATH_TOKENS = /^(oauth|callback|redirect|login|signin|signout|logout|auth|sso|saml|token)$/i;

const PATH_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'about',
  'more', 'home', 'page', 'news', 'best', 'free', 'help', 'search',
  'view', 'edit', 'save', 'sign', 'register', 'account',
  'admin', 'blog', 'post', 'article', 'index', 'main', 'default',
  'null', 'undefined', 'true', 'false', 'data', 'info', 'detail',
  'list', 'item', 'type', 'name', 'user', 'test', 'demo', 'docs',
  'api', 'app', 'web', 'www', 'http', 'https', 'com', 'org', 'net',
  'new', 'old', 'all', 'get', 'set', 'put', 'del', 'map', 'top',
  'one', 'two', 'day', 'may', 'can', 'now', 'ago', 'hot', 'big',
]);

function tokenizePath(pathname: string, search: string): string[] {
  const raw = `${pathname} ${decodeURIComponent(search).replace(/[?&][\w]+=/, ' ')}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !PATH_STOPWORDS.has(t));
}

function buildBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

function stripTld(hostname: string): string[] {
  return hostname
    .replace(/\.(com|org|net|co|io|uk|au|ca|de|fr|us|gov|edu|info|biz|nz|ie)(\.[a-z]{2})?$/i, '')
    .split(/[.-]/)
    .filter((t) => t.length >= 3);
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

function emptyTopicSignals(): Record<ClimateTopic, number> {
  return {
    energy: 0, transport: 0, food: 0, 'fossil-fuels': 0,
    conservation: 0, waste: 0, policy: 0, 'circular-economy': 0,
  };
}

function emptyMotivators(): Record<Motivator, number> {
  return { cost: 0, health: 0, community: 0, identity: 0 };
}

export async function extractBrowsingProfile(): Promise<BrowsingProfile> {
  const items = await chrome.history.search({
    text: '',
    startTime: 0,
    maxResults: 50000,
  });

  const topicSignals = emptyTopicSignals();
  const motivators = emptyMotivators();
  const comparisonSites = new Set<string>();
  const secondhandSites = new Set<string>();
  const retailers = new Set<string>();
  const categoryHits = new Map<string, Set<string>>();

  // Deduplicate by domain + first path segment
  const seen = new Set<string>();
  let processed = 0;
  let brandDirectHits = 0;
  let retailerHits = 0;

  for (const item of items) {
    if (!item.url || SKIP_SCHEMES.test(item.url)) continue;

    let parsed: URL;
    try {
      parsed = new URL(item.url);
    } catch {
      continue;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || hostname === 'localhost') continue;

    // Deduplicate: domain + first meaningful path segment
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const dedupeKey = `${hostname}/${pathParts[0] || ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    // Skip auth/redirect URLs
    if (pathParts.some((p) => SKIP_PATH_TOKENS.test(p))) continue;

    processed++;

    // --- Shopping signals ---
    const domainBase = hostname.replace(/^www\./, '');
    if (COMPARISON_SITES.has(domainBase)) comparisonSites.add(domainBase);
    if (SECONDHAND_SITES.has(domainBase)) secondhandSites.add(domainBase);
    if (RETAILER_DOMAINS.has(domainBase)) { retailers.add(domainBase); retailerHits++; }
    if (BRAND_DIRECT_SITES.has(domainBase)) brandDirectHits++;

    // Check for subreddit signals (r/frugal, r/buyitforlife, etc.)
    if (hostname.includes('reddit.com') && pathParts[0] === 'r') {
      const sub = (pathParts[1] || '').toLowerCase();
      if (['frugal', 'buyitforlife', 'thriftstorehauls', 'flipping'].includes(sub)) {
        comparisonSites.add(`reddit.com/r/${sub}`);
      }
    }

    // --- Tokenize path for topic + motivator extraction ---
    const tokens = tokenizePath(parsed.pathname, parsed.search);
    const bigrams = buildBigrams(tokens);

    // Bigrams first (higher precision)
    for (const bg of bigrams) {
      const topics = PATH_BIGRAM_TOPICS[bg];
      if (topics) for (const t of topics) topicSignals[t]++;
      const motives = PATH_BIGRAM_MOTIVATORS[bg];
      if (motives) for (const m of motives) motivators[m]++;
    }

    // Unigrams
    for (const token of tokens) {
      const topics = PATH_UNIGRAM_TOPICS[token];
      if (topics) for (const t of topics) topicSignals[t]++;
      const motives = PATH_UNIGRAM_MOTIVATORS[token];
      if (motives) for (const m of motives) motivators[m]++;

      // Product category detection
      const cat = PRODUCT_CATEGORY_KEYWORDS[token];
      if (cat) {
        if (!categoryHits.has(cat)) categoryHits.set(cat, new Set());
        categoryHits.get(cat)!.add(hostname);
      }
    }

    // --- Domain name keyword analysis (option B) ---
    const domainTokens = stripTld(hostname);
    for (const dt of domainTokens) {
      const topics = DOMAIN_KEYWORD_TOPICS[dt];
      if (topics) for (const t of topics) topicSignals[t]++;
    }
  }

  // --- Compute trait flexibility ---
  const comparisonCount = comparisonSites.size;
  const secondhandCount = secondhandSites.size;
  const retailerCount = retailers.size;
  const costHits = motivators.cost;

  let traitFlexibility = 0.35; // baseline: just above nudge threshold (0.3)

  // Flexibility signals
  traitFlexibility += Math.min(0.25, comparisonCount * 0.08);
  traitFlexibility += Math.min(0.25, secondhandCount * 0.08);
  traitFlexibility += Math.min(0.15, (retailerCount > 2 ? (retailerCount - 2) * 0.03 : 0));
  if (costHits >= 2) traitFlexibility += Math.min(0.12, costHits * 0.015);

  // Inflexibility signals
  if (retailerHits > 0 && brandDirectHits / retailerHits > 0.5) traitFlexibility -= 0.15;
  if (comparisonCount === 0) traitFlexibility -= 0.05;

  traitFlexibility = Math.min(1, Math.max(0.05, traitFlexibility));

  // Recent categories: those with hits from 2+ different domains
  const recentCategories = [...categoryHits.entries()]
    .filter(([, domains]) => domains.size >= 2)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 5)
    .map(([cat]) => cat);

  const lookbackMs = items.length > 0
    ? Date.now() - Math.min(...items.filter((i) => i.lastVisitTime).map((i) => i.lastVisitTime!))
    : 0;

  return {
    topicSignals,
    motivators,
    shoppingProfile: {
      traitFlexibility: Number(traitFlexibility.toFixed(2)),
      recentCategories,
      comparisonSitesCount: comparisonCount,
      secondhandSitesCount: secondhandCount,
      retailerDiversity: retailerCount,
    },
    totalUniqueUrls: processed,
    lookbackDays: Math.round(lookbackMs / (24 * 60 * 60 * 1000)),
    scannedAt: Date.now(),
  };
}
