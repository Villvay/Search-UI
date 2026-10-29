import { test, expect } from '../../../core/fixtures';
import {
  expectFacetGroupsPresent,
  expectFacetOptionsPresent,
  expectFiltersPanelVisible,
  expectFiltersUrlContains,
  expectOptionSelected,
  expectResultsReflectBrandFilter,
} from '../assertions/filtersFacetsAssertions';
import { FILTERS_FACETS_BEHAVIOR } from '../data/behavior';
import {
  filtersFacetsOptions,
  filtersFacetsQueries,
} from '../data/queries';
import { FiltersFacetsPage } from '../pages/FiltersFacetsPage';

/**
 * FILTERS & FACETS — SERP accordion filters (QA-inspected).
 * Independent of on-type / suggestions / on-enter / related-searches / analytics.
 */
test.describe('Filters and facets @filters @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  test('FILTER-001 @filters @smoke - Filters panel is displayed on SERP', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    await expectFiltersPanelVisible(filtersPage);
  });

  test('FILTER-002 @filters @smoke - Facet groups are displayed', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    await expectFacetGroupsPresent(filtersPage, [
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.categoryFacet,
    ]);
  });

  test('FILTER-003 @filters - Facet values are displayed', async ({ page }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    const options = await expectFacetOptionsPresent(
      filtersPage,
      filtersFacetsOptions.brandFacet,
    );
    expect(
      options.some((o) => o.includes(filtersFacetsOptions.brandPrimary)),
    ).toBeTruthy();
  });

  test('FILTER-004 @filters @smoke - Selecting a filter shows selected state', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectOptionSelected(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
  });

  test('FILTER-005 @filters @smoke - Results update after applying a filter', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    const beforeCount = await filtersPage.getProductsTabCount();
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectFiltersUrlContains(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectResultsReflectBrandFilter(filtersPage, 'Blum', {
      previousTabCount: beforeCount,
      chipLabel: filtersFacetsOptions.brandPrimary,
    });
  });

  test('FILTER-006 @filters - URL filters param updates after filtering', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    const before = filtersPage.getFiltersParamRaw();
    expect(before).toBeNull();

    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectFiltersUrlContains(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );

    const url = new URL(page.url());
    expect(url.pathname).toBe(FILTERS_FACETS_BEHAVIOR.searchPath);
    expect(url.searchParams.get(FILTERS_FACETS_BEHAVIOR.queryParam)).toBe(
      filtersFacetsQueries.filterable.value,
    );
    expect(url.searchParams.get(FILTERS_FACETS_BEHAVIOR.filtersParam)).toContain(
      'Brand',
    );
  });

  test('FILTER-007 @filters - Multiple values within the same facet', async ({
    page,
  }) => {
    test.skip(
      !FILTERS_FACETS_BEHAVIOR.supportsMultiValueSameFacet,
      'Multi-value same facet not supported',
    );
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandSecondary,
    );
    await filtersPage.waitForFiltersState((state) => {
      const values = filtersPage.facetValues(
        state,
        filtersFacetsOptions.brandFacet,
      );
      return (
        values.includes(filtersFacetsOptions.brandPrimary) &&
        values.includes(filtersFacetsOptions.brandSecondary)
      );
    });
    await expectOptionSelected(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectOptionSelected(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandSecondary,
    );
  });

  test('FILTER-008 @filters - Values across multiple facet groups', async ({
    page,
  }) => {
    test.skip(
      !FILTERS_FACETS_BEHAVIOR.supportsCrossFacetSelection,
      'Cross-facet selection not supported',
    );
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.categoryFacet,
      filtersFacetsOptions.categoryPrimary,
    );
    await filtersPage.waitForFiltersState((state) => {
      const brands = filtersPage.facetValues(
        state,
        filtersFacetsOptions.brandFacet,
      );
      const cats = filtersPage.facetValues(
        state,
        filtersFacetsOptions.categoryFacet,
      );
      return (
        brands.includes(filtersFacetsOptions.brandPrimary) &&
        cats.includes(filtersFacetsOptions.categoryPrimary)
      );
    });
  });

  test('FILTER-009 @filters - Selected filters remain after results update', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    const beforeCount = await filtersPage.getProductsTabCount();
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectFiltersUrlContains(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectResultsReflectBrandFilter(filtersPage, 'Blum', {
      previousTabCount: beforeCount,
      chipLabel: filtersFacetsOptions.brandPrimary,
    });
    await expectOptionSelected(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
  });

  test('FILTER-010 @filters - Clear an individual selected filter', async ({
    page,
  }) => {
    test.skip(
      !FILTERS_FACETS_BEHAVIOR.supportsIndividualClear,
      'Individual clear not supported',
    );
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectFiltersUrlContains(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await filtersPage.filters.deselectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await filtersPage.waitForFiltersCleared();
  });

  test('FILTER-011 @filters - Clear all filters', async ({ page }) => {
    test.skip(
      !FILTERS_FACETS_BEHAVIOR.supportsClearAll,
      'Clear all not supported',
    );
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandSecondary,
    );
    await filtersPage.filters.clearAll();
    await filtersPage.waitForFiltersCleared();
  });

  test('FILTER-012 @filters - Results return to unfiltered state after clear', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);

    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectFiltersUrlContains(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );

    await filtersPage.filters.clearAll();
    await filtersPage.waitForFiltersCleared();

    await expect
      .poll(async () => filtersPage.getProductCount(), {
        timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs,
      })
      .toBeGreaterThan(0);
    expect(filtersPage.getFiltersParamRaw()).toBeNull();
  });

  test('FILTER-013 @filters - No-result filter combination', async ({
    page,
  }, testInfo) => {
    // No deterministic empty-state Brand+Category pair on QA without inventing filters.
    testInfo.skip(
      true,
      'No reliable no-result facet combination on QA without inventing filter values',
    );
  });

  test('FILTER-014 @filters - Filter state persists after refresh', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filtersFacetsQueries.filterable.value);
    await filtersPage.filters.selectOption(
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectFiltersUrlContains(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await filtersPage.filters.ensureVisible();
    await expectFiltersUrlContains(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
    await expectOptionSelected(
      filtersPage,
      filtersFacetsOptions.brandFacet,
      filtersFacetsOptions.brandPrimary,
    );
  });

  test('FILTER-015 @filters - Browser Back restores previous filter state', async ({
    page,
  }, testInfo) => {
    // QA filter toggles update the URL via history.replaceState (history.length
    // does not increase). Browser Back therefore does not restore the prior
    // unfiltered SERP from an in-page filter change.
    testInfo.skip(
      true,
      'Filters use replaceState on QA — Back does not restore prior filter/search state',
    );
  });
});
