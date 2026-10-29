/**
 * Deterministic recent-search queries for QA.
 * Prefixed to avoid colliding with organic shopper history and trending chips.
 * Valid Enter → /search?q=… flow (no PDP redirect observed).
 */
export const recentSearchQueries = {
  a: 'rs-auto-hinge',
  b: 'rs-auto-screw',
  c: 'rs-auto-drawer',
  d: 'rs-auto-slide',
  e: 'rs-auto-knob',
  f: 'rs-auto-pull',
} as const;

export const recentSearchQueryList = [
  recentSearchQueries.a,
  recentSearchQueries.b,
  recentSearchQueries.c,
  recentSearchQueries.d,
  recentSearchQueries.e,
  recentSearchQueries.f,
] as const;

/** First three for RECENT-002. */
export const recentSearchTriple = [
  recentSearchQueries.a,
  recentSearchQueries.b,
  recentSearchQueries.c,
] as const;

/** Five in creation order (oldest → newest) for ordering tests. */
export const recentSearchFiveOrdered = [
  recentSearchQueries.a,
  recentSearchQueries.b,
  recentSearchQueries.c,
  recentSearchQueries.d,
  recentSearchQueries.e,
] as const;
