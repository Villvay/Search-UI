import { expect, type Locator } from '@playwright/test';
import {
  ON_TYPE_BEHAVIOR,
  ON_TYPE_COPY,
} from '../data/behavior';
import { type OnTypeSearchPage } from '../pages/OnTypeSearchPage';

/**
 * User-visible on-type state assertions.
 * Intentionally avoids suggestion ranking / exact item lists.
 */
export async function expectIdleOnTypeState(
  onTypePage: OnTypeSearchPage,
): Promise<void> {
  await expect(onTypePage.trendingHeading()).toBeVisible({
    timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs,
  });
  await expect(onTypePage.suggestionsColumn()).toBeHidden();
  await expect(onTypePage.resultsColumn()).toBeHidden();
}

export async function expectActiveOnTypeState(
  onTypePage: OnTypeSearchPage,
): Promise<void> {
  await expect(onTypePage.suggestionsColumn()).toBeVisible({
    timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs,
  });
  await expect(onTypePage.trendingHeading()).toBeHidden();
}

export async function expectInputHasValue(
  input: Locator,
  value: string,
): Promise<void> {
  await expect(input).toHaveValue(value);
}

export async function expectSuggestionsReflectQuery(
  onTypePage: OnTypeSearchPage,
  query: string,
): Promise<void> {
  const column = onTypePage.suggestionsColumn();
  await expect(column).toBeVisible({
    timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs,
  });

  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    // Whitespace-only still opens columns; content may be empty-state copy.
    await expect(column).toBeVisible();
    return;
  }

  // Soft relevance check: either empty-state messaging or text related to query.
  // Exact suggestion lists belong to the SUGGESTIONS module.
  await expect
    .poll(
      async () => {
        const text = (await column.innerText()).toLowerCase();
        return (
          text.includes(normalized) ||
          text.includes(ON_TYPE_COPY.noSuggestions.toLowerCase())
        );
      },
      { timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs },
    )
    .toBeTruthy();
}

export async function expectNoResultOnTypeMessaging(
  onTypePage: OnTypeSearchPage,
): Promise<void> {
  await expectActiveOnTypeState(onTypePage);
  await expect(
    onTypePage.page.getByText(ON_TYPE_COPY.noSuggestions, { exact: true }),
  ).toBeVisible({ timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs });
}
