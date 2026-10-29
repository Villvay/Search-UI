/**
 * On-type behavior discovered on Würth LAC (https://wurthlac.com) via live inspection.
 */
export const ON_TYPE_BEHAVIOR = {
  /**
   * Results column was present for "hinge" (5 chars). One-character input
   * stayed on the idle dropdown. Treat 2 as the activation threshold, matching
   * the shared search-bar contract; ON-TYPE-001 asserts this.
   */
  minCharacters: 2,
  debounceMs: 300,
  idleShowsTrending: false,
  idleShowsRecentOrSmarterBanner: true,
  activeShowsResultsColumn: true,
  activeShowsSuggestionColumn: false,
  clearResetsToIdle: true,
  sameComponentAcrossViewports: true,
  loadingStateReliablyObservable: false,
  uiSettleTimeoutMs: 15_000,
} as const;

export const ON_TYPE_COPY = {
  recentHeading: 'Your recent searches',
  smarterBanner: 'Our search bar just got smarter',
  trendingHeading: 'Trending now',
  clearSearchButton: 'Clear search',
  productsHeadingPrefix: 'Products for',
  categoriesHeadingPrefix: 'Categories for',
} as const;
