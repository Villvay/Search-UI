/**
 * Deterministic SERP queries for Sorting (not analytics).
 * Chosen because QA returns a large Products result set for inspection.
 */
export const sortingQueries = {
  primary: {
    id: 'SORT-Q001',
    value: 'hinges',
  },
  alternate: {
    id: 'SORT-Q002',
    value: 'drawer slides',
  },
} as const;
