import type { ClimateTopic, TopicAffinities } from './topics';

/**
 * Pure ranking engine for civic actions. Filters by region,
 * scores by topic overlap + urgency + impact. Zero side effects.
 */

export interface CivicAction {
  id: string;
  title: string;
  url: string;
  platform: string;
  region: string;
  topics: ClimateTopic[];
  type: 'petition' | 'comment' | 'campaign' | 'event';
  signatures?: number;
  deadline?: string;
  fetchedAt: number;
}

export interface CivicActionSource {
  id: string;
  name: string;
  region: string;
  baseUrl: string;
  type: 'api' | 'scrape' | 'curated';
}

export interface RankedCivicAction extends CivicAction {
  score: number;
}

export function matchCivicActions(
  userRegion: string,
  affinities: TopicAffinities,
  actions: CivicAction[],
  maxResults = 3,
): RankedCivicAction[] {
  const now = Date.now();

  const candidates = actions.filter((a) => {
    if (a.region !== userRegion && a.region !== 'global') return false;
    if (a.deadline && new Date(a.deadline).getTime() < now) return false;
    return true;
  });

  const scored: RankedCivicAction[] = candidates.map((action) => {
    let score = 0;

    // Topic overlap: sum the user's affinity for each matching topic
    for (const topic of action.topics) {
      score += affinities[topic] ?? 0;
    }

    // Urgency bonus: actions closing within 14 days get a boost
    if (action.deadline) {
      const daysLeft = (new Date(action.deadline).getTime() - now) / (1000 * 60 * 60 * 24);
      if (daysLeft > 0 && daysLeft <= 14) {
        score += 0.4 * (1 - daysLeft / 14);
      }
    }

    // Impact bonus: higher signature counts = social proof
    if (action.signatures && action.signatures > 0) {
      score += Math.min(0.3, Math.log10(action.signatures) / 15);
    }

    // Prefer region-specific over global
    if (action.region !== 'global') {
      score += 0.1;
    }

    return { ...action, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

/**
 * Fallback platform URLs for regions without API-sourced actions.
 * These open the platform's climate page — always current since the
 * platform maintains its own listings.
 */
export const FALLBACK_PLATFORMS: Record<string, { name: string; url: string }[]> = {
  US: [
    { name: '350.org Actions', url: 'https://350.org/campaigns/' },
    { name: 'Sierra Club', url: 'https://www.sierraclub.org/take-action' },
  ],
  CA: [
    { name: 'Leadnow', url: 'https://leadnow.ca/campaigns/' },
    { name: '350.org Actions', url: 'https://350.org/campaigns/' },
  ],
  GB: [
    { name: 'UK Parliament Petitions', url: 'https://petition.parliament.uk/petitions?state=open' },
    { name: '38 Degrees', url: 'https://home.38degrees.org.uk/campaigns/' },
    { name: 'Friends of the Earth', url: 'https://friendsoftheearth.uk/take-action' },
  ],
  AU: [
    { name: 'GetUp', url: 'https://www.getup.org.au/campaigns' },
    { name: 'ACF', url: 'https://www.acf.org.au/take-action' },
  ],
  NZ: [
    { name: '350 Aotearoa', url: 'https://350.org.nz/' },
    { name: 'Forest & Bird', url: 'https://www.forestandbird.org.nz/take-action' },
  ],
  DE: [
    { name: 'Campact', url: 'https://www.campact.de/kampagnen/' },
    { name: '350.org Actions', url: 'https://350.org/campaigns/' },
  ],
  FR: [
    { name: 'Greenpeace France', url: 'https://www.greenpeace.fr/agir/' },
    { name: '350.org Actions', url: 'https://350.org/campaigns/' },
  ],
  IN: [
    { name: '350.org India', url: 'https://350.org/campaigns/' },
    { name: 'Greenpeace India', url: 'https://www.greenpeace.org/india/en/act/' },
  ],
  global: [
    { name: '350.org Actions', url: 'https://350.org/campaigns/' },
    { name: 'Avaaz', url: 'https://secure.avaaz.org/page/en/' },
  ],
};

export function getFallbackPlatforms(region: string): { name: string; url: string }[] {
  return FALLBACK_PLATFORMS[region] ?? FALLBACK_PLATFORMS['global'];
}
