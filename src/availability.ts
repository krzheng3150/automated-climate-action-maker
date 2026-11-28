/// <reference types="chrome" />

import { buildSearchUrl, type OutboundPartner } from './outbound';
import { recordDiagnostic } from './index';

const FETCH_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  available: boolean;
  ts: number;
}

type AvailabilityCache = Record<string, CacheEntry>;

const NO_RESULTS_SIGNALS: Record<string, string[]> = {
  backmarket: ['0 result', 'no result', '"totalCount":0'],
  'ebay-refurbished': ['No exact matches found', '0 results for'],
  swappa: ['No listings found', 'no results', '0 results', 'No products match'],
  thredup: ['0 Results', 'No results found', 'we couldn\'t find'],
  poshmark: ['No results found', '0 Listings'],
  depop: ['0 results', 'No results found'],
  thriftbooks: ['0 Results', 'No results found', 'did not match any products'],
  betterworldbooks: ['0 results', 'No results found', 'did not match'],
  chairish: ['0 Results', 'No results found'],
  aptdeco: ['0 results', 'No results found'],
};

function cacheKey(partnerId: string, query: string): string {
  return `${partnerId}::${query.toLowerCase().trim()}`;
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'text/html' },
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function hasResults(partnerId: string, html: string): boolean {
  const signals = NO_RESULTS_SIGNALS[partnerId];
  if (!signals) return true;
  const lower = html.toLowerCase();
  return !signals.some((s) => lower.includes(s.toLowerCase()));
}

async function readCache(): Promise<AvailabilityCache> {
  try {
    const data = await chrome.storage.session.get('availabilityCache');
    return (data['availabilityCache'] as AvailabilityCache) ?? {};
  } catch {
    return {};
  }
}

async function writeCache(cache: AvailabilityCache): Promise<void> {
  try {
    await chrome.storage.session.set({ availabilityCache: cache });
  } catch {}
}

export async function checkPartnerAvailability(
  partners: OutboundPartner[],
  query: string,
): Promise<Record<string, boolean>> {
  const now = Date.now();
  const cache = await readCache();
  const results: Record<string, boolean> = {};
  const toFetch: OutboundPartner[] = [];

  for (const p of partners) {
    const key = cacheKey(p.id, query);
    const cached = cache[key];
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      results[p.id] = cached.available;
    } else {
      toFetch.push(p);
    }
  }

  if (toFetch.length === 0) return results;

  const fetches = toFetch.map(async (p) => {
    const url = buildSearchUrl(p, query);
    const html = await fetchWithTimeout(url);
    const available = html !== null && hasResults(p.id, html);
    results[p.id] = available;
    cache[cacheKey(p.id, query)] = { available, ts: now };
    recordDiagnostic({
      source: 'background',
      level: 'info',
      event: 'AVAILABILITY_CHECK',
      details: `partner=${p.id} query="${query}" available=${available} cached=false`,
    });
  });

  await Promise.allSettled(fetches);

  const staleKeys = Object.entries(cache)
    .filter(([, v]) => now - v.ts > CACHE_TTL_MS)
    .map(([k]) => k);
  for (const k of staleKeys) delete cache[k];

  await writeCache(cache);
  return results;
}
