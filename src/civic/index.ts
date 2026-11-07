export { resolveRegion, detectFromTimezone, inferFromDomains, COUNTRY_NAMES } from './region';
export type { DetectedRegion } from './region';

export { computeTopicAffinities, topTopics, ALL_TOPICS } from './topics';
export type { ClimateTopic, TopicAffinities } from './topics';

export { matchCivicActions, getFallbackPlatforms, FALLBACK_PLATFORMS } from './recommend';
export type { CivicAction, CivicActionSource, RankedCivicAction } from './recommend';

export { CIVIC_ACTIONS, CIVIC_DATA_META } from './data';
