/// <reference types="chrome" />

import { CITIES, CITY_NAME_INDEX, type GazetteerCity } from './cities';
import { getTimezoneCoords } from './region';

export interface UserLocationEstimate {
  city: string;
  lat: number;
  lng: number;
  country: string;
  confidence: number;
  sources: string[];
  updatedAt: number;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'about',
  'more', 'home', 'page', 'news', 'best', 'free', 'help', 'search',
  'view', 'edit', 'save', 'login', 'sign', 'register', 'account',
  'admin', 'blog', 'post', 'article', 'index', 'main', 'default',
  'null', 'undefined', 'true', 'false', 'data', 'info', 'detail',
  'list', 'item', 'type', 'name', 'user', 'test', 'demo', 'docs',
  'api', 'app', 'web', 'www', 'http', 'https', 'com', 'org', 'net',
  'new', 'old', 'all', 'get', 'set', 'put', 'del', 'map', 'top',
  'one', 'two', 'day', 'may', 'can', 'now', 'ago', 'hot', 'big',
  'city', 'area', 'state', 'local', 'region', 'events', 'event',
  'jobs', 'job', 'store', 'shop', 'buy', 'sale', 'deal', 'price',
  'food', 'menu', 'eat', 'bar', 'pub', 'cafe', 'hotel', 'room',
  'rent', 'real', 'estate', 'property', 'house', 'apt',
]);

const MIN_TOKEN_LENGTH = 3;
const MIN_DOMAIN_COUNT = 2;

function tokenizeUrl(url: string): string[] {
  try {
    const parsed = new URL(url);
    const text = `${parsed.pathname} ${parsed.search}`;
    return text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t));
  } catch {
    return [];
  }
}

function buildBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

interface CityScore {
  city: GazetteerCity;
  domains: Set<string>;
}

export async function estimateUserLocation(): Promise<UserLocationEstimate | null> {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const items = await chrome.history.search({
    text: '',
    startTime: oneWeekAgo,
    maxResults: 5000,
  });

  if (!items || items.length < 50) return null;

  const scores = new Map<number, CityScore>();

  for (const item of items) {
    if (!item.url) continue;
    let hostname: string;
    try {
      hostname = new URL(item.url).hostname;
    } catch {
      continue;
    }

    const tokens = tokenizeUrl(item.url);
    const bigrams = buildBigrams(tokens);
    const candidates = [...tokens, ...bigrams];

    for (const token of candidates) {
      const indices = CITY_NAME_INDEX.get(token);
      if (!indices) continue;

      for (const idx of indices) {
        let entry = scores.get(idx);
        if (!entry) {
          entry = { city: CITIES[idx], domains: new Set() };
          scores.set(idx, entry);
        }
        entry.domains.add(hostname);
      }
    }
  }

  let bestIdx = -1;
  let bestScore = 0;

  for (const [idx, entry] of scores) {
    if (entry.domains.size < MIN_DOMAIN_COUNT) continue;
    const score = entry.domains.size * Math.log10(entry.city.pop);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  if (bestIdx === -1) {
    const tzCoords = getTimezoneCoords();
    if (tzCoords) {
      return {
        city: 'timezone-fallback',
        lat: tzCoords.lat,
        lng: tzCoords.lng,
        country: '',
        confidence: 0.3,
        sources: ['timezone'],
        updatedAt: Date.now(),
      };
    }
    return null;
  }

  const winner = scores.get(bestIdx)!;
  const domainCount = winner.domains.size;
  const confidence = Math.min(0.95, 0.3 + domainCount * 0.1);

  return {
    city: winner.city.name,
    lat: winner.city.lat,
    lng: winner.city.lng,
    country: winner.city.country,
    confidence,
    sources: Array.from(winner.domains).slice(0, 5),
    updatedAt: Date.now(),
  };
}
