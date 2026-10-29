/**
 * Distinct queries for stale-state detection (copied conceptually from existing
 * datasets — no cross-module imports).
 */
export const cacheStateQueries = {
  a: 'hinge',
  b: 'blum',
  c: 'screw',
  filterable: 'hinges',
} as const;

export const cacheStateFilter = {
  brandFacet: 'Brand',
  brandPrimary: 'Blum, Inc.',
} as const;
