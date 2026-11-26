#!/usr/bin/env node
// Build-time generator: Chrome Topics override list → src/browsing/interests.ts
// Parses the protobuf domain→topic mapping shipped with Chrome, filters to
// actionable interest categories, and emits a static TypeScript module.
// Same pattern as fetch-cities.mjs — runs at build time, never at runtime.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'browsing', 'interests.ts');

// Chrome Topics taxonomy v2 → benefit tag mapping
// Root categories that map to actionable civic-event interest signals.
// Categories not listed here (Arts & Entertainment, Games, Shopping, etc.) are
// too broad to be meaningful interest signals and are dropped.
const TAXONOMY_PATH = join(__dirname, '..', 'data', 'topics_taxonomy_v2.md');

const ROOT_TO_BENEFIT = {
  'Hobbies & Leisure': 'outdoor',
  'Beauty & Fitness': 'fitness',
  'Food & Drink': 'food',
  'Sports': 'sports',
  'Travel & Transportation': 'travel',
  'Home & Garden': 'home',
  'People & Society': 'community',
  'Finance': 'savings',
  'Jobs & Education': 'education',
  'Pets & Animals': 'animals',
  'Real Estate': 'home',
  'Law & Government': 'civic',
};

// Also map select sub-categories for precision override
const SUBCATEGORY_OVERRIDES = {
  '/Hobbies & Leisure/Outdoors/Hiking & Camping': 'outdoor',
  '/Hobbies & Leisure/Outdoors': 'outdoor',
  '/Sports/Cycling': 'fitness',
  '/Sports/Running & Walking': 'fitness',
  '/Sports/Water Sports': 'outdoor',
  '/Sports/Winter Sports': 'outdoor',
  '/Beauty & Fitness/Fitness': 'fitness',
};

// --- Protobuf parser ---

function readVarint(data, pos) {
  let result = 0, shift = 0;
  while (pos < data.length) {
    const b = data[pos++];
    result |= (b & 0x7F) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return [result, pos];
}

function parseEntry(data) {
  let domain = '', ids = [];
  let pos = 0;
  while (pos < data.length) {
    let tag;
    [tag, pos] = readVarint(data, pos);
    const fieldNum = tag >> 3, wireType = tag & 7;
    if (wireType === 2) {
      let len;
      [len, pos] = readVarint(data, pos);
      if (fieldNum === 1) {
        domain = data.subarray(pos, pos + len).toString('utf-8');
      } else if (fieldNum === 2) {
        const end = pos + len;
        while (pos < end) {
          let v;
          [v, pos] = readVarint(data, pos);
          ids.push(v);
        }
        continue;
      }
      pos += len;
    } else if (wireType === 0) {
      let v;
      [v, pos] = readVarint(data, pos);
      if (fieldNum === 2) ids.push(v);
    }
  }
  return { domain, ids };
}

function parseOverrideList(data) {
  const entries = new Map();
  let pos = 0;
  while (pos < data.length) {
    let tag;
    [tag, pos] = readVarint(data, pos);
    const wireType = tag & 7;
    if (wireType === 2) {
      let len;
      [len, pos] = readVarint(data, pos);
      const { domain, ids } = parseEntry(data.subarray(pos, pos + len));
      if (domain) {
        const realIds = ids.filter(i => i !== 8);
        if (realIds.length > 0) entries.set(domain, realIds);
      }
      pos += len;
    } else if (wireType === 0) {
      [, pos] = readVarint(data, pos);
    }
  }
  return entries;
}

// --- Taxonomy parser ---

function loadTaxonomy(path) {
  const taxonomy = new Map();
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.startsWith('| ID') || trimmed.startsWith('| --')) continue;
    const parts = trimmed.split('|').map(p => p.trim());
    if (parts.length >= 3 && /^\d+$/.test(parts[1])) {
      taxonomy.set(parseInt(parts[1]), parts[2]);
    }
  }
  return taxonomy;
}

function topicToBenefit(topicPath) {
  // Check sub-category overrides first (more precise)
  for (const [prefix, benefit] of Object.entries(SUBCATEGORY_OVERRIDES)) {
    if (topicPath.startsWith(prefix)) return benefit;
  }
  // Fall back to root category
  if (!topicPath.includes('/')) return null;
  const root = topicPath.split('/')[1];
  return ROOT_TO_BENEFIT[root] ?? null;
}

// --- Main ---

// Find override list: check Chrome's model store
const CHROME_PATHS = [
  join(homedir(), 'Library/Application Support/Google/Chrome/optimization_guide_model_store'),
  join(homedir(), '.config/google-chrome/optimization_guide_model_store'),
  join(homedir(), 'AppData/Local/Google/Chrome/User Data/optimization_guide_model_store'),
];

