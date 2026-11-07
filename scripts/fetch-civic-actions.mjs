// Build-time generator: fetches civic actions from public APIs and scrapes,
// then outputs src/civic/data.ts — a static TypeScript module bundled into
// the extension. The extension never makes network calls itself.
//
// Usage: node scripts/fetch-civic-actions.mjs
// Sources: UK Parliament Petitions API, 350.org campaigns page

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const OUT_PATH = path.join(projectRoot, 'src', 'civic', 'data.ts');

const CLIMATE_TOPICS = ['energy', 'transport', 'food', 'fossil-fuels', 'conservation', 'waste', 'policy', 'circular-economy'];

const TOPIC_KEYWORDS = {
  energy: ['renewable energy', 'solar', 'wind energy', 'clean electricity', 'nuclear'],
  transport: ['electric vehicle', 'cycling', 'public transport emissions', 'aviation emissions'],
  food: ['agriculture', 'food waste', 'farming emissions', 'pesticide'],
  'fossil-fuels': ['fossil fuel', 'oil drilling', 'coal', 'fracking', 'gas pipeline'],
  conservation: ['biodiversity', 'deforestation', 'wildlife', 'ocean', 'national park'],
  waste: ['plastic', 'recycling', 'waste reduction', 'landfill'],
  policy: ['climate', 'net zero', 'carbon tax', 'emissions target', 'green new deal'],
  'circular-economy': ['right to repair', 'reuse', 'planned obsolescence'],
};

function inferTopics(title) {
  const lower = title.toLowerCase();
  const matched = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        matched.push(topic);
        break;
      }
    }
  }
  if (matched.length === 0 && (lower.includes('climate') || lower.includes('environment') || lower.includes('green'))) {
    matched.push('policy');
  }
  return matched.length > 0 ? matched : ['policy'];
}

// ---------------------------------------------------------------------------
// UK Parliament Petitions API (free, no auth, JSON)
// ---------------------------------------------------------------------------

async function fetchUKPetitions() {
  const actions = [];
  const queries = ['climate', 'renewable energy', 'fossil fuel', 'biodiversity', 'pollution', 'transport emissions'];

  for (const q of queries) {
    try {
      const url = `https://petition.parliament.uk/petitions.json?state=open&q=${encodeURIComponent(q)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`  UK Petitions query "${q}" returned ${resp.status}`);
        continue;
      }
      const json = await resp.json();
      const petitions = json.data || [];
      for (const p of petitions) {
        const attrs = p.attributes || {};
        if (attrs.state !== 'open') continue;
        actions.push({
          id: `uk-${p.id}`,
          title: (attrs.action || '').trim(),
          url: `https://petition.parliament.uk/petitions/${p.id}`,
          platform: 'UK Parliament Petitions',
          region: 'GB',
          topics: inferTopics(attrs.action || ''),
          type: 'petition',
          signatures: attrs.signature_count || 0,
          deadline: attrs.closed_at || undefined,
          fetchedAt: Date.now(),
        });
      }
    } catch (err) {
      console.warn(`  UK Petitions query "${q}" failed:`, err.message);
    }
  }

  return dedup(actions);
}

// ---------------------------------------------------------------------------
// 350.org campaigns (server-rendered HTML, permissive robots.txt)
// ---------------------------------------------------------------------------

