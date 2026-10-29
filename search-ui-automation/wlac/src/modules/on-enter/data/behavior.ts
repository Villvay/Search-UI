export const ON_ENTER_BEHAVIOR = {
  searchPath: '/search',
  queryParam: 'q',
  emptyEnterNavigates: false,
  whitespaceEnterNavigates: true,
  skuMayRedirectToProduct: true,
  enterWithDropdownOpenPerformsNormalSearch: true,
  uiSettleTimeoutMs: 30_000,
} as const;

export const ON_ENTER_COPY = {
  searchResultsHeadingPrefix: 'Search Results for',
  noResultsHeading: 'No Results',
  noResultsMessage:
    "We couldn't find any results matching your search. Please try again.",
} as const;
