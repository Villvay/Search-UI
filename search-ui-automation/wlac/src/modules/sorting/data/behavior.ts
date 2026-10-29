/**
 * Sorting was not present on wurthlac.com SERP during inspection (2026-10-29).
 * SORT-001 documents that absence. Remaining cases run only if UI ships.
 */
export const SORTING_BEHAVIOR = {
  sortingUiPresent: false,
  urlSortParam: null as string | null,
  discoveredOptions: [] as string[],
  defaultOption: null as string | null,
  uiSettleTimeoutMs: 15_000,
} as const;
