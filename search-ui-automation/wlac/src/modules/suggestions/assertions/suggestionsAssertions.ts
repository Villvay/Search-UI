import { expect } from '@playwright/test';
import { SUGGESTIONS_BEHAVIOR } from '../data/behavior';
import { type SuggestionsPage } from '../pages/SuggestionsPage';

export async function expectIdleSuggestions(page: SuggestionsPage): Promise<void> {
  await expect(page.dropdown.resultsColumn()).toBeHidden({
    timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
  });
  const compact = (page.page.viewportSize()?.width ?? 1440) <= 768;
  if (compact) {
    await expect(page.input()).toBeVisible();
    await expect(page.input()).toBeFocused();
    return;
  }
  await expect
    .poll(
      async () => {
        const recent = await page.dropdown
          .recentHeading()
          .first()
          .isVisible()
          .catch(() => false);
        const smarter = await page.dropdown
          .smarterBanner()
          .first()
          .isVisible()
          .catch(() => false);
        return recent || smarter;
      },
      { timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs },
    )
    .toBeTruthy();
}

export async function expectActiveResults(page: SuggestionsPage): Promise<void> {
  await expect(page.dropdown.resultsColumn()).toBeVisible({
    timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export async function expectResultsMentionQuery(
  page: SuggestionsPage,
  query: string,
): Promise<void> {
  await expectActiveResults(page);
  const text = (await page.dropdown.resultsColumn().innerText()).toLowerCase();
  expect(text).toContain(query.trim().toLowerCase());
}
