import { test, expect } from '../../../core/fixtures';
import {
  expectSortingControlAbsent,
  expectSortingControlVisible,
  expectSortingOptionsMatch,
  expectSelectedSort,
} from '../assertions/sortingAssertions';
import {
  SORTING_BEHAVIOR,
  SORTING_UNSUPPORTED_REASON,
} from '../data/behavior';
import { sortingQueries } from '../data/queries';
import { SortingPage } from '../pages/SortingPage';

/**
 * SORTING — SERP sort control (QA-inspected).
 * Independent of filters-facets / on-type / suggestions / on-enter / analytics.
 *
 * Current QA: no dedicated sorting UI. SORT-001 documents that absence;
 * SORT-002…SORT-013 skip until `SORTING_BEHAVIOR.sortingUiPresent` is true.
 */
test.describe('Sorting @sorting @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  test('SORT-001 @sorting @smoke - Sorting control visibility on SERP', async ({
    page,
  }, testInfo) => {
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary.value);

    if (!SORTING_BEHAVIOR.sortingUiPresent) {
      // Documented QA contract: no dedicated Sort control.
      await expectSortingControlAbsent(sortingPage);
      testInfo.annotations.push({
        type: 'note',
        description:
          'EXPECTED PRODUCT BEHAVIOR / UNSUPPORTED FEATURE: no sorting control on QA SERP. Mobile "Filters & sort" is filters-only.',
      });
      return;
    }

    await expectSortingControlVisible(sortingPage);
  });

  test('SORT-002 @sorting - Available sorting options', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      !SORTING_BEHAVIOR.sortingUiPresent,
      SORTING_UNSUPPORTED_REASON,
    );
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary.value);
    await expectSortingOptionsMatch(
      sortingPage,
      SORTING_BEHAVIOR.discoveredOptions,
    );
  });

  test('SORT-003 @sorting - Default sorting state', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      !SORTING_BEHAVIOR.sortingUiPresent || !SORTING_BEHAVIOR.defaultOption,
      !SORTING_BEHAVIOR.sortingUiPresent
        ? SORTING_UNSUPPORTED_REASON
        : 'No meaningful default sort label exposed on QA',
    );
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary.value);
    await expectSelectedSort(
      sortingPage,
      SORTING_BEHAVIOR.defaultOption as string,
    );
  });

  test('SORT-004 @sorting - Select a sorting option', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      !SORTING_BEHAVIOR.sortingUiPresent ||
        SORTING_BEHAVIOR.discoveredOptions.length === 0,
      SORTING_UNSUPPORTED_REASON,
    );
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary.value);
    const option = SORTING_BEHAVIOR.discoveredOptions[0];
    await sortingPage.sorting.selectOption(option);
    await expectSelectedSort(sortingPage, option);
  });

  test('SORT-005 @sorting - Results update after sorting', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      !SORTING_BEHAVIOR.sortingUiPresent ||
        SORTING_BEHAVIOR.discoveredOptions.length === 0,
      SORTING_UNSUPPORTED_REASON,
    );
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary.value);
    const before = await sortingPage.getProductTitles(8);
    const option =
      SORTING_BEHAVIOR.discoveredOptions.find((o) => {
        /* pick non-default when known */
        return o !== SORTING_BEHAVIOR.defaultOption;
      }) ?? SORTING_BEHAVIOR.discoveredOptions[0];
    await sortingPage.sorting.selectOption(option);
    await expectSelectedSort(sortingPage, option);
    await expect
      .poll(async () => sortingPage.getProductTitles(8), {
        timeout: SORTING_BEHAVIOR.uiSettleTimeoutMs,
      })
      .not.toEqual(before);
  });

  test('SORT-006 @sorting - URL/state validation after sorting', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      !SORTING_BEHAVIOR.sortingUiPresent || !SORTING_BEHAVIOR.urlSortParam,
      !SORTING_BEHAVIOR.sortingUiPresent
        ? SORTING_UNSUPPORTED_REASON
        : 'No URL sort-parameter contract observed on QA',
    );
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary.value);
    const before = sortingPage.getSortParamRaw();
    const option = SORTING_BEHAVIOR.discoveredOptions[0];
    await sortingPage.sorting.selectOption(option);
    await expect
      .poll(() => sortingPage.getSortParamRaw(), {
        timeout: SORTING_BEHAVIOR.uiSettleTimeoutMs,
      })
      .not.toBe(before);
  });

  test('SORT-007 @sorting - Change between sorting options', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      !SORTING_BEHAVIOR.sortingUiPresent ||
        SORTING_BEHAVIOR.discoveredOptions.length < 2,
      !SORTING_BEHAVIOR.sortingUiPresent
        ? SORTING_UNSUPPORTED_REASON
        : 'Fewer than two sorting options on QA',
    );
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary.value);
    const [first, second] = SORTING_BEHAVIOR.discoveredOptions;
    await sortingPage.sorting.selectOption(first);
    await expectSelectedSort(sortingPage, first);
    await sortingPage.sorting.selectOption(second);
    await expectSelectedSort(sortingPage, second);
  });

  test('SORT-008 @sorting - Refresh persistence', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      !SORTING_BEHAVIOR.sortingUiPresent ||
        SORTING_BEHAVIOR.discoveredOptions.length === 0,
      SORTING_UNSUPPORTED_REASON,
    );
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary.value);
    const option = SORTING_BEHAVIOR.discoveredOptions[0];
    await sortingPage.sorting.selectOption(option);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectSelectedSort(sortingPage, option);
  });

  test('SORT-009 @sorting - Sorting with a search query', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      !SORTING_BEHAVIOR.sortingUiPresent ||
        SORTING_BEHAVIOR.discoveredOptions.length === 0,
      SORTING_UNSUPPORTED_REASON,
    );
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.alternate.value);
    const option = SORTING_BEHAVIOR.discoveredOptions[0];
    await sortingPage.sorting.selectOption(option);
    await expectSelectedSort(sortingPage, option);
  });

  test('SORT-010 @sorting - Sorting with active filters', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      true,
      !SORTING_BEHAVIOR.sortingUiPresent
        ? SORTING_UNSUPPORTED_REASON
        : 'Skipped until sorting UI exists — will use shared FiltersPanel (not filters-facets tests) when enabled',
    );
    // Placeholder for future: open SERP → FiltersPanel.selectOption → sorting.selectOption
    void page;
  });

  test('SORT-011 @sorting - Mobile sorting UI', async ({ page }, testInfo) => {
    const viewport = page.viewportSize();
    const isMobile = !!viewport && viewport.width <= 430;
    testInfo.skip(
      !isMobile,
      'SORT-011 is mobile-viewport specific (mobile-390 / mobile-375)',
    );

    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary.value);

    // Dedicated Sort control should still be absent.
    await expectSortingControlAbsent(sortingPage);

    if (SORTING_BEHAVIOR.mobileCombinedFiltersAndSortLabel) {
      const inspection =
        await sortingPage.sorting.inspectMobileDrawerForSortUi();
      expect(inspection.triggerVisible).toBeTruthy();
      expect(inspection.dialogOpened).toBeTruthy();
      // Product note: label says "sort" but drawer has no Sort UI today.
      expect(
        inspection.hasSortHeading || inspection.hasSortOptions,
        'Mobile Filters & sort drawer unexpectedly contains Sort UI — update BEHAVIOR.md and enable SORT cases',
      ).toBeFalsy();
    }

    if (SORTING_BEHAVIOR.sortingUiPresent) {
      await expectSortingControlVisible(sortingPage);
    }
  });

  test('SORT-012 @sorting - Tablet sorting UI', async ({ page }, testInfo) => {
    const viewport = page.viewportSize();
    const isTablet =
      !!viewport && viewport.width >= 700 && viewport.width <= 1100;
    testInfo.skip(
      !isTablet,
      'SORT-012 is tablet-viewport specific (tablet-1024 / tablet-768)',
    );

    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary.value);

    if (!SORTING_BEHAVIOR.sortingUiPresent) {
      await expectSortingControlAbsent(sortingPage);
      return;
    }
    await expectSortingControlVisible(sortingPage);
  });

  test('SORT-013 @sorting - Browser navigation after sorting', async ({
    page,
  }, testInfo) => {
    testInfo.skip(
      true,
      !SORTING_BEHAVIOR.sortingUiPresent
        ? SORTING_UNSUPPORTED_REASON
        : 'Navigation/Back contract for sorting not yet observed on QA',
    );
    void page;
  });
});
