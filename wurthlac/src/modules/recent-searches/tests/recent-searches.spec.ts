import { test, expect } from '../../../core/fixtures';
import {
  expectRecentContains,
  expectRecentSectionAbsent,
  expectRecentSectionVisible,
} from '../assertions/recentSearchesAssertions';
import { RECENT_SEARCHES_BEHAVIOR } from '../data/behavior';
import {
  recentSearchFive,
  recentSearchQueries,
  recentSearchSix,
  recentSearchTriple,
} from '../data/queries';
import { RecentSearchesPage } from '../pages/RecentSearchesPage';

test.describe('Your Recent Searches @recent-searches @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    const recent = new RecentSearchesPage(page);
    await recent.open();
    await recent.resetHistory();
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(
      (key) => localStorage.removeItem(key),
      RECENT_SEARCHES_BEHAVIOR.storageKey,
    );
  });

  test('RECENT-001 @smoke - Recent searches appear under the correct conditions', async ({
    page,
  }) => {
    const recent = new RecentSearchesPage(page);
    await recent.seedHistoryNewestFirst(recentSearchTriple);
    await recent.openRecentSearchesDropdown();
    await expectRecentSectionVisible(recent);
  });

  test('RECENT-002 @smoke - Previous queries appear in the list', async ({
    page,
  }) => {
    const recent = new RecentSearchesPage(page);
    await recent.seedHistoryNewestFirst(recentSearchTriple);
    await recent.openRecentSearchesDropdown();
    await expectRecentContains(recent, recentSearchTriple);
  });

  test('RECENT-003 - Clicking a recent query executes that query', async ({
    page,
  }) => {
    const recent = new RecentSearchesPage(page);
    await recent.seedHistoryNewestFirst(recentSearchTriple);
    await recent.openRecentSearchesDropdown();
    await recent.selectRecentQuery(recentSearchQueries.a);
    await recent.waitForSearchLanding(recentSearchQueries.a);
    expect(recent.getSearchQueryFromUrl()).toBe(recentSearchQueries.a);
    await expect(recent.input()).toHaveValue(recentSearchQueries.a);
  });

  test('RECENT-004 - Individual recent items can be removed', async ({
    page,
  }) => {
    const recent = new RecentSearchesPage(page);
    await recent.seedHistoryNewestFirst(recentSearchTriple);
    await recent.openRecentSearchesDropdown();
    await recent.removeRecentQuery(recentSearchQueries.b);
    const texts = await recent.section.getQueryTexts();
    expect(texts.join(' ')).not.toContain(recentSearchQueries.b);
    expect(texts.join(' ')).toContain(recentSearchQueries.a);
  });

  test('RECENT-005 @smoke - The list respects the verified maximum size', async ({
    page,
  }) => {
    const recent = new RecentSearchesPage(page);
    await recent.seedHistoryNewestFirst(recentSearchFive);
    await recent.openRecentSearchesDropdown();
    expect(await recent.section.getItemCount()).toBe(
      RECENT_SEARCHES_BEHAVIOR.maxDisplayed,
    );

    await recent.submitSearch(recentSearchQueries.f);
    await recent.open();
    await recent.searchPage.clearSearchText();
    await recent.openRecentSearchesDropdown();
    const count = await recent.section.getItemCount();
    expect(count).toBeLessThanOrEqual(RECENT_SEARCHES_BEHAVIOR.maxDisplayed);
    expect(count).toBe(RECENT_SEARCHES_BEHAVIOR.maxDisplayed);
  });

  test('RECENT-006 - The most recent query appears first', async ({ page }) => {
    const recent = new RecentSearchesPage(page);
    await recent.seedHistoryNewestFirst(recentSearchTriple);
    await recent.openRecentSearchesDropdown();
    const texts = await recent.section.getQueryTexts();
    expect(texts[0]?.toLowerCase()).toContain(recentSearchQueries.a.toLowerCase());
  });

  test('RECENT-007 @smoke - Searching again moves an existing query', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch([
      recentSearchQueries.a,
      recentSearchQueries.b,
    ]);
    await recent.submitSearch(recentSearchQueries.a);
    await recent.open();
    await recent.openRecentSearchesDropdown();
    const texts = await recent.section.getQueryTexts();
    expect(texts[0]?.toLowerCase()).toContain(recentSearchQueries.a.toLowerCase());
  });

  test('RECENT-008 - Multiple items can be removed', async ({ page }) => {
    const recent = new RecentSearchesPage(page);
    await recent.seedHistoryNewestFirst(recentSearchTriple);
    await recent.openRecentSearchesDropdown();
    await recent.removeRecentQuery(recentSearchQueries.a);
    await recent.removeRecentQuery(recentSearchQueries.b);
    const texts = await recent.section.getQueryTexts();
    expect(texts.join(' ')).toContain(recentSearchQueries.c);
    expect(texts.join(' ')).not.toContain(recentSearchQueries.a);
  });

  test('RECENT-009 - Recent-search storage matches the application', async ({
    page,
  }) => {
    const recent = new RecentSearchesPage(page);
    await recent.seedHistoryNewestFirst(recentSearchTriple);
    const stored = await recent.readStorage();
    expect(stored[0]).toBe(recentSearchQueries.a);
  });

  test('RECENT-010 - Empty history does not leave an incorrect section', async ({
    page,
  }) => {
    const recent = new RecentSearchesPage(page);
    await recent.open();
    await recent.resetHistory();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await recent.focusEmptySearch();
    await expectRecentSectionAbsent(recent);
  });

  test('RECENT-011 @responsive - Recent searches work on the current viewport', async ({
    page,
  }) => {
    const recent = new RecentSearchesPage(page);
    await recent.seedHistoryNewestFirst([recentSearchQueries.a]);
    await recent.openRecentSearchesDropdown();
    await expectRecentSectionVisible(recent);
    await expect(recent.section.removeButton(recentSearchQueries.a)).toBeVisible();
  });

  test('RECENT-012 - Recent searches remain after refresh', async ({ page }) => {
    const recent = new RecentSearchesPage(page);
    await recent.seedHistoryNewestFirst(recentSearchTriple);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await recent.openRecentSearchesDropdown();
    await expectRecentContains(recent, recentSearchTriple);
  });

  test('RECENT-013 - A fresh browser context starts without history', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const recent = new RecentSearchesPage(page);
    await recent.open();
    await recent.focusEmptySearch();
    await expectRecentSectionAbsent(recent);
    await context.close();
  });
});
