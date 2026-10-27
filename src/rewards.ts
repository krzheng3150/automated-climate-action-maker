/**
 * Every action's reward in one place. The points scheme is a prototype and will be redesigned, so
 * nothing else should hard-code a point value. A food swap earns no points for now: only its
 * computed CO2e saving is recorded.
 */
export const REWARDS = {
  civicLetter: { points: 50, co2SavedKg: 0 },
  circularSearch: { points: 80, co2SavedKg: 65 },
  foodSwap: { points: 0 },
} as const;
