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

export const TIMEZONE_COORDS: Record<string, { lat: number; lng: number }> = {
  'America/New_York': { lat: 40.7128, lng: -74.006 },
  'America/Chicago': { lat: 41.8781, lng: -87.6298 },
  'America/Denver': { lat: 39.7392, lng: -104.9903 },
  'America/Los_Angeles': { lat: 34.0522, lng: -118.2437 },
  'America/Phoenix': { lat: 33.4484, lng: -112.074 },
  'America/Anchorage': { lat: 61.2181, lng: -149.9003 },
  'Pacific/Honolulu': { lat: 21.3069, lng: -157.8583 },
  'America/Detroit': { lat: 42.3314, lng: -83.0458 },
  'America/Indiana/Indianapolis': { lat: 39.7684, lng: -86.1581 },
  'America/Boise': { lat: 43.615, lng: -116.2023 },
  'America/Kentucky/Louisville': { lat: 38.2527, lng: -85.7585 },
  'America/Toronto': { lat: 43.6532, lng: -79.3832 },
  'America/Vancouver': { lat: 49.2827, lng: -123.1207 },
  'America/Edmonton': { lat: 53.5461, lng: -113.4938 },
  'America/Winnipeg': { lat: 49.8951, lng: -97.1384 },
  'America/Halifax': { lat: 44.6488, lng: -63.5752 },
  'Europe/London': { lat: 51.5074, lng: -0.1278 },
  'Europe/Dublin': { lat: 53.3498, lng: -6.2603 },
  'Europe/Paris': { lat: 48.8566, lng: 2.3522 },
  'Europe/Berlin': { lat: 52.52, lng: 13.405 },
  'Europe/Amsterdam': { lat: 52.3676, lng: 4.9041 },
  'Europe/Madrid': { lat: 40.4168, lng: -3.7038 },
  'Europe/Rome': { lat: 41.9028, lng: 12.4964 },
  'Europe/Stockholm': { lat: 59.3293, lng: 18.0686 },
  'Europe/Oslo': { lat: 59.9139, lng: 10.7522 },
  'Europe/Copenhagen': { lat: 55.6761, lng: 12.5683 },
  'Europe/Helsinki': { lat: 60.1699, lng: 24.9384 },
  'Australia/Sydney': { lat: -33.8688, lng: 151.2093 },
  'Australia/Melbourne': { lat: -37.8136, lng: 144.9631 },
  'Australia/Brisbane': { lat: -27.4698, lng: 153.0251 },
  'Australia/Perth': { lat: -31.9505, lng: 115.8605 },
  'Pacific/Auckland': { lat: -36.8485, lng: 174.7633 },
  'Asia/Tokyo': { lat: 35.6762, lng: 139.6503 },
  'Asia/Seoul': { lat: 37.5665, lng: 126.978 },
  'Asia/Shanghai': { lat: 31.2304, lng: 121.4737 },
  'Asia/Singapore': { lat: 1.3521, lng: 103.8198 },
  'Asia/Kolkata': { lat: 22.5726, lng: 88.3639 },
  'Asia/Jakarta': { lat: -6.2088, lng: 106.8456 },
  'Asia/Bangkok': { lat: 13.7563, lng: 100.5018 },
  'Asia/Dubai': { lat: 25.2048, lng: 55.2708 },
  'America/Sao_Paulo': { lat: -23.5505, lng: -46.6333 },
  'America/Argentina/Buenos_Aires': { lat: -34.6037, lng: -58.3816 },
  'America/Mexico_City': { lat: 19.4326, lng: -99.1332 },
  'America/Bogota': { lat: 4.711, lng: -74.0721 },
  'America/Lima': { lat: -12.0464, lng: -77.0428 },
  'Africa/Johannesburg': { lat: -26.2041, lng: 28.0473 },
  'Africa/Lagos': { lat: 6.5244, lng: 3.3792 },
  'Africa/Nairobi': { lat: -1.2921, lng: 36.8219 },
  'Africa/Cairo': { lat: 30.0444, lng: 31.2357 },
};

export function getTimezoneCoords(): { lat: number; lng: number } | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COORDS[tz] ?? null;
  } catch {
    return null;
  }
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
