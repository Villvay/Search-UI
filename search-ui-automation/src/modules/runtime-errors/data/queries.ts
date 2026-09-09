/**
 * Small deterministic query set for runtime monitoring (not relevance bench).
 * Copied conceptually from existing modules — no cross-module imports.
 */
export const runtimeErrorQueries = {
  valid: 'hinge',
  suggestion: 'hinge',
  result: 'hinge',
  filter: 'hinges',
  /** Prefixed recent-search seed (localStorage-backed on QA). */
  recent: 'rt-auto-hinge',
} as const;

export const runtimeFilterOptions = {
  brandFacet: 'Brand',
  brandPrimary: 'Blum, Inc.',
} as const;
