/**
 * Selector decisions for Step 1 (framework foundation).
 *
 * Inspected target: Würth Baer Supply QA — https://qa-baersupply.vercel.app
 *
 * Preference order applied:
 * 1. data-testid / data-test — NOT available on the search input
 * 2. accessible role/name — USED (stable placeholder-backed accessible name)
 * 3. stable semantic attributes — name="query" exists as secondary fallback
 * 4. CSS / XPath — avoided for the search input
 *
 * Observations:
 * - Search input placeholder / accessible name: "What are you looking for?"
 * - Desktop layout can render more than one matching textbox; use .first()
 * - On some narrower layouts a header "Search" button may reveal the input
 * - Search dropdown / data-search-* attributes appear after focus (not Step 1)
 * - Auth is optional for basic search input interaction ("Sign in / Register")
 * - No blocking cookie/consent dialog observed during inspection
 */

export const SEARCH_SELECTORS = {
  /** Accessible role used with getByRole. */
  inputRole: 'textbox' as const,
  /** Accessible name derived from the input placeholder. */
  inputAccessibleName: 'What are you looking for?',
  /**
   * Secondary semantic attribute observed on the live input.
   * Prefer role/name; keep as documented fallback only.
   */
  inputNameAttr: 'query',
  /** Mobile/header control that may reveal the search field. */
  openSearchButtonName: 'Search',
} as const;
