/// <reference types="chrome" />

import { recordDiagnostic } from './index';

/**
 * Single choke point for every link the extension opens on the user's behalf.
 * Partner tagging (affiliate/referral params) is applied here and nowhere else.
 * `check-static.mjs` fails the build if window.open / chrome.tabs.create / hardcoded
 * http(s) literals appear in any other source file, so new code cannot bypass this module.
 */

export type TaggingMode = 'none' | 'query-params';

export interface OutboundPartner {
  id: string;
  name: string;
  /** Registrable domains. Subdomains match; lookalike hosts (evilbackmarket.com) do not. */
  hosts: string[];
  mode: TaggingMode;
  /** Static, public tag values appended in `query-params` mode. Never per-user or per-install. */
  params?: Record<string, string>;
  /** Tagging stays off until the partner programme is approved and real IDs are filled in. */
  enabled: boolean;
  group?: 'circular_marketplace';
  /** Search URL with a `{query}` placeholder, filled with the encoded user query. */
  searchTemplate?: string;
}

export const OUTBOUND_PARTNERS: OutboundPartner[] = [
  {
    id: 'backmarket',
    name: 'Back Market',
    hosts: ['backmarket.com'],
    mode: 'none',
    enabled: false,
    group: 'circular_marketplace',
    searchTemplate: 'https://www.backmarket.com/en-us/search?q={query}',
  },
  {
    id: 'ebay-refurbished',
    name: 'eBay Refurbished',
    hosts: ['ebay.com'],
    mode: 'none',
    enabled: false,
    group: 'circular_marketplace',
    searchTemplate: 'https://www.ebay.com/sch/i.html?LH_ItemCondition=2000|2500&_nkw={query}',
  },
  {
    id: 'swappa',
    name: 'Swappa',
    hosts: ['swappa.com'],
    mode: 'none',
    enabled: false,
    group: 'circular_marketplace',
    searchTemplate: 'https://swappa.com/search?q={query}',
  },
];

export interface OutboundLink {
  url: string;
  hostname: string;
  /** Matching registry entry, or null for an unregistered host. */
  partnerId: string | null;
  tagged: boolean;
}

export interface OutboundContext {
  source: 'content' | 'background' | 'popup';
  placement?: string;
}

export function partnersInGroup(
  group: NonNullable<OutboundPartner['group']>,
  partners: OutboundPartner[] = OUTBOUND_PARTNERS
): OutboundPartner[] {
  return partners.filter((p) => p.group === group && p.searchTemplate);
}

export function buildSearchUrl(partner: OutboundPartner, query: string): string {
  return (partner.searchTemplate ?? '').replace('{query}', encodeURIComponent(query));
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

function findPartner(hostname: string, partners: OutboundPartner[]): OutboundPartner | null {
  for (const partner of partners) {
    for (const host of partner.hosts) {
      if (hostname === host || hostname.endsWith(`.${host}`)) return partner;
    }
  }
  return null;
}

function paramKey(pair: string): string {
  const raw = pair.split('=')[0] ?? '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Replaces any existing copy of our tag params without re-serializing the rest of the query,
 * so partner URLs keep their original encoding (e.g. `2000|2500`).
 */
function applyQueryParams(url: URL, params: Record<string, string>): void {
  const ours = new Set(Object.keys(params));
  const kept = url.search
    .replace(/^\?/, '')
    .split('&')
    .filter((pair) => pair && !ours.has(paramKey(pair)));
  const added = Object.entries(params).map(
    ([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  );
  url.search = [...kept, ...added].join('&');
}

/**
 * Pure builder: validates the URL and applies partner tagging.
 * Returns null for anything that must not be opened (non-http(s) schemes, malformed input).
 * Unregistered hosts are returned untagged with `partnerId: null`.
 */
export function buildOutboundUrl(
  rawUrl: string,
  partners: OutboundPartner[] = OUTBOUND_PARTNERS
): OutboundLink | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const hostname = normalizeHostname(url.hostname);
  const partner = findPartner(hostname, partners);
  const tagParams = partner?.params;
  const shouldTag =
    partner !== null &&
    partner.enabled &&
    partner.mode === 'query-params' &&
    tagParams !== undefined &&
    Object.keys(tagParams).length > 0;

  if (shouldTag && tagParams) applyQueryParams(url, tagParams);

  return {
    url: url.toString(),
    hostname,
    partnerId: partner?.id ?? null,
    tagged: shouldTag,
  };
}

/**
 * The only place the extension opens an external tab. Logs one diagnostic per open
 * (hostname only, never the URL, which can contain the user's search text).
 */
export function openOutbound(rawUrl: string, context: OutboundContext): boolean {
  const link = buildOutboundUrl(rawUrl);
  if (!link) {
    recordDiagnostic({
      source: context.source,
      level: 'warn',
      event: 'OUTBOUND_REFUSED',
      details: 'Refused to open a malformed or non-http(s) URL',
    });
    return false;
  }

  if (link.partnerId === null) {
    recordDiagnostic({
      source: context.source,
      level: 'warn',
      event: 'OUTBOUND_UNREGISTERED_HOST',
      details: `host=${link.hostname} opened untagged`,
    });
  }
  recordDiagnostic({
    source: context.source,
    level: 'info',
    event: 'OUTBOUND_OPEN',
    details: `partner=${link.partnerId ?? 'none'} tagged=${link.tagged} host=${link.hostname}${
      context.placement ? ` placement=${context.placement}` : ''
    }`,
  });

  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(link.url, '_blank', 'noopener');
  } else {
    chrome.tabs.create({ url: link.url });
  }
  return true;
}
