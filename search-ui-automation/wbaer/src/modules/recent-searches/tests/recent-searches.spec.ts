import { test, expect } from '../../../core/fixtures';
import {
  expectDropdownStillUsable,
  expectRecentCountAtMost,
  expectRecentCountExactly,
  expectRecentOrderNewestFirst,
  expectRecentQueriesDisplayed,
  expectRecentQueryRemoved,
  expectRecentSearchesAbsent,
  expectRecentSearchesVisible,
  expectSrpLoadedForRecentQuery,
  expectUrlQueryMatchesSelected,
} from '../assertions/recentSearchesAssertions';
import { RECENT_SEARCHES_BEHAVIOR } from '../data/behavior';
import {
  recentSearchFiveOrdered,
  recentSearchQueries,
  recentSearchQueryList,
  recentSearchTriple,
} from '../data/queries';
import { RecentSearchesPage } from '../pages/RecentSearchesPage';

/**
 * YOUR RECENT SEARCHES — idle dropdown history (localStorage).
 * Independent of suggestions / trending-now / on-type / on-enter / filters.
 */
test.describe('Your Recent Searches @recent-searches @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  function annotate(
    testInfo: { annotations: { type: string; description?: string }[] },
    fields: Record<string, string>,
  ): void {
    for (const [type, description] of Object.entries(fields)) {
      testInfo.annotations.push({ type, description });
    }
  }

  test.beforeEach(async ({ page }) => {
    const recent = new RecentSearchesPage(page);
    await recent.resetHistory();
  });

  test.afterEach(async ({ page }) => {
    const recent = new RecentSearchesPage(page);
    await recent.open().catch(() => undefined);
    await page
      .evaluate((key) => localStorage.removeItem(key), RECENT_SEARCHES_BEHAVIOR.storageKey)
      .catch(() => undefined);
  });

  test('RECENT-001 @smoke - Empty search displays Your Recent Searches with history', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Focus empty search shows Your recent searches',
      storageMechanism: 'localStorage:recentSearches',
      history: recentSearchTriple.join(', '),
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch([...recentSearchTriple]);
    await recent.openRecentSearchesDropdown();

    expect(await recent.dropdown.isVisible()).toBeTruthy();
    await expectRecentSearchesVisible(recent);
  });

  test('RECENT-002 @smoke - Recent Searches displays previously searched queries', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Known searches appear in dropdown',
      storageMechanism: 'localStorage:recentSearches',
      history: recentSearchTriple.join(', '),
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch([...recentSearchTriple]);
    await recent.openRecentSearchesDropdown();

    await expectRecentQueriesDisplayed(recent, [...recentSearchTriple]);
  });

  test('RECENT-003 - Maximum of 5 recent searches are displayed', async ({
    page,
  }, testInfo) => {
    const created = [...recentSearchQueryList];
    annotate(testInfo, {
      scenario: 'Six searches → at most five displayed',
      storageMechanism: 'localStorage:recentSearches',
      historyCreated: String(created.length),
      history: created.join(', '),
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch(created);
    await recent.openRecentSearchesDropdown();

    const displayed = await recent.recentSearches.getItemCount();
    await expectRecentCountAtMost(recent, RECENT_SEARCHES_BEHAVIOR.maxDisplayed);
    await expectRecentCountExactly(recent, RECENT_SEARCHES_BEHAVIOR.maxDisplayed);

    const storage = await recent.readStorage();
    expect(storage?.length).toBe(RECENT_SEARCHES_BEHAVIOR.maxDisplayed);
    // Oldest of the six should be dropped
    expect(storage).not.toContain(recentSearchQueries.a);
    expect(storage?.[0]).toBe(recentSearchQueries.f);

    annotate(testInfo, {
      historyCreated: String(created.length),
      displayed: String(displayed),
    });
  });

  test('RECENT-004 - Recent searches are ordered latest-first', async ({
    page,
  }, testInfo) => {
    const created = [...recentSearchFiveOrdered];
    const expectedNewestFirst = [...created].reverse();
    annotate(testInfo, {
      scenario: 'UI order matches newest-first localStorage',
      storageMechanism: 'localStorage:recentSearches',
      history: created.join(' → '),
      expectedOrder: expectedNewestFirst.join(', '),
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch(created);
    await recent.openRecentSearchesDropdown();

    await expectRecentOrderNewestFirst(recent, expectedNewestFirst);
    expect(await recent.readStorage()).toEqual(expectedNewestFirst);
  });

  test('RECENT-005 @smoke - Clicking a recent search navigates to SRP', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Recent query click → /search?q=',
      storageMechanism: 'localStorage:recentSearches',
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch([...recentSearchTriple]);
    await recent.openRecentSearchesDropdown();

    const selected = recentSearchQueries.c;
    annotate(testInfo, { history: selected, selectedQuery: selected });
    await recent.selectRecentQuery(selected);
    await recent.waitForSearchLanding(selected);
    await expectUrlQueryMatchesSelected(page, selected);
  });

  test('RECENT-006 - Selected recent search produces the correct search query', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Selected text, URL q, and input match',
      storageMechanism: 'localStorage:recentSearches',
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch([...recentSearchTriple]);
    await recent.openRecentSearchesDropdown();

    const selected = recentSearchQueries.b;
    annotate(testInfo, { selectedQuery: selected, history: selected });
    await recent.selectRecentQuery(selected);
    await expectSrpLoadedForRecentQuery(page, recent, selected);
    expect(recent.getSearchQueryFromUrl()).toBe(selected);
    if (!RECENT_SEARCHES_BEHAVIOR.clickAddsRouteParam) {
      expect(recent.getRouteParamFromUrl()).toBeNull();
    }
  });

  test('RECENT-007 @smoke - Individual recent search can be cleared', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Remove one recent query; others remain',
      storageMechanism: 'localStorage:recentSearches',
      history: recentSearchTriple.join(', '),
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch([...recentSearchTriple]);
    await recent.openRecentSearchesDropdown();

    const removed = recentSearchQueries.b;
    const remaining = [recentSearchQueries.c, recentSearchQueries.a];
    await recent.removeRecentQuery(removed);
    await expectRecentQueryRemoved(recent, removed, remaining);
    await expectDropdownStillUsable(recent);

    const storage = await recent.readStorage();
    expect(storage).not.toContain(removed);
    for (const q of remaining) expect(storage).toContain(q);
  });

  test('RECENT-008 - Multiple recent searches can be removed individually', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Remove two queries by name (not index)',
      storageMechanism: 'localStorage:recentSearches',
      history: recentSearchTriple.join(', '),
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch([...recentSearchTriple]);
    await recent.openRecentSearchesDropdown();

    await recent.removeRecentQuery(recentSearchQueries.a);
    await expect(recent.recentSearches.queryButton(recentSearchQueries.a)).toHaveCount(
      0,
    );
    await expect(recent.recentSearches.queryButton(recentSearchQueries.b)).toBeVisible();
    await expect(recent.recentSearches.queryButton(recentSearchQueries.c)).toBeVisible();

    await recent.removeRecentQuery(recentSearchQueries.c);
    await expectRecentQueryRemoved(recent, recentSearchQueries.c, [
      recentSearchQueries.b,
    ]);
    expect(await recent.recentSearches.getQueryTexts()).toEqual([
      recentSearchQueries.b,
    ]);
  });

  test('RECENT-009 - Clicking a recent search works after clearing another', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Remove A then click B → SRP',
      storageMechanism: 'localStorage:recentSearches',
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch([...recentSearchTriple]);
    await recent.openRecentSearchesDropdown();

    await recent.removeRecentQuery(recentSearchQueries.a);
    const selected = recentSearchQueries.b;
    annotate(testInfo, { selectedQuery: selected });
    await recent.selectRecentQuery(selected);
    await expectSrpLoadedForRecentQuery(page, recent, selected);
  });

  test('RECENT-010 - History updates when an existing query is searched again', async ({
    page,
  }, testInfo) => {
    const created = [...recentSearchFiveOrdered];
    annotate(testInfo, {
      scenario: 'Re-search C moves C to newest position',
      storageMechanism: 'localStorage:recentSearches',
      history: created.join(' → '),
      reSearch: recentSearchQueries.c,
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch(created);
    await recent.submitSearch(recentSearchQueries.c);
    await recent.open();
    await recent.searchPage.clearSearchText();
    await recent.openRecentSearchesDropdown();

    const expected = [
      recentSearchQueries.c,
      recentSearchQueries.e,
      recentSearchQueries.d,
      recentSearchQueries.b,
      recentSearchQueries.a,
    ];
    await expectRecentOrderNewestFirst(recent, expected);
    expect(await recent.readStorage()).toEqual(expected);
  });

  test('RECENT-011 - Recent searches persist per observed storage behavior', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Survive reopen, navigation, and refresh',
      storageMechanism: 'localStorage:recentSearches',
      history: recentSearchTriple.join(', '),
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch([...recentSearchTriple]);

    // Dropdown close / reopen
    await recent.openRecentSearchesDropdown();
    await expectRecentQueriesDisplayed(recent, [...recentSearchTriple]);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await recent.openRecentSearchesDropdown();
    await expectRecentQueriesDisplayed(recent, [...recentSearchTriple]);

    // In-app navigation
    await recent.searchPage.openSearchResults(recentSearchQueries.a);
    await recent.open();
    await recent.searchPage.clearSearchText();
    await recent.openRecentSearchesDropdown();
    await expectRecentQueriesDisplayed(recent, [...recentSearchTriple]);

    // Full refresh
    const before = await recent.readStorage();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await recent.searchPage.searchBox.ensureVisible();
    expect(await recent.readStorage()).toEqual(before);
    await recent.openRecentSearchesDropdown();
    await expectRecentQueriesDisplayed(recent, [...recentSearchTriple]);
  });

  test('RECENT-012 - Recent searches are user-specific', async ({ page }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Authenticated User A vs User B',
      storageMechanism: 'localStorage:recentSearches (browser profile)',
      isolationResult: 'unsupported',
    });

    testInfo.skip(
      !RECENT_SEARCHES_BEHAVIOR.dualAccountTestingSupported,
      'QA automation has no safe dual test accounts; recent history is localStorage per browser profile, not verified server-side auth history.',
    );

    // Placeholder for future dual-account coverage.
    void page;
  });

  test('RECENT-013 - No recent searches state', async ({ page }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Clean history: section absent (no empty copy)',
      storageMechanism: 'localStorage:recentSearches',
      history: '(empty)',
    });

    const recent = new RecentSearchesPage(page);
    // beforeEach already reset; ensure empty and focus
    await recent.open();
    expect(await recent.readStorage()).toBeNull();
    await recent.focusEmptySearch();

    await expectRecentSearchesAbsent(recent);
    // Observed empty-history idle UI: no Recent section; Trending now still appears.
    await expect(
      page.getByRole('heading', { name: 'Trending now', exact: true }).first(),
    ).toBeVisible({ timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs });
  });

  test('RECENT-014 @responsive - Recent Searches usable across viewports', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Section usable on current viewport project',
      storageMechanism: 'localStorage:recentSearches',
      viewport: testInfo.project.name,
      browser: String(testInfo.project.use.browserName || 'chromium'),
      history: recentSearchTriple.join(', '),
    });

    const recent = new RecentSearchesPage(page);
    await recent.establishHistoryViaSearch([...recentSearchTriple]);
    await recent.openRecentSearchesDropdown();

    await expectRecentSearchesVisible(recent);
    await expectRecentQueriesDisplayed(recent, [...recentSearchTriple]);
    await expect(recent.recentSearches.rows().first().locator('button').first()).toBeEnabled();
    await expect(
      recent.recentSearches.removeButton(recentSearchQueries.c),
    ).toBeVisible();
  });
});
