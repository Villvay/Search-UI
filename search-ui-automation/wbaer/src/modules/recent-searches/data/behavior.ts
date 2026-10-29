/**
 * Your Recent Searches — behavior discovered on QA (qa-baersupply.vercel.app).
 *
 * Storage: localStorage key `recentSearches` = JSON string[] (newest first, max 5).
 * Written on Enter submit to SRP; not on type-only or direct URL goto alone.
 */
export const RECENT_SEARCHES_BEHAVIOR = {
  searchPath: '/search',
  queryParam: 'q',
  storageKey: 'recentSearches',
  maxDisplayed: 5,
  /** Index 0 is newest. */
  newestFirst: true,
  /** Re-searching an existing term moves it to index 0. */
  reSearchMovesToFront: true,
  clickAddsRouteParam: false,
  /** Auth User A vs User B not available in this test env. */
  dualAccountTestingSupported: false,
  uiSettleTimeoutMs: 30_000,
} as const;

export const RECENT_SEARCHES_COPY = {
  /** Exact visible h4 label (lowercase “recent”). */
  sectionHeading: 'Your recent searches',
  removeButtonName: (query: string) => `Remove recent search "${query}"`,
} as const;
