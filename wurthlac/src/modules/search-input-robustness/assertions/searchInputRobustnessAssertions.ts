import { expect } from '@playwright/test';
import { INPUT_ROBUSTNESS_BEHAVIOR } from '../data/behavior';
import { type SearchInputRobustnessPage } from '../pages/SearchInputRobustnessPage';

export async function expectSyncedSerp(
  inputPage: SearchInputRobustnessPage,
  query: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          const q =
            new URL(inputPage.page.url()).searchParams.get(
              INPUT_ROBUSTNESS_BEHAVIOR.queryParam,
            ) ?? '';
          if (q !== query) return false;
          const headingVisible = await inputPage
            .resultsHeading(query)
            .isVisible()
            .catch(() => false);
          const emptyVisible = await inputPage
            .noResultsHeading()
            .isVisible()
            .catch(() => false);
          return headingVisible || emptyVisible;
        } catch {
          return false;
        }
      },
      { timeout: INPUT_ROBUSTNESS_BEHAVIOR.uiSettleTimeoutMs },
    )
    .toBeTruthy();
  await expect(inputPage.input()).toHaveValue(query);
}
