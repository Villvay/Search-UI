/**
 * On-Enter behavior constants from live QA inspection.
 */
export const ON_ENTER_BEHAVIOR = {
  searchPath: '/search',
  queryParam: 'q',
  /** Empty Enter must not navigate. */
  emptyEnterNavigates: false,
  /** Whitespace Enter navigates to /search?q=+++ and shows No Results. */
  whitespaceEnterNavigates: true,
  /** Exact SKU queries may redirect from /search to /product/... */
  skuMayRedirectToProduct: true,
  /** Enter with suggestions open still submits typed query (no route param). */
  enterWithDropdownOpenPerformsNormalSearch: true,
  uiSettleTimeoutMs: 30_000,
} as const;

export const ON_ENTER_COPY = {
  searchResultsHeadingPrefix: 'Search Results for',
  noResultsHeading: 'No Results',
  noResultsMessage:
    "We couldn't find any results matching your search. Please try again.",
} as const;
