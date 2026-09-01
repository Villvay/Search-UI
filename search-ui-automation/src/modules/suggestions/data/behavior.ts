/**
 * Suggestions/dropdown behavior discovered on Würth Baer Supply QA.
 * Verified via live Playwright inspection (Aug 2026).
 */
export const SUGGESTIONS_BEHAVIOR = {
  minCharacters: 2,
  debounceMs: 300,
  uiSettleTimeoutMs: 20_000,
  /**
   * Suggestion nodes can exist as hidden duplicates in the DOM.
   * Always scope to the visible suggestions column.
   */
  hiddenDuplicateSuggestionNodes: true,
  /**
   * ArrowUp/ArrowDown did not reliably move focus/aria-selected onto
   * suggestion buttons during inspection. Escape closes active suggestion UI.
   * Enter-on-highlighted-suggestion is therefore not automated here.
   */
  arrowKeySuggestionNavigationSupported: false,
  escapeClosesActiveSuggestions: true,
} as const;

export const SUGGESTIONS_COPY = {
  trendingHeading: 'Trending now',
  clearSearchButton: 'Clear search',
  noSuggestions: 'No Suggestions to Display',
  noProductsFound: 'No Products Found',
  categoriesHeading: 'Categories',
  brandsHeading: 'Brands',
} as const;
