import { expect, type Page } from '@playwright/test';
import { ON_ENTER_BEHAVIOR, ON_ENTER_COPY } from '../data/behavior';
import {
  queriesMatch,
  type OnEnterSearchPage,
} from '../pages/OnEnterSearchPage';

export async function expectSearchUrlContainsQuery(
  page: Page,
  query: string,
): Promise<void> {
  await expect
    .poll(
      () => {
        try {
          const url = new URL(page.url());
          const q = url.searchParams.get(ON_ENTER_BEHAVIOR.queryParam) ?? '';
          return (
            url.pathname === ON_ENTER_BEHAVIOR.searchPath &&
            queriesMatch(q, query)
          );
        } catch {
          return false;
        }
      },
      { timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs },
    )
    .toBeTruthy();
}

export async function expectOnSearchResultsPage(
  onEnter: OnEnterSearchPage,
  query: string,
): Promise<void> {
  await expectSearchUrlContainsQuery(onEnter.page, query);
  await expect(onEnter.searchResultsHeading(query)).toBeVisible({
    timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs,
  });
  await expect(onEnter.input()).toHaveValue(query);
  await expect(onEnter.noResultsHeading()).toHaveCount(0);
}

export async function expectNoResultsPage(
  onEnter: OnEnterSearchPage,
  query: string,
): Promise<void> {
  await expectSearchUrlContainsQuery(onEnter.page, query);
  await onEnter.waitForNoResultsState();
  await expect(onEnter.input()).toHaveValue(query);
  await expect(onEnter.searchResultsHeading(query)).toHaveCount(0);
}

export async function expectNoNavigation(
  page: Page,
  urlBefore: string,
): Promise<void> {
  await expect(page).toHaveURL(urlBefore);
}

export { ON_ENTER_COPY };
