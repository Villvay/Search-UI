/**
 * Stable search locators for the Würth LAC header.
 * Inspected on https://wurthlac.com/ (2026-10-29).
 *
 * Role and accessible name are preferred. `input[name="query"]` is the
 * attribute fallback used when the header field is already on screen.
 */
export const SEARCH_SELECTORS = {
  inputRole: 'textbox' as const,
  inputAccessibleName: 'What are you looking for?',
  inputPlaceholder: 'What are you looking for?',
  inputNameAttr: 'query',
  openSearchButtonName: 'Search',
  clearSearchButtonName: 'Clear search',
  imageSearchButtonName: 'Open image search',
  barcodeScannerButtonName: 'Open barcode scanner',
};
