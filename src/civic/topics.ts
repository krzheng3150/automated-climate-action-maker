import type { ArchetypeKey, DigitalFootprintSnapshot, DomainFrequency } from '../index';

/**
 * Derives climate topic affinities from local browsing signals.
 * No network calls — uses archetype scores + domain categorization.
 */

export type ClimateTopic =
  | 'energy'
  | 'transport'
  | 'food'
  | 'fossil-fuels'
  | 'conservation'
  | 'waste'
  | 'policy'
  | 'circular-economy';

export const ALL_TOPICS: ClimateTopic[] = [
  'energy', 'transport', 'food', 'fossil-fuels',
  'conservation', 'waste', 'policy', 'circular-economy',
];

export type TopicAffinities = Record<ClimateTopic, number>;

const ARCHETYPE_TOPICS: Record<ArchetypeKey, Partial<Record<ClimateTopic, number>>> = {
  circular_deal_hunter: {
    'circular-economy': 0.8,
    'waste': 0.6,
    'conservation': 0.2,
  },
  purpose_seeker: {
    'policy': 0.5,
    'conservation': 0.5,
    'energy': 0.3,
    'food': 0.3,
  },
  digital_minimalist: {
    'energy': 0.7,
    'waste': 0.4,
    'circular-economy': 0.3,
  },
  civic_advocate: {
    'policy': 0.8,
    'energy': 0.5,
    'fossil-fuels': 0.5,
    'conservation': 0.3,
  },
  general_browser: {
    'energy': 0.2,
    'policy': 0.2,
    'conservation': 0.2,
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

  // Food & agriculture
  'allrecipes.com': ['food'],
  'foodnetwork.com': ['food'],
  'seriouseats.com': ['food'],
  'bonappetit.com': ['food'],
  'cookinglight.com': ['food'],
  'eatingwell.com': ['food'],
  'epicurious.com': ['food'],
  'budgetbytes.com': ['food'],
  'minimalistbaker.com': ['food'],
  'thekitchn.com': ['food'],

  // Conservation & nature
  'nationalgeographic.com': ['conservation'],
  'worldwildlife.org': ['conservation'],
  'nature.org': ['conservation'],
  'audubon.org': ['conservation'],
  'sierraclub.org': ['conservation', 'policy'],
  'nrdc.org': ['conservation', 'policy'],

  // Fossil fuels & divestment
  'oilprice.com': ['fossil-fuels', 'energy'],
  'rigzone.com': ['fossil-fuels'],
  'gofossilfree.org': ['fossil-fuels', 'policy'],

  // Policy & governance
  'epa.gov': ['policy', 'conservation'],
  'energy.gov': ['policy', 'energy'],
  'iea.org': ['policy', 'energy'],
  'unfccc.int': ['policy'],
  'ipcc.ch': ['policy'],
  'climateactiontracker.org': ['policy'],

  // Circular economy
  'backmarket.com': ['circular-economy'],
  'ebay.com': ['circular-economy'],
  'swappa.com': ['circular-economy'],
  'ifixit.com': ['circular-economy', 'waste'],
  'freecycle.org': ['waste', 'circular-economy'],
  'thredup.com': ['circular-economy', 'waste'],
  'poshmark.com': ['circular-economy'],

  // Broad sustainability
  'treehugger.com': ['conservation', 'energy', 'food'],
  'grist.org': ['policy', 'energy', 'conservation'],
  'ecowatch.com': ['conservation', 'energy', 'policy'],
  'theguardian.com': ['policy'],
  'yale.edu': ['policy', 'conservation'],
};

function emptyAffinities(): TopicAffinities {
  return {
    'energy': 0, 'transport': 0, 'food': 0, 'fossil-fuels': 0,
    'conservation': 0, 'waste': 0, 'policy': 0, 'circular-economy': 0,
  };
}

export function computeTopicAffinities(
  snapshot: DigitalFootprintSnapshot | null,
  foodSwapEngaged = false,
): TopicAffinities {
  const affinities = emptyAffinities();

  if (!snapshot) {
    affinities.energy = 0.3;
    affinities.policy = 0.3;
    return affinities;
  }

  // Layer 1: Archetype-based scores
  const dist = snapshot.projection?.archetypeDistribution;
  if (dist) {
    for (const [archetype, weight] of Object.entries(dist) as [ArchetypeKey, number][]) {
      const topics = ARCHETYPE_TOPICS[archetype];
      if (!topics) continue;
      for (const [topic, score] of Object.entries(topics) as [ClimateTopic, number][]) {
        affinities[topic] += score * weight;
      }
    }
  }

  // Layer 2: Domain-based enrichment
  const topDomains: DomainFrequency[] = snapshot.sources?.history?.topDomains ?? [];
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

  // Layer 3: Food swap engagement signal
  if (foodSwapEngaged) {
    affinities.food += 0.3;
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
