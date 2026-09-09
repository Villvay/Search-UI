import { expect } from '@playwright/test';
import { productTitleMatchesQuery } from '../../../core/utils/analyticsProductTitle';
import { ON_ENTER_BEHAVIOR } from '../data/behavior';
import { type OnEnterSearchPage } from '../pages/OnEnterSearchPage';

const SERP_PRODUCT_SAMPLE_SIZE = 10;

/**
 * Analytics ON-ENTER: SERP must have products and the first N titles must match the query.
 */
export async function expectSerpProductsMatchAnalyticsQuery(
  onEnter: OnEnterSearchPage,
  query: string,
  sampleSize = SERP_PRODUCT_SAMPLE_SIZE,
): Promise<{ productCount: number; titles: string[] }> {
  const noResults = await onEnter.hasNoResultsState();
  expect(
    noResults,
    'Expected search results with products, but No Results state was shown',
  ).toBeFalsy();

  const titles = await onEnter.getSerpProductTitles(sampleSize);
  expect(
    titles.length,
    `Expected at least 1 product on SERP for analytics query "${query}"`,
  ).toBeGreaterThan(0);

  const checkCount = Math.min(sampleSize, titles.length);
  expect(
    checkCount,
    `Expected at least 1 SERP product title to validate (query: "${query}")`,
  ).toBeGreaterThan(0);

  for (let i = 0; i < checkCount; i += 1) {
    const title = titles[i];
    expect(
      productTitleMatchesQuery(title, query),
      `SERP product #${i + 1} title must include query "${query}". Got: "${title}"`,
    ).toBeTruthy();
  }

  await expect(onEnter.productsTab()).toBeVisible({
    timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs,
  });

  return { productCount: titles.length, titles };
}
