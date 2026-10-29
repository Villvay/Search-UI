import { expect } from '@playwright/test';
import { FILTERS_FACETS_BEHAVIOR } from '../data/behavior';
import { type FiltersFacetsPage } from '../pages/FiltersFacetsPage';

export async function expectFiltersPanelVisible(
  filtersPage: FiltersFacetsPage,
): Promise<void> {
  await filtersPage.filters.ensureVisible();
  await expect(filtersPage.filters.panelHeading()).toBeVisible({
    timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export async function expectFilterInUrl(
  filtersPage: FiltersFacetsPage,
  facet: string,
  value: string,
): Promise<void> {
  await expect
    .poll(
      () => {
        const state = filtersPage.getFiltersState();
        if (!state) return false;
        const current = state[facet];
        if (Array.isArray(current)) return current.includes(value);
        return current === value;
      },
      { timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs },
    )
    .toBeTruthy();
}
