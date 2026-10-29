/**
 * Search Input Robustness — QA-inspected contracts (qa-baersupply.vercel.app).
 * Labels: OBSERVED | EXPECTED | UNKNOWN | NOT TESTABLE
 */
export const SEARCH_INPUT_ROBUSTNESS_BEHAVIOR = {
  searchPath: '/search',
  queryParam: 'q',
  homePath: '/',
  uiSettleTimeoutMs: 30_000,
  /** Empty Enter: no navigation (matches ON-ENTER). OBSERVED */
  emptyEnterNavigates: false,
  /** Whitespace-only Enter navigates to SERP with preserved spaces. OBSERVED */
  whitespaceOnlyNavigates: true,
  /** Leading/trailing/internal whitespace preserved in input and q. OBSERVED */
  trimsWhitespace: false,
  /** No HTML maxlength; accepts ≥2000 chars on fresh page. OBSERVED */
  htmlMaxLength: null as number | null,
  /** Long inputs tested up to this length without truncation. OBSERVED */
  observedAcceptedLongLength: 2000,
  /** Typed percent-sequences stay literal (URL double-encodes). OBSERVED */
  typedEncodedStaysLiteral: true,
  /** HTML/JS-like strings stay text; no dialogs in inspection. OBSERVED */
  treatsMarkupAsText: true,
  searchApiHostFragment: 'search-villvay.workers.dev',
} as const;

export const SEARCH_INPUT_ROBUSTNESS_COPY = {
  searchResultsHeadingPrefix: 'Search Results for',
  noResultsHeading: 'No Results',
  trendingHeading: 'Trending now',
  clearSearch: 'Clear search',
} as const;
