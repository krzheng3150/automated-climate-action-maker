import type { ArchetypeKey, DigitalFootprintSnapshot, DomainFrequency } from '../index';

/**
 * Derives climate topic affinities from local browsing signals.
 * No network calls — uses archetype scores + domain categorization.
 *
 * Taxonomy aligned with Drawdown / IPCC AR6 sectors + engagement styles.
 * Sector tags: energy, transport, built-environment, food-land, nature,
 *              industry-materials, policy
 * Engagement tags: community, professional, hands-on, advocacy, learning, creative
 */

export type ClimateTopic =
  | 'energy'
  | 'transport'
  | 'built-environment'
  | 'food-land'
  | 'nature'
  | 'industry-materials'
  | 'policy'
  | 'community'
  | 'professional'
  | 'hands-on'
  | 'advocacy'
  | 'learning'
  | 'creative';

export const ALL_TOPICS: ClimateTopic[] = [
  'energy', 'transport', 'built-environment', 'food-land',
  'nature', 'industry-materials', 'policy',
  'community', 'professional', 'hands-on', 'advocacy',
  'learning', 'creative',
];

export type TopicAffinities = Record<ClimateTopic, number>;

const ARCHETYPE_TOPICS: Record<ArchetypeKey, Partial<Record<ClimateTopic, number>>> = {
  circular_deal_hunter: {
    'industry-materials': 0.8,
    'hands-on': 0.5,
    'community': 0.3,
  },
  purpose_seeker: {
    'policy': 0.4,
    'nature': 0.5,
    'energy': 0.3,
    'food-land': 0.3,
    'learning': 0.4,
  },
  digital_minimalist: {
    'energy': 0.7,
    'industry-materials': 0.4,
    'learning': 0.3,
  },
  civic_advocate: {
    'policy': 0.7,
    'advocacy': 0.8,
    'energy': 0.5,
    'nature': 0.3,
  },
  general_browser: {
    'energy': 0.2,
    'policy': 0.2,
    'nature': 0.2,
  },
};

const DOMAIN_TOPICS: Record<string, ClimateTopic[]> = {
  // Transport & EVs
  'electrek.co': ['transport', 'energy'],
  'insideevs.com': ['transport'],
  'cleantechnica.com': ['energy', 'transport'],
  'greencarreports.com': ['transport'],
  'tesla.com': ['transport', 'energy'],
  'rivian.com': ['transport'],

  // Energy
  'renewableenergyworld.com': ['energy'],
  'solarpowerworldonline.com': ['energy'],
  'windpowermonthly.com': ['energy'],
  'utilitydive.com': ['energy', 'policy'],
  'energymonitor.ai': ['energy'],

  // Food & land
  'allrecipes.com': ['food-land'],
  'foodnetwork.com': ['food-land'],
  'seriouseats.com': ['food-land'],
  'bonappetit.com': ['food-land'],
  'cookinglight.com': ['food-land'],
  'eatingwell.com': ['food-land'],
  'epicurious.com': ['food-land'],
  'budgetbytes.com': ['food-land'],
  'minimalistbaker.com': ['food-land'],
  'thekitchn.com': ['food-land'],

  // Nature & conservation
  'nationalgeographic.com': ['nature', 'learning'],
  'worldwildlife.org': ['nature'],
  'nature.org': ['nature'],
  'audubon.org': ['nature'],
  'sierraclub.org': ['nature', 'advocacy'],
  'nrdc.org': ['nature', 'policy'],

  // Energy transition & fossil fuel opposition (→ energy + advocacy)
  'oilprice.com': ['energy'],
  'rigzone.com': ['energy'],
  'gofossilfree.org': ['advocacy', 'energy'],

  // Policy & governance
  'epa.gov': ['policy', 'nature'],
  'energy.gov': ['policy', 'energy'],
  'iea.org': ['policy', 'energy', 'learning'],
  'unfccc.int': ['policy'],
  'ipcc.ch': ['policy', 'learning'],
  'climateactiontracker.org': ['policy', 'learning'],

  // Industry & circular economy
  'backmarket.com': ['industry-materials'],
  'ebay.com': ['industry-materials'],
  'swappa.com': ['industry-materials'],
  'ifixit.com': ['industry-materials', 'hands-on'],
  'freecycle.org': ['industry-materials', 'community'],
  'thredup.com': ['industry-materials'],
  'poshmark.com': ['industry-materials'],

  // Broad sustainability
  'treehugger.com': ['nature', 'energy', 'food-land'],
  'grist.org': ['policy', 'energy', 'nature'],
  'ecowatch.com': ['nature', 'energy', 'policy'],
  'theguardian.com': ['policy'],
  'yale.edu': ['policy', 'learning'],
};

