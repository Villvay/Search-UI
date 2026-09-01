import { test, expect } from '../../../core/fixtures';
import {
  expectNoNavigation,
  expectNoResultsPage,
  expectOnSearchResultsPage,
  expectSearchUrlContainsQuery,
} from '../assertions/onEnterAssertions';
import { ON_ENTER_BEHAVIOR } from '../data/behavior';
import { onEnterQueries } from '../data/queries';
import { OnEnterSearchPage } from '../pages/OnEnterSearchPage';

/**
 * ON-ENTER module — normal Enter-key search execution only.
 * Does not import on-type or suggestions modules.
 */
test.describe('On-enter search', () => {
  test.describe.configure({ mode: 'parallel' });

  test('ENTER-001 - Valid query executes search on Enter', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.validProduct.value);
    await expectOnSearchResultsPage(onEnter, onEnterQueries.validProduct.value);
  });

  test('ENTER-002 - Search URL contains submitted query', async ({ page }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.validProductType.value);
    await expectSearchUrlContainsQuery(
      page,
      onEnterQueries.validProductType.value,
    );
    expect(onEnter.getSearchQueryFromUrl()?.toLowerCase()).toBe(
      onEnterQueries.validProductType.value.toLowerCase(),
    );
    // Normal Enter must not add suggestion-style route filters.
    expect(new URL(page.url()).searchParams.get('route')).toBeNull();
  });

  test('ENTER-003 - Search results page loads after Enter', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.validProduct.value);
    await onEnter.waitForSearchNavigation(onEnterQueries.validProduct.value);
    await onEnter.waitForSearchResultsHeading(
      onEnterQueries.validProduct.value,
    );
    await expect(onEnter.productsTab()).toBeVisible({
      timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs,
    });
    await expect(page.getByText(/page \d+ of \d+/i).first()).toBeVisible({
      timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs,
    });
  });

  test('ENTER-004 - Search input retains submitted query after navigation', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.validProduct.value);
    await onEnter.waitForSearchNavigation(onEnterQueries.validProduct.value);
    await expect(onEnter.input()).toHaveValue(
      onEnterQueries.validProduct.value,
    );
  });

  test('ENTER-005 - Different query replaces previous search', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();

    await onEnter.searchWithEnter(onEnterQueries.replaceFrom.value);
    await expectOnSearchResultsPage(onEnter, onEnterQueries.replaceFrom.value);

    await onEnter.focusSearch();
    await onEnter.clearQuery();
    await onEnter.typeQuerySequentially(onEnterQueries.replaceTo.value);
    await onEnter.submitSearchWithEnter();

    await expectOnSearchResultsPage(onEnter, onEnterQueries.replaceTo.value);
    expect(onEnter.getSearchQueryFromUrl()?.toLowerCase()).toBe(
      onEnterQueries.replaceTo.value.toLowerCase(),
    );
    await expect(
      onEnter.searchResultsHeading(onEnterQueries.replaceFrom.value),
    ).toHaveCount(0);
  });

  test('ENTER-006 - Numeric query executes search on Enter', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.numeric.value);
    await expectOnSearchResultsPage(onEnter, onEnterQueries.numeric.value);
  });

  test('ENTER-007 - Alphanumeric query executes search on Enter', async ({
    page,
  }) => {
    // Non-SKU alphanumeric. Exact SKUs may intent-route to PDP.
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.alphanumeric.value);
    await expectOnSearchResultsPage(onEnter, onEnterQueries.alphanumeric.value);
  });

  test('ENTER-008 - Special-character query executes according to application behavior', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.specialCharacter.value);
    await expectOnSearchResultsPage(
      onEnter,
      onEnterQueries.specialCharacter.value,
    );
  });

  test('ENTER-009 - No-result query displays correct empty state', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.noResult.value);
    await expectNoResultsPage(onEnter, onEnterQueries.noResult.value);
  });

  test('ENTER-010 - Empty query handles Enter according to application behavior', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    const urlBefore = page.url();

    await onEnter.focusSearch();
    await onEnter.clearQuery();
    await onEnter.submitSearchWithEnter();

    await expectNoNavigation(page, urlBefore);
    await expect(onEnter.input()).toHaveValue('');
    expect(new URL(page.url()).pathname).not.toBe(ON_ENTER_BEHAVIOR.searchPath);
  });

  test('ENTER-011 - Whitespace query handles Enter according to application behavior', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.whitespace.value);
    await expectNoResultsPage(onEnter, onEnterQueries.whitespace.value);
  });

  test('ENTER-012 - Long query executes according to application behavior', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.long.value);
    await expectOnSearchResultsPage(onEnter, onEnterQueries.long.value);
  });

  test('ENTER-013 - Enter with suggestions open performs normal search', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.focusSearch();
    await onEnter.typeQuerySequentially(
      onEnterQueries.dropdownOpenQuery.value,
    );

    // Dropdown may appear; Enter must still submit the typed query as normal search.
    await page
      .locator('[data-search-column="suggestions"]')
      .locator('visible=true')
      .waitFor({
        state: 'visible',
        timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs,
      })
      .catch(() => null);

    await onEnter.submitSearchWithEnter();
    await expectOnSearchResultsPage(
      onEnter,
      onEnterQueries.dropdownOpenQuery.value,
    );
    expect(new URL(page.url()).searchParams.get('route')).toBeNull();
  });
});
