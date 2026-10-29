import { test, expect } from '../../../core/fixtures';
import { expectSerpIdentity } from '../assertions/cacheStateAssertions';
import { CACHE_STATE_BEHAVIOR } from '../data/behavior';
import { cacheQueries } from '../data/queries';
import { CacheStatePage } from '../pages/CacheStatePage';

test.describe('Cache and search state @cache-state', () => {
  test('CACHE-001 @smoke @responsive - A new query replaces the previous results', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheQueries.a);
    await expectSerpIdentity(cache, cacheQueries.a);
    await cache.searchQuery(cacheQueries.b);
    await expectSerpIdentity(cache, cacheQueries.b);
    await expect(cache.resultsHeading(cacheQueries.a)).toHaveCount(0);
  });

  test('CACHE-002 @smoke @responsive - Dropdown results update when the query changes', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await cache.searchPage.searchBox.focus();
    await cache.searchPage.searchBox.typeSequentially(cacheQueries.a);
    await cache.dropdown.waitForResults();
    const first = (await cache.dropdown.resultsColumn().innerText()).toLowerCase();
    await cache.searchPage.searchBox.clear();
    await cache.searchPage.searchBox.typeSequentially(cacheQueries.b);
    await cache.dropdown.waitForResults();
    const second = (await cache.dropdown.resultsColumn().innerText()).toLowerCase();
    expect(second).toContain(cacheQueries.b);
    expect(first).not.toBe(second);
  });

  test('CACHE-003 @smoke @responsive - Refresh preserves the query state', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheQueries.a);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectSerpIdentity(cache, cacheQueries.a);
  });

  test('CACHE-004 - After refresh, a new search is not stale', async ({ page }) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheQueries.a);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await cache.searchQuery(cacheQueries.b);
    await expectSerpIdentity(cache, cacheQueries.b);
  });

  test('CACHE-005 - Browser Back and Forward restore the correct query and results', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheQueries.a);
    await cache.searchQuery(cacheQueries.b);
    await page.goBack();
    await expectSerpIdentity(cache, cacheQueries.a);
    await page.goForward();
    await expectSerpIdentity(cache, cacheQueries.b);
  });

  test('CACHE-006 @smoke @responsive - Filters do not leak into a new search', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheQueries.filterable);
    await cache.filters.selectOption('Brand', 'Blum, Inc.');
    expect(cache.getFiltersParam()).toBeTruthy();
    await cache.searchQuery(cacheQueries.b);
    if (CACHE_STATE_BEHAVIOR.newSearchClearsFilters) {
      expect(cache.getFiltersParam()).toBeNull();
    }
    await expectSerpIdentity(cache, cacheQueries.b);
  });

  test('CACHE-007 - Direct navigation to a results URL works', async ({ page }) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheQueries.a);
    await expectSerpIdentity(cache, cacheQueries.a);
  });

  test('CACHE-008 @smoke @responsive - Clearing a query does not leave stale results in the dropdown', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await cache.searchPage.searchBox.focus();
    await cache.searchPage.searchBox.typeSequentially(cacheQueries.a);
    await cache.dropdown.waitForResults();
    await cache.searchPage.searchBox.clear();
    await expect(cache.dropdown.resultsColumn()).toBeHidden({
      timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs,
    });
  });

  test('CACHE-009 - Cache-busting query still renders the same identity', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheQueries.a);
    await page.goto(`/search?q=${cacheQueries.a}&_cacheProbe=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(cache.resultsHeading(cacheQueries.a)).toBeVisible({
      timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs,
    });
  });

  test('CACHE-010 - A fresh browser context starts in the expected state', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await expect(cache.input()).toHaveValue('');
    expect(page.url()).not.toContain(`q=${cacheQueries.a}`);
    await context.close();
  });

  test('CACHE-011 - Repeating a query returns consistent identity', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheQueries.a);
    await cache.searchQuery(cacheQueries.b);
    await cache.searchQuery(cacheQueries.a);
    await expectSerpIdentity(cache, cacheQueries.a);
  });

  test('CACHE-012 - Rapid query replacement leaves the latest query active', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await cache.searchPage.searchBox.focus();
    await cache.searchPage.searchBox.type(cacheQueries.a);
    await cache.searchPage.searchBox.type(cacheQueries.b);
    await cache.searchPage.searchBox.pressEnter();
    await expectSerpIdentity(cache, cacheQueries.b);
  });

  test('CACHE-013 - Refreshing a filtered results page preserves filter state', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheQueries.filterable);
    await cache.filters.selectOption('Brand', 'Blum, Inc.');
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(cache.getFiltersParam()).toBeTruthy();
    await expectSerpIdentity(cache, cacheQueries.filterable);
  });

  test('CACHE-014 @responsive - URL, query input, and results remain consistent', async ({
    page,
  }) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheQueries.a);
    await expectSerpIdentity(cache, cacheQueries.a);
  });
});
