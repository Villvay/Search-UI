import { expect, type Page } from '@playwright/test';
import { RECENT_SEARCHES_BEHAVIOR } from '../data/behavior';
import { type RecentSearchesPage } from '../pages/RecentSearchesPage';

export async function expectRecentSearchesVisible(
  recentPage: RecentSearchesPage,
): Promise<void> {
  await expect(recentPage.recentSearches.heading()).toBeVisible({
    timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export async function expectRecentSearchesAbsent(
  recentPage: RecentSearchesPage,
): Promise<void> {
  await expect(recentPage.recentSearches.heading()).toHaveCount(0);
}

export async function expectRecentQueriesDisplayed(
  recentPage: RecentSearchesPage,
  expectedQueries: string[],
): Promise<void> {
  const texts = await recentPage.recentSearches.getQueryTexts();
  for (const q of expectedQueries) {
    expect(texts, `expected recent query "${q}" in ${JSON.stringify(texts)}`).toContain(
      q,
    );
  }
}

export async function expectRecentCountAtMost(
  recentPage: RecentSearchesPage,
  max: number,
): Promise<void> {
  const count = await recentPage.recentSearches.getItemCount();
  expect(count).toBeLessThanOrEqual(max);
}

export async function expectRecentCountExactly(
  recentPage: RecentSearchesPage,
  expected: number,
): Promise<void> {
  await expect
    .poll(async () => recentPage.recentSearches.getItemCount(), {
      timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
    })
    .toBe(expected);
}

export async function expectRecentOrderNewestFirst(
  recentPage: RecentSearchesPage,
  expectedNewestFirst: string[],
): Promise<void> {
  const texts = await recentPage.recentSearches.getQueryTexts();
  expect(texts).toEqual(expectedNewestFirst);
}

export async function expectUrlQueryMatchesSelected(
  page: Page,
  selectedQuery: string,
): Promise<void> {
  const url = new URL(page.url());
  expect(url.pathname).toBe(RECENT_SEARCHES_BEHAVIOR.searchPath);
  const q = url.searchParams.get(RECENT_SEARCHES_BEHAVIOR.queryParam) ?? '';
  expect(q).toBe(selectedQuery);
}

export async function expectSrpLoadedForRecentQuery(
  page: Page,
  recentPage: RecentSearchesPage,
  selectedQuery: string,
): Promise<void> {
  await recentPage.waitForSearchLanding(selectedQuery);
  await expectUrlQueryMatchesSelected(page, selectedQuery);
  await expect(recentPage.input()).toHaveValue(selectedQuery);
}

export async function expectRecentQueryRemoved(
  recentPage: RecentSearchesPage,
  removedQuery: string,
  remainingQueries: string[],
): Promise<void> {
  await expect(recentPage.recentSearches.queryButton(removedQuery)).toHaveCount(
    0,
  );
  const texts = await recentPage.recentSearches.getQueryTexts();
  expect(texts).not.toContain(removedQuery);
  for (const q of remainingQueries) {
    expect(texts).toContain(q);
  }
}

export async function expectDropdownStillUsable(
  recentPage: RecentSearchesPage,
): Promise<void> {
  expect(await recentPage.dropdown.isVisible()).toBeTruthy();
  await expect(recentPage.recentSearches.heading()).toBeVisible({
    timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
  });
}