async function fetch350Campaigns() {
  const actions = [];
  try {
    const resp = await fetch('https://350.org/campaigns/');
    if (!resp.ok) {
      console.warn(`  350.org returned ${resp.status}`);
      return actions;
    }
    const html = await resp.text();
    // Parse campaign cards from the HTML — they follow a repeated pattern
    // <h3 class="..."><a href="URL">TITLE</a></h3>
    const cardRegex = /<h[23][^>]*>\s*<a\s+href="(https:\/\/350\.org\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = cardRegex.exec(html)) !== null) {
      const [, url, title] = match;
      const cleanTitle = title.replace(/&#8217;/g, "'").replace(/&#8211;/g, '–').replace(/&amp;/g, '&').trim();
      if (!cleanTitle) continue;
      actions.push({
        id: `350-${url.replace(/[^a-z0-9]/gi, '-').slice(0, 60)}`,
        title: cleanTitle,
        url,
        platform: '350.org',
        region: 'global',
        topics: inferTopics(cleanTitle),
        type: 'campaign',
        fetchedAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn('  350.org scrape failed:', err.message);
  }
  return dedup(actions);
}

// ---------------------------------------------------------------------------
// Curated fallback actions (for regions without API sources)
// These ensure every supported region has at least some actions
// ---------------------------------------------------------------------------

function getCuratedActions() {
  return [
    // US
    {
      id: 'curated-us-epa',
      title: 'Comment on EPA Clean Air & Climate Rules',
      url: 'https://www.regulations.gov/search?filter=EPA%20climate',
      platform: 'Regulations.gov',
      region: 'US',
      topics: ['policy', 'energy'],
      type: 'comment',
      fetchedAt: Date.now(),
    },
    {
      id: 'curated-us-sierra',
      title: 'Support Clean Energy Legislation',
      url: 'https://www.sierraclub.org/take-action',
      platform: 'Sierra Club',
      region: 'US',
      topics: ['energy', 'policy'],
      type: 'campaign',
      fetchedAt: Date.now(),
    },
    {
      id: 'curated-us-fossil',
      title: 'Sign the Fossil Fuel Non-Proliferation Treaty',
      url: 'https://fossilfueltreaty.org/sign-the-treaty',
      platform: 'Fossil Fuel Treaty',
      region: 'US',
      topics: ['fossil-fuels', 'policy'],
      type: 'petition',
      fetchedAt: Date.now(),
    },
    // Canada
    {
      id: 'curated-ca-leadnow',
      title: 'Join Leadnow Climate Campaigns',
      url: 'https://leadnow.ca/campaigns/',
      platform: 'Leadnow',
      region: 'CA',
      topics: ['policy', 'energy'],
      type: 'campaign',
      fetchedAt: Date.now(),
    },
    // Australia
    {
      id: 'curated-au-getup',
      title: 'Join GetUp Climate Action Campaigns',
      url: 'https://www.getup.org.au/campaigns',
      platform: 'GetUp',
      region: 'AU',
      topics: ['policy', 'fossil-fuels'],
      type: 'campaign',
      fetchedAt: Date.now(),
    },
    {
      id: 'curated-au-acf',
      title: 'Protect Australian Nature & Climate',
      url: 'https://www.acf.org.au/take-action',
      platform: 'ACF',
      region: 'AU',
      topics: ['conservation', 'policy'],
      type: 'campaign',
      fetchedAt: Date.now(),
    },
    // New Zealand
    {
      id: 'curated-nz-350',
      title: 'Join 350 Aotearoa Climate Action',
      url: 'https://350.org.nz/',
      platform: '350 Aotearoa',
      region: 'NZ',
      topics: ['policy', 'fossil-fuels'],
      type: 'campaign',
      fetchedAt: Date.now(),
    },
    // EU / Germany
    {
      id: 'curated-de-campact',
      title: 'Support Campact Climate Campaigns',
      url: 'https://www.campact.de/kampagnen/',
      platform: 'Campact',
      region: 'DE',
      topics: ['policy', 'energy'],
      type: 'campaign',
      fetchedAt: Date.now(),
    },
    // India
    {
      id: 'curated-in-gp',
      title: 'Take Climate Action with Greenpeace India',
      url: 'https://www.greenpeace.org/india/en/act/',
      platform: 'Greenpeace India',
      region: 'IN',
      topics: ['policy', 'conservation'],
      type: 'campaign',
      fetchedAt: Date.now(),
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dedup(actions) {
  const seen = new Set();
  return actions.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

function escapeTs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function generateModule(actions) {
  const sorted = [...actions].sort((a, b) => {
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    return (b.signatures || 0) - (a.signatures || 0);
  });

  const now = new Date().toISOString().slice(0, 10);
  const regions = [...new Set(sorted.map((a) => a.region))].sort();
  const platforms = [...new Set(sorted.map((a) => a.platform))].sort();

  let ts = `// GENERATED FILE - do not edit by hand. Regenerate with: node scripts/fetch-civic-actions.mjs\n`;
  ts += `// Data fetched ${now}. Regions: ${regions.join(', ')}. Platforms: ${platforms.join(', ')}.\n\n`;
  ts += `import type { CivicAction } from './recommend';\n\n`;
  ts += `export const CIVIC_DATA_META = {\n`;
  ts += `  fetchedAt: '${now}',\n`;
  ts += `  actionCount: ${sorted.length},\n`;
  ts += `  regions: [${regions.map((r) => `'${r}'`).join(', ')}],\n`;
  ts += `  platforms: [${platforms.map((p) => `'${escapeTs(p)}'`).join(', ')}],\n`;
  ts += `} as const;\n\n`;
  ts += `export const CIVIC_ACTIONS: CivicAction[] = [\n`;

  for (const a of sorted) {
    ts += `  {\n`;
    ts += `    id: '${escapeTs(a.id)}',\n`;
    ts += `    title: '${escapeTs(a.title)}',\n`;
    ts += `    url: '${escapeTs(a.url)}',\n`;
    ts += `    platform: '${escapeTs(a.platform)}',\n`;
    ts += `    region: '${escapeTs(a.region)}',\n`;
    ts += `    topics: [${a.topics.map((t) => `'${t}'`).join(', ')}],\n`;
    ts += `    type: '${a.type}',\n`;
    if (a.signatures) ts += `    signatures: ${a.signatures},\n`;
    if (a.deadline) ts += `    deadline: '${a.deadline}',\n`;
    ts += `    fetchedAt: ${a.fetchedAt},\n`;
    ts += `  },\n`;
  }

  ts += `];\n`;
  return ts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching civic actions...');

  const results = await Promise.allSettled([
    fetchUKPetitions().then((r) => { console.log(`  UK Parliament: ${r.length} petitions`); return r; }),
    fetch350Campaigns().then((r) => { console.log(`  350.org: ${r.length} campaigns`); return r; }),
  ]);

  const allActions = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allActions.push(...r.value);
  }

  // Add curated fallbacks
  const curated = getCuratedActions();
  console.log(`  Curated fallbacks: ${curated.length} actions`);
  allActions.push(...curated);

  // Final dedup across all sources
  const deduped = dedup(allActions);

  console.log(`\nTotal: ${deduped.length} unique civic actions`);

  const moduleSource = generateModule(deduped);
  writeFileSync(OUT_PATH, moduleSource, 'utf-8');
  console.log(`Written to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
