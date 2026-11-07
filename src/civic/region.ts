/// <reference types="chrome" />

/**
 * Zero-telemetry region detection from timezone + browsing domains.
 * No network calls, no geolocation API — just local signals.
 */

export interface DetectedRegion {
  country: string;
  subdivision: string | null;
  confidence: number;
  source: 'timezone' | 'domain' | 'combined' | 'override';
}

const TIMEZONE_TO_REGION: Record<string, { country: string; subdivision: string | null }> = {
  // North America — US
  'America/New_York': { country: 'US', subdivision: 'NY' },
  'America/Chicago': { country: 'US', subdivision: 'IL' },
  'America/Denver': { country: 'US', subdivision: 'CO' },
  'America/Los_Angeles': { country: 'US', subdivision: 'CA' },
  'America/Phoenix': { country: 'US', subdivision: 'AZ' },
  'America/Anchorage': { country: 'US', subdivision: 'AK' },
  'Pacific/Honolulu': { country: 'US', subdivision: 'HI' },
  'America/Detroit': { country: 'US', subdivision: 'MI' },
  'America/Indiana/Indianapolis': { country: 'US', subdivision: 'IN' },
  'America/Boise': { country: 'US', subdivision: 'ID' },
  'America/Kentucky/Louisville': { country: 'US', subdivision: 'KY' },

  // North America — Canada
  'America/Toronto': { country: 'CA', subdivision: 'ON' },
  'America/Vancouver': { country: 'CA', subdivision: 'BC' },
  'America/Edmonton': { country: 'CA', subdivision: 'AB' },
  'America/Winnipeg': { country: 'CA', subdivision: 'MB' },
  'America/Halifax': { country: 'CA', subdivision: 'NS' },
  'America/Regina': { country: 'CA', subdivision: 'SK' },
  'America/St_Johns': { country: 'CA', subdivision: 'NL' },
  'America/Whitehorse': { country: 'CA', subdivision: 'YT' },

  // UK & Ireland
  'Europe/London': { country: 'GB', subdivision: null },
  'Europe/Dublin': { country: 'IE', subdivision: null },

  // Europe
  'Europe/Paris': { country: 'FR', subdivision: null },
  'Europe/Berlin': { country: 'DE', subdivision: null },
  'Europe/Amsterdam': { country: 'NL', subdivision: null },
  'Europe/Brussels': { country: 'BE', subdivision: null },
  'Europe/Madrid': { country: 'ES', subdivision: null },
  'Europe/Rome': { country: 'IT', subdivision: null },
  'Europe/Zurich': { country: 'CH', subdivision: null },
  'Europe/Vienna': { country: 'AT', subdivision: null },
  'Europe/Stockholm': { country: 'SE', subdivision: null },
  'Europe/Oslo': { country: 'NO', subdivision: null },
  'Europe/Copenhagen': { country: 'DK', subdivision: null },
  'Europe/Helsinki': { country: 'FI', subdivision: null },
  'Europe/Warsaw': { country: 'PL', subdivision: null },
  'Europe/Prague': { country: 'CZ', subdivision: null },
  'Europe/Lisbon': { country: 'PT', subdivision: null },
  'Europe/Athens': { country: 'GR', subdivision: null },
  'Europe/Bucharest': { country: 'RO', subdivision: null },

  // Oceania
  'Australia/Sydney': { country: 'AU', subdivision: 'NSW' },
  'Australia/Melbourne': { country: 'AU', subdivision: 'VIC' },
  'Australia/Brisbane': { country: 'AU', subdivision: 'QLD' },
  'Australia/Perth': { country: 'AU', subdivision: 'WA' },
  'Australia/Adelaide': { country: 'AU', subdivision: 'SA' },
  'Australia/Hobart': { country: 'AU', subdivision: 'TAS' },
  'Australia/Darwin': { country: 'AU', subdivision: 'NT' },
  'Pacific/Auckland': { country: 'NZ', subdivision: null },

  // Asia
  'Asia/Tokyo': { country: 'JP', subdivision: null },
  'Asia/Seoul': { country: 'KR', subdivision: null },
  'Asia/Shanghai': { country: 'CN', subdivision: null },
  'Asia/Hong_Kong': { country: 'HK', subdivision: null },
  'Asia/Singapore': { country: 'SG', subdivision: null },
  'Asia/Kolkata': { country: 'IN', subdivision: null },
  'Asia/Calcutta': { country: 'IN', subdivision: null },
  'Asia/Jakarta': { country: 'ID', subdivision: null },
  'Asia/Bangkok': { country: 'TH', subdivision: null },
  'Asia/Manila': { country: 'PH', subdivision: null },
  'Asia/Taipei': { country: 'TW', subdivision: null },
  'Asia/Dubai': { country: 'AE', subdivision: null },

  // South America
  'America/Sao_Paulo': { country: 'BR', subdivision: null },
  'America/Argentina/Buenos_Aires': { country: 'AR', subdivision: null },
  'America/Santiago': { country: 'CL', subdivision: null },
  'America/Bogota': { country: 'CO', subdivision: null },
  'America/Lima': { country: 'PE', subdivision: null },
  'America/Mexico_City': { country: 'MX', subdivision: null },

  // Africa
  'Africa/Johannesburg': { country: 'ZA', subdivision: null },
  'Africa/Lagos': { country: 'NG', subdivision: null },
  'Africa/Nairobi': { country: 'KE', subdivision: null },
  'Africa/Cairo': { country: 'EG', subdivision: null },
};

