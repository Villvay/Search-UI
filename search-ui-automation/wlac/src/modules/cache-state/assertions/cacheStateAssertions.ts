import { expect } from '@playwright/test';
import { CACHE_STATE_BEHAVIOR } from '../data/behavior';
import { type CacheStatePage } from '../pages/CacheStatePage';

export async function expectSerpIdentity(
  cache: CacheStatePage,
  query: string,
): Promise<void> {
  await expect(cache.resultsHeading(query)).toBeVisible({
    timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs,
  });
  await expect(cache.input()).toHaveValue(query);
  const q = new URL(cache.page.url()).searchParams.get(CACHE_STATE_BEHAVIOR.queryParam);
  expect(q).toBe(query);
}
