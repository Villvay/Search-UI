/**
 * Related Searches was not observed on https://wurthlac.com (2026-10-29).
 * The dropdown uses Products / Catalogs / Resources plus category links.
 * SERP had no Related Searches section. Excluded from smoke/regression.
 */
export const RELATED_SEARCHES_BEHAVIOR = {
  supported: false,
  reason:
    'No Related Searches section on SERP and no query-suggestion chips in the dropdown.',
} as const;