const DOMAIN_TO_COUNTRY: Record<string, string> = {
  // US news & government
  'cnn.com': 'US', 'foxnews.com': 'US', 'nytimes.com': 'US',
  'washingtonpost.com': 'US', 'usatoday.com': 'US', 'npr.org': 'US',
  'politico.com': 'US', 'thehill.com': 'US', 'abcnews.go.com': 'US',
  'cbsnews.com': 'US', 'nbcnews.com': 'US', 'latimes.com': 'US',
  'chicagotribune.com': 'US', 'sfchronicle.com': 'US', 'nypost.com': 'US',
  'epa.gov': 'US', 'energy.gov': 'US', 'congress.gov': 'US',
  'whitehouse.gov': 'US', 'irs.gov': 'US',

  // Canada
  'cbc.ca': 'CA', 'globalnews.ca': 'CA', 'thestar.com': 'CA',
  'nationalpost.com': 'CA', 'macleans.ca': 'CA', 'ctv.ca': 'CA',
  'canada.ca': 'CA', 'gc.ca': 'CA',

  // UK
  'bbc.co.uk': 'GB', 'bbc.com': 'GB', 'theguardian.com': 'GB',
  'telegraph.co.uk': 'GB', 'independent.co.uk': 'GB', 'mirror.co.uk': 'GB',
  'dailymail.co.uk': 'GB', 'sky.com': 'GB', 'itv.com': 'GB',
  'gov.uk': 'GB', 'parliament.uk': 'GB',

  // Australia
  'abc.net.au': 'AU', 'smh.com.au': 'AU', 'news.com.au': 'AU',
  'theaustralian.com.au': 'AU', '9news.com.au': 'AU', 'sbs.com.au': 'AU',
  'gov.au': 'AU',

  // New Zealand
  'stuff.co.nz': 'NZ', 'nzherald.co.nz': 'NZ', 'rnz.co.nz': 'NZ',
  'govt.nz': 'NZ',

  // Ireland
  'rte.ie': 'IE', 'irishtimes.com': 'IE', 'independent.ie': 'IE',
  'gov.ie': 'IE',

  // Germany
  'spiegel.de': 'DE', 'zeit.de': 'DE', 'faz.net': 'DE',
  'tagesschau.de': 'DE', 'bild.de': 'DE',

  // France
  'lemonde.fr': 'FR', 'lefigaro.fr': 'FR', 'france24.com': 'FR',
  'liberation.fr': 'FR',

  // India
  'timesofindia.indiatimes.com': 'IN', 'ndtv.com': 'IN',
  'hindustantimes.com': 'IN', 'thehindu.com': 'IN',
  'gov.in': 'IN',
};

