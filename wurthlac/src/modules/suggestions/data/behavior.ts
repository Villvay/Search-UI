export const SUGGESTIONS_BEHAVIOR = {
  minCharacters: 2,
  debounceMs: 300,
  escapeClosesActiveSuggestions: true,
  uiSettleTimeoutMs: 15_000,
  hasQuerySuggestionChips: false,
  hasResultsColumn: true,
  hasProductPreviews: true,
  hasCategoryLinks: true,
} as const;

export const SUGGESTIONS_COPY = {
  recentHeading: 'Your recent searches',
  smarterBanner: 'Our search bar just got smarter',
  productsHeadingPrefix: 'Products for',
  categoriesHeadingPrefix: 'Categories for',
  tabProducts: 'Products',
  tabCatalogs: 'Catalogs',
  tabResources: 'Resources',
} as const;
