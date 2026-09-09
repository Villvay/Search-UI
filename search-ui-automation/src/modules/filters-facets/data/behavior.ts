/**
 * Filters & Facets — behavior discovered on QA SERP (qa-baersupply.vercel.app).
 *
 * Desktop/tablet: left aside accordion (`data-testid="accordion-filter"`).
 * Mobile: "Filters & sort" opens a dialog containing the same accordion.
 * Selection applies immediately (URL `filters` JSON updates; no Apply button).
 */
export const FILTERS_FACETS_BEHAVIOR = {
  searchPath: '/search',
  queryParam: 'q',
  filtersParam: 'filters',
  appliesImmediately: true,
  supportsMultiValueSameFacet: true,
  supportsCrossFacetSelection: true,
  supportsClearAll: true,
  supportsIndividualClear: true,
  uiSettleTimeoutMs: 30_000,
} as const;

export const FILTERS_FACETS_COPY = {
  panelHeading: 'Filters',
  mobileTrigger: /Filters\s*&\s*sort/i,
  clearAll: /^Clear all$/i,
  searchResultsHeadingPrefix: 'Search Results for',
  noResultsHeading: 'No Results',
} as const;
