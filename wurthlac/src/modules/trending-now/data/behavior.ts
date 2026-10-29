/**
 * Trending Now was not observed on https://wurthlac.com (2026-10-29).
 * Idle dropdown showed recent searches and “Our search bar just got smarter”.
 * This module is documented as not applicable and is excluded from smoke/regression.
 */
export const TRENDING_NOW_BEHAVIOR = {
  supported: false,
  reason:
    'No “Trending now” heading or trending chips were present in the inspected idle dropdown on wurthlac.com.',
} as const;