function emptyAffinities(): TopicAffinities {
  return {
    'energy': 0, 'transport': 0, 'built-environment': 0, 'food-land': 0,
    'nature': 0, 'industry-materials': 0, 'policy': 0,
    'community': 0, 'professional': 0, 'hands-on': 0, 'advocacy': 0,
    'learning': 0, 'creative': 0,
  };
}

export function computeTopicAffinities(
  snapshot: DigitalFootprintSnapshot | null,
  foodSwapEngaged = false,
  pathTopicSignals?: Record<ClimateTopic, number> | null,
): TopicAffinities {
  const affinities = emptyAffinities();

  if (!snapshot && !pathTopicSignals) {
    affinities.energy = 0.3;
    affinities.policy = 0.3;
    return affinities;
  }

  // Layer 1: Path-extracted topic signals (primary — broadest coverage)
  if (pathTopicSignals) {
    const totalHits = Object.values(pathTopicSignals).reduce((s, v) => s + v, 0) || 1;
    for (const topic of ALL_TOPICS) {
      const count = pathTopicSignals[topic] ?? 0;
      if (count > 0) {
        affinities[topic] += Math.min(0.8, (count / totalHits) * 3);
      }
    }
  }

  // Layer 2: Archetype-based scores (coarse behavioral profile)
  const dist = snapshot?.projection?.archetypeDistribution;
  if (dist) {
    for (const [archetype, weight] of Object.entries(dist) as [ArchetypeKey, number][]) {
      const topics = ARCHETYPE_TOPICS[archetype];
      if (!topics) continue;
      for (const [topic, score] of Object.entries(topics) as [ClimateTopic, number][]) {
        affinities[topic] += score * weight * 0.5;
      }
    }
  }

  // Layer 3: Exact domain enrichment (high precision, low coverage)
  const topDomains: DomainFrequency[] = snapshot?.sources?.history?.topDomains ?? [];
  const totalVisits = topDomains.reduce((sum, d) => sum + d.count, 0) || 1;

  for (const { domain, count } of topDomains) {
    const lower = domain.toLowerCase();
    const topics = DOMAIN_TOPICS[lower];
    if (!topics) continue;
    const weight = Math.min(0.4, (count / totalVisits) * 2);
    for (const topic of topics) {
      affinities[topic] += weight;
    }
  }

  // Layer 4: Food swap engagement signal
  if (foodSwapEngaged) {
    affinities['food-land'] += 0.3;
  }

  // Normalize to 0-1 range
  let max = 0;
  for (const val of Object.values(affinities)) {
    if (val > max) max = val;
  }
  if (max > 0) {
    for (const topic of ALL_TOPICS) {
      affinities[topic] = Number((affinities[topic] / max).toFixed(3));
    }
  }

  return affinities;
}

export function topTopics(affinities: TopicAffinities, n = 3): ClimateTopic[] {
  return ALL_TOPICS
    .filter((t) => affinities[t] > 0.1)
    .sort((a, b) => affinities[b] - affinities[a])
    .slice(0, n);
}
