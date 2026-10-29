/**
 * Deterministic SERP queries for Filters & Facets (not analytics).
 * Chosen because QA reliably exposes multiple facet groups (Brand, Category, …).
 */
export const filtersFacetsQueries = {
  /** Primary query — rich Brand + Category facets on QA. */
  filterable: {
    id: 'FF-Q001',
    value: 'hinges',
  },
  /** Secondary filterable query for persistence / back tests. */
  alternate: {
    id: 'FF-Q002',
    value: 'drawer slides',
  },
} as const;

/** Known facet option values observed on QA for `hinges`. */
export const filtersFacetsOptions = {
  brandFacet: 'Brand',
  categoryFacet: 'Category',
  brandPrimary: 'Blum, Inc.',
  brandSecondary: 'Salice America',
  /** First Category option test id value observed on QA (spacing preserved). */
  categoryPrimary: 'European  Standard  Hinges',
} as const;
