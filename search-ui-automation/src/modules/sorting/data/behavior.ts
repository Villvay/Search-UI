/**
 * Sorting — behavior discovered on QA SERP (qa-baersupply.vercel.app).
 *
 * Inspected 2026-09-02 across desktop-1440, tablet-768, mobile-390.
 * See reports/sorting-inspect.json and reports/sorting-inspect-deep.json.
 */
export const SORTING_BEHAVIOR = {
  searchPath: '/search',
  queryParam: 'q',
  /**
   * No dedicated sorting control (dropdown/select/menu/buttons) is rendered
   * on the Products SERP for desktop, tablet, or mobile.
   */
  sortingUiPresent: false,
  /** No Apply button — N/A while sorting UI is absent. */
  appliesImmediately: null as boolean | null,
  /** No sort query-param contract observed via UI (manual ?sort= is ignored by order). */
  urlSortParam: null as string | null,
  discoveredOptions: [] as readonly string[],
  defaultOption: null as string | null,
  /**
   * Mobile trigger is labeled "Filters & sort" but the drawer contains only
   * the Filters accordion — no Sort section or options.
   */
  mobileCombinedFiltersAndSortLabel: true,
  mobileDrawerContainsSortUi: false,
  uiSettleTimeoutMs: 30_000,
} as const;

export const SORTING_COPY = {
  searchResultsHeadingPrefix: 'Search Results for',
  mobileFiltersAndSort: /Filters\s*&\s*sort/i,
} as const;

/** Shared skip reason when UI is not shipped on QA. */
export const SORTING_UNSUPPORTED_REASON =
  'QA SERP does not expose a sorting control (desktop/tablet/mobile). See BEHAVIOR.md.';
