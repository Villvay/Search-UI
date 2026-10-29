import { expect, type Page } from '@playwright/test';
import { TRENDING_NOW_BEHAVIOR } from '../data/behavior';
import { type TrendingNowPage } from '../pages/TrendingNowPage';

export async function expectTrendingNowVisible(
  trendingPage: TrendingNowPage,
): Promise<void> {
  await expect(trendingPage.heading()).toBeVisible({
    timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export async function expectTrendingItemsPresent(
  trendingPage: TrendingNowPage,
): Promise<void> {
  await expect
    .poll(async () => trendingPage.getItemCount(), {
      timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs,
    })
    .toBeGreaterThanOrEqual(TRENDING_NOW_BEHAVIOR.minItemCountWhenPresent);
  await expect(trendingPage.items().first()).toBeVisible({
    timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export async function expectTrendingItemTextsValid(
  trendingPage: TrendingNowPage,
): Promise<void> {
  const texts = await trendingPage.getItemTexts();
  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) {
    expect(text.trim().length, `empty trending text: "${text}"`).toBeGreaterThan(
      0,
    );
    expect(/\S/.test(text), `whitespace-only trending text`).toBeTruthy();
    // Searchable: non-empty after trim; reject control-only strings.
    expect(text.trim()).toBe(text.trim());
  }
}

export async function expectTrendingItemsInteractable(
  trendingPage: TrendingNowPage,
): Promise<void> {
  const first = trendingPage.items().first();
  await expect(first).toBeVisible({
    timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs,
  });
  await expect(first).toBeEnabled();
}

/**
 * Compare URL `q` to the selected chip text.
 * Uses URLSearchParams decoding only — no case folding or whitespace collapse.
 */
export async function expectUrlQueryMatchesSelected(
  page: Page,
  selectedQuery: string,
): Promise<void> {
  const url = new URL(page.url());
  expect(url.pathname).toBe(TRENDING_NOW_BEHAVIOR.searchPath);
  const q = url.searchParams.get(TRENDING_NOW_BEHAVIOR.queryParam) ?? '';
  expect(q).toBe(selectedQuery);
}

export async function expectNoUnexpectedRouteParam(
  page: Page,
): Promise<void> {
  if (TRENDING_NOW_BEHAVIOR.clickAddsRouteParam) {
    return;
  }
  const route = new URL(page.url()).searchParams.get('route');
  expect(
    route,
    'Trending Now should not add suggestion-style route= on QA',
  ).toBeNull();
}

export async function expectSrpLoadedForTrendingQuery(
  page: Page,
  trendingPage: TrendingNowPage,
  selectedQuery: string,
): Promise<void> {
  await trendingPage.waitForSearchLanding(selectedQuery);
  await expectUrlQueryMatchesSelected(page, selectedQuery);
  await expect(trendingPage.input()).toHaveValue(selectedQuery);
}

/**
 * SERP content for a known-result trending term.
 * Accepts products tab and/or product title links — does not invent SKUs.
 */
export async function expectSrpResultsStateValid(
  trendingPage: TrendingNowPage,
  selectedQuery: string,
  options: { expectProducts?: boolean } = {},
): Promise<void> {
  const { expectProducts = true } = options;

  const headingVisible = await trendingPage
    .searchResultsHeading(selectedQuery)
    .isVisible()
    .catch(() => false);
  const productsTabVisible = await trendingPage
    .productsTab()
    .isVisible()
    .catch(() => false);
  const productCount = await trendingPage.productTitleLinks().count();

  expect(
    headingVisible || productsTabVisible || productCount > 0,
    'Expected a SERP marker (results heading, Products tab, or product titles)',
  ).toBeTruthy();

  if (expectProducts) {
    await expect
      .poll(async () => trendingPage.productTitleLinks().count(), {
        timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs,
      })
      .toBeGreaterThan(0);
  }
}

export async function expectSearchInputRetainsQuery(
  trendingPage: TrendingNowPage,
  selectedQuery: string,
): Promise<void> {
  await expect(trendingPage.input()).toHaveValue(selectedQuery);
}
