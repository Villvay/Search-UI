/**
 * On-type behavior discovered on Würth Baer Supply QA
 * (https://qa-baersupply.vercel.app) via live Playwright inspection.
 *
 * Source of truth for Step 2 assertions — not product requirements docs.
 */
export const ON_TYPE_BEHAVIOR = {
  /**
   * Autocomplete / suggestion columns start after this many characters.
   * Confirmed: 1 char keeps idle/trending; 2+ chars fetches /suggestions.
   * Matches WBS SearchProvider config minCharacters: 2.
   */
  minCharacters: 2,

  /**
   * Client debounce before suggestion fetch (ms).
   * Confirmed in WBS search-bar-content (debounceLength: 300).
   */
  debounceMs: 300,

  /**
   * Focused empty (or below-threshold) input shows the idle dropdown
   * with a "Trending now" heading. Suggestion columns are absent.
   */
  idleShowsTrending: true,

  /**
   * At/above minCharacters, the dropdown shows autocomplete columns:
   * [data-search-column="suggestions"] and often [data-search-column="results"].
   */
  activeShowsSuggestionColumn: true,

  /**
   * Clearing the input while focused returns to the idle/trending state
   * and removes suggestion/result columns.
   */
  clearResetsToIdle: true,

  /**
   * Desktop and mobile use the same search input component/DOM contract.
   * Narrow layouts may still require opening search via the Search button.
   */
  sameComponentAcrossViewports: true,

  /**
   * A transient loading indicator was not reliably observed as a stable
   * user-visible state suitable for assertions.
   */
  loadingStateReliablyObservable: false,

  /** Max wait for network-backed on-type UI to settle. */
  uiSettleTimeoutMs: 15_000,
} as const;

export const ON_TYPE_COPY = {
  trendingHeading: 'Trending now',
  clearSearchButton: 'Clear search',
  noSuggestions: 'No Suggestions to Display',
  noProductsFound: 'No Products Found',
} as const;

export const ON_TYPE_SELECTORS = {
  suggestionsColumn: '[data-search-column="suggestions"]',
  resultsColumn: '[data-search-column="results"]',
  suggestionItem: '[data-search-suggestion]',
} as const;
