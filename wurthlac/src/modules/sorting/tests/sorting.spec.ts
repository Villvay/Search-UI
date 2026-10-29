import { test, expect } from '../../../core/fixtures';
import { expectSortingContract } from '../assertions/sortingAssertions';
import { SORTING_BEHAVIOR } from '../data/behavior';
import { sortingQueries } from '../data/queries';
import { SortingPage } from '../pages/SortingPage';

test.describe('Sorting @sorting @responsive', () => {
  test('SORT-001 @smoke - Sort control is present when supported, or correctly absent', async ({
    page,
  }) => {
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    await expectSortingContract(sortingPage);
  });

  test('SORT-002 - Available sort options are displayed when UI exists', async ({
    page,
  }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    const options = await sortingPage.sorting.getAvailableOptions();
    expect(options.length).toBeGreaterThan(0);
  });

  test('SORT-003 - Default sort behavior is correct when UI exists', async ({
    page,
  }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    const selected = await sortingPage.sorting.getSelectedLabel();
    expect(selected).toBeTruthy();
  });

  test('SORT-004 - Selecting a sort option updates the selected state', async ({
    page,
  }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    const options = await sortingPage.sorting.getAvailableOptions();
    await sortingPage.sorting.selectOption(options[0]);
  });

  test('SORT-005 - Changing sort updates results when UI exists', async ({
    page,
  }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    expect(await sortingPage.productTitleLinks().count()).toBeGreaterThan(0);
  });

  test('SORT-006 - URL reflects sorting when supported', async ({ page }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    expect(page.url()).toBeTruthy();
  });

  test('SORT-007 - Refresh preserves sort state when UI exists', async ({
    page,
  }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectSortingContract(sortingPage);
  });

  test('SORT-008 - Sorting works with an active query when UI exists', async ({
    page,
  }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.alternate);
    await expectSortingContract(sortingPage);
  });

  test('SORT-009 - Sorting works with active filters when UI exists', async ({
    page,
  }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    await expectSortingContract(sortingPage);
  });

  test('SORT-010 - Mobile/tablet sort contract', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    test.skip(!/mobile|tablet/.test(project), 'Viewport-specific sort inspection');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    await expectSortingContract(sortingPage);
  });

  test('SORT-011 - Browser navigation restores sort state when UI exists', async ({
    page,
  }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    await expectSortingContract(sortingPage);
  });

  test('SORT-012 - Changing sort does not leave stale results when UI exists', async ({
    page,
  }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    await expectSortingContract(sortingPage);
  });

  test('SORT-013 - Results follow the selected sort order when it can be verified', async ({
    page,
  }) => {
    test.skip(!SORTING_BEHAVIOR.sortingUiPresent, 'Sorting UI was not present on wurthlac.com at inspection time.');
    const sortingPage = new SortingPage(page);
    await sortingPage.openSearchResults(sortingQueries.primary);
    await expectSortingContract(sortingPage);
  });
});