let overrideListPath = null;
for (const base of CHROME_PATHS) {
  if (!existsSync(base)) continue;
  try {
    const found = execSync(
      `find "${base}" -name "override_list.pb.gz" -type f 2>/dev/null | head -1`,
      { encoding: 'utf-8' }
    ).trim();
    if (found && existsSync(found)) {
      overrideListPath = found;
      break;
    }
  } catch {}
}

if (!overrideListPath) {
  console.error('Could not find Chrome Topics override_list.pb.gz');
  console.error('Searched:', CHROME_PATHS);
  process.exit(1);
}

console.log(`Found override list: ${overrideListPath}`);

// Decompress
const tmpPb = '/tmp/acam-override-list.pb';
execSync(`gunzip -c "${overrideListPath}" > "${tmpPb}"`);
const data = readFileSync(tmpPb);
console.log(`Protobuf size: ${(data.length / 1024).toFixed(0)} KB`);

// Parse
const rawEntries = parseOverrideList(data);
console.log(`Raw entries: ${rawEntries.size}`);

// Load taxonomy
if (!existsSync(TAXONOMY_PATH)) {
  console.error(`Taxonomy not found at ${TAXONOMY_PATH}`);
  console.error('Download from: https://raw.githubusercontent.com/nicoleNPC — no.');
  console.error('Place topics_taxonomy_v2.md in data/ directory.');
  process.exit(1);
}
const taxonomy = loadTaxonomy(TAXONOMY_PATH);
console.log(`Taxonomy topics: ${taxonomy.size}`);

// Map domains to benefit tags
const domainInterests = new Map();
for (const [domKey, topicIds] of rawEntries) {
  const benefits = new Set();
  for (const tid of topicIds) {
    const topicPath = taxonomy.get(tid);
    if (!topicPath) continue;
    const benefit = topicToBenefit(topicPath);
    if (benefit) benefits.add(benefit);
  }
  if (benefits.size > 0) {
    const normalDomain = domKey.replaceAll(' ', '.');
    domainInterests.set(normalDomain, [...benefits].sort());
  }
}

console.log(`Domains with actionable interests: ${domainInterests.size}`);

// --- Generate TypeScript module ---

const BENEFIT_TAGS = [
  'outdoor', 'fitness', 'food', 'sports', 'travel', 'home',
  'community', 'savings', 'education', 'animals', 'civic',
];

let ts = `// Auto-generated by scripts/generate-interests.mjs — DO NOT EDIT\n`;
ts += `// Chrome Topics override list → domain interest classifications\n`;
ts += `// ${domainInterests.size} entries, generated ${new Date().toISOString().slice(0, 10)}\n\n`;

ts += `export type InterestTag =\n  | '${BENEFIT_TAGS.join("'\n  | '")}';  \n\n`;

// Encode compactly: single-char codes expanded at init time
const TAG_CODES = {};
for (let i = 0; i < BENEFIT_TAGS.length; i++) {
  TAG_CODES[BENEFIT_TAGS[i]] = String.fromCharCode(97 + i); // a, b, c, ...
}

const DECODE_MAP = {};
for (const [tag, code] of Object.entries(TAG_CODES)) {
  DECODE_MAP[code] = tag;
}

ts += `const D: Record<string, string> = {\n`;

// Sort by domain for deterministic output
const sorted = [...domainInterests.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [domain, tags] of sorted) {
  const coded = tags.map(t => TAG_CODES[t]).join('');
  const safeDomain = domain.replace(/'/g, "\\'");
  ts += `  '${safeDomain}': '${coded}',\n`;
}
ts += `};\n\n`;

// Decoder
ts += `const DECODE: Record<string, InterestTag> = {\n`;
for (const [code, tag] of Object.entries(DECODE_MAP)) {
  ts += `  '${code}': '${tag}',\n`;
}
ts += `};\n\n`;

ts += `export function lookupDomainInterests(hostname: string): InterestTag[] {\n`;
ts += `  const domain = hostname.replace(/^www\\./, '');\n`;
ts += `  const coded = D[domain];\n`;
ts += `  if (!coded) return [];\n`;
ts += `  return [...coded].map(c => DECODE[c]).filter(Boolean);\n`;
ts += `}\n`;

writeFileSync(OUT_PATH, ts, 'utf-8');
console.log(`Written to ${OUT_PATH} (${(ts.length / 1024).toFixed(0)} KB)`);

// Cleanup
try { execSync(`rm "${tmpPb}"`); } catch {}
