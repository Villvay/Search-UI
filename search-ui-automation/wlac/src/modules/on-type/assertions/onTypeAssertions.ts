import { expect, type Locator } from '@playwright/test';
import { ON_TYPE_BEHAVIOR } from '../data/behavior';
import { type OnTypeSearchPage } from '../pages/OnTypeSearchPage';

export async function expectIdleOnTypeState(
  onTypePage: OnTypeSearchPage,
): Promise<void> {
  await expect(onTypePage.resultsColumn()).toBeHidden({
    timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs,
  });
  const compact = (onTypePage.page.viewportSize()?.width ?? 1440) <= 768;
  if (compact) {
    await expect(onTypePage.input()).toBeVisible();
    return;
  }
  await expect
    .poll(
      async () => {
        const recentVisible = await onTypePage
          .recentHeading()
          .first()
          .isVisible()
          .catch(() => false);
        const smarterVisible = await onTypePage
          .smarterBanner()
          .first()
          .isVisible()
          .catch(() => false);
        const trendingVisible = await onTypePage
          .trendingHeading()
          .isVisible()
          .catch(() => false);
        return recentVisible || smarterVisible || trendingVisible;
      },
      { timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs },
    )
    .toBeTruthy();
}

export async function expectActiveOnTypeState(
  onTypePage: OnTypeSearchPage,
): Promise<void> {
  await expect(onTypePage.resultsColumn()).toBeVisible({
    timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export async function expectInputHasValue(
  input: Locator,
  value: string,
): Promise<void> {
  await expect(input).toHaveValue(value);
}

export async function expectResultsReflectQuery(
  onTypePage: OnTypeSearchPage,
  query: string,
): Promise<void> {
  await expectActiveOnTypeState(onTypePage);
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    await expect(onTypePage.resultsColumn()).toBeVisible();
    return;
  }

  await expect
    .poll(
      async () => {
        const text = (await onTypePage.resultsColumn().innerText()).toLowerCase();
        return (
          text.includes(normalized) ||
          text.includes('products for') ||
          text.includes('categories for') ||
          text.includes('no products') ||
          text.includes('no result')
        );
      },
      { timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs },
    )
    .toBeTruthy();
}
