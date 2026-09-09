/**
 * Related Searches constants — dropdown-only surface on QA.
 */
export const RELATED_SEARCHES_BEHAVIOR = {
  /** Related Searches live in the suggestions dropdown, not on SERP. */
  presentInSuggestionsDropdown: true,
  presentOnSerp: false,
  searchPath: '/search',
  queryParam: 'q',
  minCharacters: 2,
  /** Suggestion click typically adds a PLP route filter. */
  clickMayAddRouteParam: true,
  minItemCountWhenPresent: 1,
  uiSettleTimeoutMs: 30_000,
} as const;

export const RELATED_SEARCHES_COPY = {
  noSuggestions: 'No Suggestions to Display',
  /** SERP heading that must NOT be treated as Related Searches. */
  serpRelatedHeadingPattern: /Related Searches?/i,
} as const;
