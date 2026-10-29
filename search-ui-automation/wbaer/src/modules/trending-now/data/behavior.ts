/**
 * Trending Now — behavior discovered on QA (qa-baersupply.vercel.app).
 *
 * Idle empty-focus dropdown shows heading "Trending now" + button chips.
 * Click navigates to `/search?q=<term>` with no `route` param (unlike suggestions).
 * Item labels are dynamic (API `/trending?size=8`); do not hard-code terms.
 */
export const TRENDING_NOW_BEHAVIOR = {
  searchPath: '/search',
  queryParam: 'q',
  /** Observed trending API; size is server-controlled (typically 8). */
  trendingApiPathFragment: '/trending',
  /** Trending click does not add suggestion-style `route=` on QA. */
  clickAddsRouteParam: false,
  /** Minimum items when the section is shown (contract: at least one). */
  minItemCountWhenPresent: 1,
  /** Soft expectation from live API `size=8`; not asserted as a hard contract. */
  observedTypicalItemCount: 8,
  uiSettleTimeoutMs: 30_000,
} as const;

export const TRENDING_NOW_COPY = {
  trendingHeading: 'Trending now',
  searchResultsHeadingPrefix: 'Search Results for',
  noResultsHeading: 'No Results',
} as const;
