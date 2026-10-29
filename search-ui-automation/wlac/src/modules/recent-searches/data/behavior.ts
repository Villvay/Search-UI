export const RECENT_SEARCHES_BEHAVIOR = {
  searchPath: '/search',
  queryParam: 'q',
  storageKey: 'recentSearches',
  maxDisplayed: 5,
  newestFirst: true,
  reSearchMovesToFront: true,
  clickAddsRouteParam: false,
  dualAccountTestingSupported: false,
  uiSettleTimeoutMs: 30_000,
} as const;

export const RECENT_SEARCHES_COPY = {
  sectionHeading: 'Your recent searches',
  removeButtonName: (query: string) => `Remove recent search "${query}"`,
} as const;
