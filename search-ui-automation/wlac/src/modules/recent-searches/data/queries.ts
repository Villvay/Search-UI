export const recentSearchQueries = {
  a: 'rs-wlac-hinge',
  b: 'rs-wlac-screw',
  c: 'rs-wlac-drawer',
  d: 'rs-wlac-slide',
  e: 'rs-wlac-knob',
  f: 'rs-wlac-pull',
} as const;

export const recentSearchTriple = [
  recentSearchQueries.a,
  recentSearchQueries.b,
  recentSearchQueries.c,
] as const;

export const recentSearchFive = [
  recentSearchQueries.a,
  recentSearchQueries.b,
  recentSearchQueries.c,
  recentSearchQueries.d,
  recentSearchQueries.e,
] as const;

export const recentSearchSix = [
  ...recentSearchFive,
  recentSearchQueries.f,
] as const;