export function detectFromTimezone(): DetectedRegion | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = TIMEZONE_TO_REGION[tz];
    if (match) {
      return { ...match, confidence: 0.85, source: 'timezone' };
    }
  } catch {
    // Intl may not be available in all contexts
  }
  return null;
}

export function inferFromDomains(
  topDomains: { domain: string; count: number }[]
): DetectedRegion | null {
  const countryVotes: Record<string, number> = {};

  for (const { domain, count } of topDomains) {
    const lower = domain.toLowerCase();
    // Direct match
    const directCountry = DOMAIN_TO_COUNTRY[lower];
    if (directCountry) {
      countryVotes[directCountry] = (countryVotes[directCountry] || 0) + count;
      continue;
    }
    // TLD-based inference
    const tld = lower.split('.').pop();
    const tldCountry = TLD_TO_COUNTRY[tld ?? ''];
    if (tldCountry) {
      countryVotes[tldCountry] = (countryVotes[tldCountry] || 0) + count;
    }
  }

  let bestCountry = '';
  let bestScore = 0;
  let totalVotes = 0;

  for (const [country, score] of Object.entries(countryVotes)) {
    totalVotes += score;
    if (score > bestScore) {
      bestScore = score;
      bestCountry = country;
    }
  }

  if (!bestCountry || totalVotes === 0) return null;

  return {
    country: bestCountry,
    subdivision: null,
    confidence: Math.min(0.9, bestScore / totalVotes),
    source: 'domain',
  };
}

const TLD_TO_COUNTRY: Record<string, string> = {
  'au': 'AU', 'uk': 'GB', 'ca': 'CA', 'nz': 'NZ', 'ie': 'IE',
  'de': 'DE', 'fr': 'FR', 'nl': 'NL', 'be': 'BE', 'es': 'ES',
  'it': 'IT', 'ch': 'CH', 'at': 'AT', 'se': 'SE', 'no': 'NO',
  'dk': 'DK', 'fi': 'FI', 'pl': 'PL', 'cz': 'CZ', 'pt': 'PT',
  'jp': 'JP', 'kr': 'KR', 'cn': 'CN', 'in': 'IN', 'br': 'BR',
  'mx': 'MX', 'za': 'ZA', 'ng': 'NG', 'ke': 'KE',
};

export function resolveRegion(
  topDomains: { domain: string; count: number }[],
  override?: string | null,
): DetectedRegion {
  if (override) {
    return { country: override, subdivision: null, confidence: 1.0, source: 'override' };
  }

  const tzRegion = detectFromTimezone();
  const domainRegion = inferFromDomains(topDomains);

  if (tzRegion && domainRegion) {
    // If they agree on country, boost confidence and prefer timezone for subdivision
    if (tzRegion.country === domainRegion.country) {
      return {
        country: tzRegion.country,
        subdivision: tzRegion.subdivision,
        confidence: Math.min(0.98, tzRegion.confidence + domainRegion.confidence * 0.3),
        source: 'combined',
      };
    }
    // Disagree — trust timezone (more reliable)
    return tzRegion;
  }

  return tzRegion ?? domainRegion ?? { country: 'US', subdivision: null, confidence: 0.1, source: 'timezone' };
}

export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia',
  NZ: 'New Zealand', IE: 'Ireland', DE: 'Germany', FR: 'France',
  NL: 'Netherlands', BE: 'Belgium', ES: 'Spain', IT: 'Italy',
  CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', FI: 'Finland', PL: 'Poland', CZ: 'Czech Republic',
  PT: 'Portugal', GR: 'Greece', RO: 'Romania', JP: 'Japan',
  KR: 'South Korea', CN: 'China', HK: 'Hong Kong', SG: 'Singapore',
  IN: 'India', ID: 'Indonesia', TH: 'Thailand', PH: 'Philippines',
  TW: 'Taiwan', AE: 'UAE', BR: 'Brazil', AR: 'Argentina',
  CL: 'Chile', CO: 'Colombia', PE: 'Peru', MX: 'Mexico',
  ZA: 'South Africa', NG: 'Nigeria', KE: 'Kenya', EG: 'Egypt',
};
