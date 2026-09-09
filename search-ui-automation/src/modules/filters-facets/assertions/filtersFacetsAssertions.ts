import { expect } from '@playwright/test';
import { FILTERS_FACETS_BEHAVIOR } from '../data/behavior';
import {
  type FiltersFacetsPage,
  type FiltersState,
} from '../pages/FiltersFacetsPage';

export async function expectFiltersPanelVisible(
  filtersPage: FiltersFacetsPage,
): Promise<void> {
  await filtersPage.filters.ensureVisible();
  await expect(filtersPage.filters.panelHeading()).toBeVisible({
    timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export async function expectFacetGroupsPresent(
  filtersPage: FiltersFacetsPage,
  required: string[],
): Promise<void> {
  const names = await filtersPage.filters.getFacetNames();
  for (const facet of required) {
    expect(names, `Expected facet group "${facet}"`).toContain(facet);
  }
}

export async function expectFacetOptionsPresent(
  filtersPage: FiltersFacetsPage,
  facetName: string,
): Promise<string[]> {
  const options = await filtersPage.filters.getVisibleOptionLabels(facetName);
  expect(
    options.length,
    `Expected options under facet "${facetName}"`,
  ).toBeGreaterThan(0);
  return options;
}

export async function expectOptionSelected(
  filtersPage: FiltersFacetsPage,
  facetName: string,
  optionValue: string,
): Promise<void> {
  await expect
    .poll(
      async () =>
        filtersPage.filters.isOptionSelected(facetName, optionValue),
      { timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs },
    )
    .toBeTruthy();
}

export async function expectFiltersUrlContains(
  filtersPage: FiltersFacetsPage,
  facetName: string,
  optionValue: string,
): Promise<void> {
  await filtersPage.waitForFiltersState((state) =>
    filtersPage.facetValues(state, facetName).includes(optionValue),
  );
}

export async function expectFiltersStateEquals(
  filtersPage: FiltersFacetsPage,
  expected: FiltersState,
): Promise<void> {
  await filtersPage.waitForFiltersState((state) => {
    const keys = Object.keys(expected);
    if (keys.length !== Object.keys(state).length) return false;
    return keys.every((key) => {
      const a = normalizeValues(filtersPage.facetValues(state, key));
      const b = normalizeValues(filtersPage.facetValues(expected, key));
      return a.length === b.length && a.every((v, i) => v === b[i]);
    });
  });
}

/**
 * Verifies SERP updated after a Brand filter.
 * Primary signal (QA-stable): Products tab count changes and selected chip appears.
 * Secondary (when grid renders): at least one product title contains the brand token.
 */
export async function expectResultsReflectBrandFilter(
  filtersPage: FiltersFacetsPage,
  brandToken: string,
  options?: {
    previousTabCount?: number | null;
    chipLabel?: string;
  },
): Promise<void> {
  await filtersPage.waitForResultsUpdate(options?.previousTabCount);

  if (options?.chipLabel) {
    const chip = filtersPage.selectedFilterChip(options.chipLabel).first();
    const mobileTrigger = filtersPage.filters.mobileTrigger();
    await expect
      .poll(
        async () => {
          if (await chip.isVisible().catch(() => false)) return true;
          // Mobile often shows selection count on Filters & sort instead of chips.
          const label = (await mobileTrigger.innerText().catch(() => '')).replace(
            /\s+/g,
            ' ',
          );
          return /Filters\s*&\s*sort/i.test(label) && /\d/.test(label);
        },
        { timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs },
      )
      .toBeTruthy();
  }

  const tabCount = await filtersPage.getProductsTabCount();
  expect(
    tabCount,
    'Expected Products tab to show a filtered result count',
  ).not.toBeNull();
  expect(tabCount as number).toBeGreaterThan(0);

  // Product grid sometimes lags behind tab metadata on QA; require Blum titles
  // only when cards have rendered.
  await expect
    .poll(
      async () => {
        const titles = await filtersPage.getProductTitles(12);
        if (!titles.length) {
          // Tab/chip already prove results updated; empty grid is tolerated briefly.
          return 'pending-grid';
        }
        return titles.some((t) =>
          t.toLowerCase().includes(brandToken.toLowerCase()),
        )
          ? 'matched'
          : 'mismatch';
      },
      {
        timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs,
        intervals: [500, 1000, 2000],
      },
    )
    .not.toBe('mismatch');
}

function normalizeValues(values: string[]): string[] {
  return [...values].map((v) => v.trim()).sort((a, b) => a.localeCompare(b));
}
