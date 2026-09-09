/**
 * Cache & search-state validation — QA-inspected contracts.
 */
export const CACHE_STATE_BEHAVIOR = {
  searchPath: '/search',
  queryParam: 'q',
  filtersParam: 'filters',
  uiSettleTimeoutMs: 30_000,
  /**
   * OBSERVED DEFECT: goBack() updates URL q but leaves SERP UI on previous query.
   * CACHE-005 asserts sync and is expected to fail until the app is fixed.
   */
  backForwardKeepsUiInSync: false,
  /** Entering a new query from SERP clears filters param (observed). */
  newSearchClearsFilters: true,
  searchApiHostFragment: 'search-villvay.workers.dev',
} as const;

export const CACHE_STATE_COPY = {
  searchResultsHeadingPrefix: 'Search Results for',
  noResultsHeading: 'No Results',
  trendingHeading: 'Trending now',
  clearSearch: 'Clear search',
} as const;
