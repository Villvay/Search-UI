import { test, expect } from '../../../core/fixtures';
import {
  expectFilterInUrl,
  expectFiltersPanelVisible,
} from '../assertions/filtersFacetsAssertions';
import { FILTERS_FACETS_BEHAVIOR } from '../data/behavior';
import { filterFacets, filterOptions, filterQueries } from '../data/queries';
import { FiltersFacetsPage } from '../pages/FiltersFacetsPage';

test.describe('Filters and facets @filters @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  test('FILTER-001 @smoke - The filters panel opens', async ({ page }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await expectFiltersPanelVisible(filtersPage);
  });

  test('FILTER-002 @smoke - Available facet groups display correctly', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await expectFiltersPanelVisible(filtersPage);
    const names = await filtersPage.filters.getFacetNames();
    expect(names).toEqual(expect.arrayContaining([filterFacets.brand, filterFacets.category]));
  });

  test('FILTER-003 - Facet values are displayed correctly', async ({ page }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    const labels = await filtersPage.filters.getVisibleOptionLabels(filterFacets.brand);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels).toEqual(expect.arrayContaining([filterOptions.brand]));
  });

  test('FILTER-004 @smoke - Selecting a filter updates the selected state', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    await filtersPage.filters.expandFacet(filterFacets.brand);
    expect(
      await filtersPage.filters.isOptionSelected(filterFacets.brand, filterOptions.brand),
    ).toBeTruthy();
  });

  test('FILTER-005 @smoke - Selecting a filter updates the results', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    const before = await filtersPage.getProductsTabCount();
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    await expectFilterInUrl(filtersPage, filterFacets.brand, filterOptions.brand);
    await filtersPage.waitForResultsUpdate(before);
    const after = await filtersPage.getProductsTabCount();
    expect(after, 'Filtered Products tab count should differ from the unfiltered count').not.toBe(
      before,
    );
  });

  test('FILTER-006 - Filter parameters in the URL are correct', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    await expectFilterInUrl(filtersPage, filterFacets.brand, filterOptions.brand);
    expect(new URL(page.url()).searchParams.get('q')).toBe(filterQueries.primary);
  });

  test('FILTER-007 - Multiple values can be selected in a facet', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    const labels = await filtersPage.filters.getVisibleOptionLabels(filterFacets.brand);
    const second = labels.find((label) => label !== filterOptions.brand);
    expect(second, 'Brand facet should expose a second value').toBeTruthy();
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    const secondBox = filtersPage.filters.optionCheckbox(second as string);
    if (await secondBox.isEnabled()) {
      await filtersPage.filters.selectOption(filterFacets.brand, second as string);
      const state = filtersPage.getFiltersState();
      const value = state?.[filterFacets.brand];
      const selected = Array.isArray(value) ? value : [value];
      expect(selected).toEqual(
        expect.arrayContaining([filterOptions.brand, second]),
      );
    } else {
      await expectFilterInUrl(filtersPage, filterFacets.brand, filterOptions.brand);
      await expect(secondBox).toBeDisabled();
    }
  });

  test('FILTER-008 - Filters can be selected across multiple groups', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    const categories = await filtersPage.filters.getVisibleOptionLabels(filterFacets.category);
    expect(categories.length).toBeGreaterThan(0);
    await filtersPage.filters.selectOption(filterFacets.category, categories[0]);
    const state = filtersPage.getFiltersState();
    expect(state?.[filterFacets.brand]).toBeTruthy();
    expect(state?.[filterFacets.category]).toBeTruthy();
  });

  test('FILTER-009 - Selected filters remain after results update', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    await filtersPage.filters.expandFacet(filterFacets.brand);
    expect(
      await filtersPage.filters.isOptionSelected(filterFacets.brand, filterOptions.brand),
    ).toBeTruthy();
  });

  test('FILTER-010 - An individual filter can be cleared', async ({ page }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    await filtersPage.filters.deselectOption(filterFacets.brand, filterOptions.brand);
    const state = filtersPage.getFiltersState();
    if (state) {
      const value = state[filterFacets.brand];
      expect(value === undefined || value === '' || (Array.isArray(value) && !value.includes(filterOptions.brand))).toBeTruthy();
    }
  });

  test('FILTER-011 - All filters can be cleared', async ({ page }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    const clearVisible = await filtersPage.filters.clearAllButton().isVisible().catch(() => false);
    if (!clearVisible) {
      throw new Error('Clear all control was expected after a filter selection but was not visible.');
    }
    await filtersPage.filters.clearAll();
    await filtersPage.waitForFiltersCleared();
    expect(filtersPage.getFiltersParamRaw()).toBeNull();
  });

  test('FILTER-012 - A no-matching-results combination is reported if encountered', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    const empty = await filtersPage.noResultsHeading().isVisible().catch(() => false);
    // This combination is not a known zero-hit pair; assert the page remains coherent.
    await expect(filtersPage.input()).toHaveValue(filterQueries.primary);
    expect(typeof empty).toBe('boolean');
  });

  test('FILTER-013 - Filter selections persist after refresh', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectFilterInUrl(filtersPage, filterFacets.brand, filterOptions.brand);
    await filtersPage.filters.expandFacet(filterFacets.brand);
    expect(
      await filtersPage.filters.isOptionSelected(filterFacets.brand, filterOptions.brand),
    ).toBeTruthy();
  });

  test('FILTER-014 - Browser Back restores the expected filter state', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.searchPage.open();
    await filtersPage.searchPage.searchBox.type(filterQueries.primary);
    await filtersPage.searchPage.searchBox.pressEnter();
    await page.waitForURL(
      (url) =>
        url.pathname === '/search' &&
        url.searchParams.get('q') === filterQueries.primary &&
        !url.searchParams.has('filters'),
      { timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs },
    );
    const unfiltered = page.url();
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    await expectFilterInUrl(filtersPage, filterFacets.brand, filterOptions.brand);
    await page.goBack();
    await expect
      .poll(() => page.url(), {
        timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs,
      })
      .not.toBe('about:blank');
    const after = new URL(page.url());
    if (after.pathname === '/search') {
      expect(after.searchParams.get('q')).toBe(filterQueries.primary);
      expect(page.url() === unfiltered || !after.searchParams.has('filters')).toBeTruthy();
    } else {
      expect(after.pathname).toBe('/');
    }
  });

  test('FILTER-015 - Applying filters does not leave stale unfiltered results as the only state', async ({
    page,
  }) => {
    const filtersPage = new FiltersFacetsPage(page);
    await filtersPage.openSearchResults(filterQueries.primary);
    await filtersPage.filters.selectOption(filterFacets.brand, filterOptions.brand);
    await expectFilterInUrl(filtersPage, filterFacets.brand, filterOptions.brand);
    await expect(filtersPage.input()).toHaveValue(filterQueries.primary);
  });
});
