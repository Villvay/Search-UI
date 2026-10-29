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

test.describe('On-enter search @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  test('ENTER-001 @smoke - Enter submits a valid query', async ({ page }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.validProduct);
    await expectOnSearchResultsPage(onEnter, onEnterQueries.validProduct);
  });

  test('ENTER-002 @smoke - The URL contains the expected query parameter', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.validProduct);
    await expectSearchUrlContainsQuery(page, onEnterQueries.validProduct);
    const url = new URL(page.url());
    expect(url.searchParams.get('route')).toBeNull();
    expect(url.searchParams.has(ON_ENTER_BEHAVIOR.queryParam)).toBeTruthy();
  });

  test('ENTER-003 - The results page loads successfully', async ({ page }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.validProduct);
    await expectOnSearchResultsPage(onEnter, onEnterQueries.validProduct);
    const productsTab = onEnter.productsTab();
    const productLinks = onEnter.productTitleLinks();
    const tabVisible = await productsTab.isVisible().catch(() => false);
    const productsVisible = (await productLinks.count()) > 0;
    expect(tabVisible || productsVisible).toBeTruthy();
  });

  test('ENTER-004 - Submitting a new query replaces the previous query', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.replaceFrom);
    await expectOnSearchResultsPage(onEnter, onEnterQueries.replaceFrom);
    await onEnter.focusSearch();
    await onEnter.enterQuery(onEnterQueries.replaceTo);
    await onEnter.pressEnter();
    await expectOnSearchResultsPage(onEnter, onEnterQueries.replaceTo);
  });

  test('ENTER-005 - Numeric queries follow the expected behavior', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.numeric);
    await expectSearchUrlContainsQuery(page, onEnterQueries.numeric);
  });

  test('ENTER-006 - Alphanumeric queries follow the expected behavior', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.alphanumeric);
    await expectSearchUrlContainsQuery(page, onEnterQueries.alphanumeric);
    expect(new URL(page.url()).pathname).not.toMatch(/^\/product\//);
  });

  test('ENTER-007 - Special-character queries follow the expected behavior', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.special);
    await expectSearchUrlContainsQuery(page, onEnterQueries.special);
  });

  test('ENTER-008 - Empty input follows the application rules', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.focusSearch();
    const before = page.url();
    await onEnter.pressEnter();
    await expectNoNavigation(page, before);
    expect(new URL(page.url()).pathname).not.toBe(ON_ENTER_BEHAVIOR.searchPath);
  });

  test('ENTER-009 - Whitespace-only input follows the application rules', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.focusSearch();
    await onEnter.enterQuery(onEnterQueries.whitespace);
    await onEnter.pressEnter();
    await expectSearchUrlContainsQuery(page, onEnterQueries.whitespace);
  });

  test('ENTER-010 - Long queries are handled', async ({ page }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.long);
    await expectSearchUrlContainsQuery(page, onEnterQueries.long);
    await expect(onEnter.input()).toBeVisible();
  });

  test('ENTER-011 - Zero-result queries display the empty state', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.noResult);
    await expectNoResultsPage(onEnter, onEnterQueries.noResult);
  });

  test('ENTER-012 - Enter works when the dropdown is open', async ({ page }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.focusSearch();
    await onEnter.typeQuerySequentially(onEnterQueries.dropdownOpenQuery);
    await onEnter.pressEnter();
    await expectOnSearchResultsPage(onEnter, onEnterQueries.dropdownOpenQuery);
    expect(new URL(page.url()).searchParams.get('route')).toBeNull();
  });

  test('ENTER-013 - The input, URL, and results remain consistent', async ({
    page,
  }) => {
    const onEnter = new OnEnterSearchPage(page);
    await onEnter.open();
    await onEnter.searchWithEnter(onEnterQueries.validProduct);
    await expectOnSearchResultsPage(onEnter, onEnterQueries.validProduct);
    expect(onEnter.getSearchQueryFromUrl().toLowerCase()).toBe(
      onEnterQueries.validProduct.toLowerCase(),
    );
  });
});
