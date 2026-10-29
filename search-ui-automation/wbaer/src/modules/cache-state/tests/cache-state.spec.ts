import { test, expect } from '../../../core/fixtures';
import {
  annotateCache,
  expectHistoryNavigationSynced,
  expectNoFiltersParam,
  expectNotStaleQuery,
  expectSerpSyncedToQuery,
  expectSuggestionSetsDiffer,
  expectSuggestionsRelateToQuery,
} from '../assertions/cacheStateAssertions';
import { CACHE_STATE_BEHAVIOR } from '../data/behavior';
import { cacheStateFilter, cacheStateQueries } from '../data/queries';
import { CacheStatePage } from '../pages/CacheStatePage';
import {
  attachSearchRequestSampler,
  hasServiceWorkerOrCacheApi,
} from '../utils/cacheStateHelpers';

/**
 * CACHE & SEARCH STATE — stale-data / contamination checks.
 * Independent of functional feature modules.
 */
test.describe('Cache and search state @cache-state', () => {
  test.describe.configure({ mode: 'parallel' });

  test('CACHE-001 @smoke @responsive - Different searches same page do not show stale results', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();

    const a = await cache.searchQuery(cacheStateQueries.a);
    annotateCache(testInfo, {
      scenario: 'Same-page A→B without reload',
      initialQuery: cacheStateQueries.a,
      transitionQuery: cacheStateQueries.b,
      url: a.url,
    });
    await expectSerpSyncedToQuery(cache, cacheStateQueries.a);

    const b = await cache.searchQuery(cacheStateQueries.b);
    await expectSerpSyncedToQuery(cache, cacheStateQueries.b);
    expectNotStaleQuery(b, cacheStateQueries.a, cacheStateQueries.b);
    annotateCache(testInfo, {
      expectedState: cacheStateQueries.b,
      actualState: b.q || '',
      url: b.url,
      likelyStateSource: 'application-state+url',
    });
  });

  test('CACHE-002 @smoke @responsive - Suggestions update after changing query', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await cache.focusSearch();
    await cache.fillQuery(cacheStateQueries.a);
    await cache.waitForSuggestions();
    const sugA = await cache.getSuggestionTexts();
    expectSuggestionsRelateToQuery(sugA, cacheStateQueries.a);

    await cache.clearSearchUi();
    await cache.fillQuery(cacheStateQueries.b);
    await cache.waitForSuggestions();
    const sugB = await cache.getSuggestionTexts();
    expectSuggestionsRelateToQuery(sugB, cacheStateQueries.b);
    expectSuggestionSetsDiffer(sugA, sugB);
    await expect(cache.input()).toHaveValue(cacheStateQueries.b);

    annotateCache(testInfo, {
      scenario: 'Suggestions A then B',
      initialQuery: cacheStateQueries.a,
      transitionQuery: cacheStateQueries.b,
      expectedState: cacheStateQueries.b,
      actualState: await cache.input().inputValue(),
    });
  });

  test('CACHE-003 @smoke @responsive - SERP refresh preserves correct query state', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await cache.searchQuery(cacheStateQueries.a);
    await expectSerpSyncedToQuery(cache, cacheStateQueries.a);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await cache.searchPage.searchBox.ensureVisible();
    const after = await expectSerpSyncedToQuery(cache, cacheStateQueries.a);

    annotateCache(testInfo, {
      scenario: 'Reload preserves QUERY_A',
      initialQuery: cacheStateQueries.a,
      expectedState: cacheStateQueries.a,
      actualState: after.q || '',
      url: after.url,
      likelyStateSource: 'url-state+ssr',
    });
  });

  test('CACHE-004 - Changing query after refresh does not use stale result data', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await cache.searchQuery(cacheStateQueries.a);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await cache.searchPage.searchBox.ensureVisible();
    await expectSerpSyncedToQuery(cache, cacheStateQueries.a);

    const b = await cache.searchQuery(cacheStateQueries.b);
    await expectSerpSyncedToQuery(cache, cacheStateQueries.b);
    expectNotStaleQuery(b, cacheStateQueries.a, cacheStateQueries.b);

    annotateCache(testInfo, {
      scenario: 'Reload A then search B',
      initialQuery: cacheStateQueries.a,
      transitionQuery: cacheStateQueries.b,
      expectedState: cacheStateQueries.b,
      actualState: b.q || '',
      url: b.url,
    });
  });

  test('CACHE-005 - Browser back/forward does not incorrectly mix search states', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await cache.searchQuery(cacheStateQueries.a);
    await cache.searchQuery(cacheStateQueries.b);

    await page.goBack();
    annotateCache(testInfo, {
      scenario: 'goBack after A→B',
      initialQuery: cacheStateQueries.a,
      transitionQuery: cacheStateQueries.b,
      expectedState: cacheStateQueries.a,
      likelyStateSource: 'history-api+react-state',
      browser: String(testInfo.project.use.browserName || 'chromium'),
      viewport: testInfo.project.name,
    });

    // Asserts URL+UI sync — currently FAILS on QA (stale SPA UI). Do not weaken.
    const afterBack = await expectHistoryNavigationSynced(
      cache,
      cacheStateQueries.a,
    );
    annotateCache(testInfo, {
      actualState: `q=${afterBack.q}; input=${afterBack.inputValue}; heading=${afterBack.heading}`,
      url: afterBack.url,
    });

    await page.goForward();
    await expectHistoryNavigationSynced(cache, cacheStateQueries.b);
  });

  test('CACHE-006 @smoke @responsive - Query URL and UI state remain synchronized', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    const sequence = [
      cacheStateQueries.a,
      cacheStateQueries.b,
      cacheStateQueries.c,
    ];
    for (const q of sequence) {
      await cache.searchQuery(q);
      await expectSerpSyncedToQuery(cache, q);
    }
    annotateCache(testInfo, {
      scenario: 'A→B→C sync',
      initialQuery: sequence[0],
      transitionQuery: sequence.join(' → '),
      expectedState: sequence[sequence.length - 1],
      actualState: (await cache.identity()).q || '',
      url: page.url(),
    });
  });

  test('CACHE-007 - Filter state does not leak into a new search', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheStateQueries.filterable);
    await cache.applyBrandFilter(
      cacheStateFilter.brandFacet,
      cacheStateFilter.brandPrimary,
    );
    expect(cache.getFiltersParam()).toBeTruthy();

    const after = await cache.searchQuery(cacheStateQueries.b);
    await expectSerpSyncedToQuery(cache, cacheStateQueries.b);

    if (CACHE_STATE_BEHAVIOR.newSearchClearsFilters) {
      expectNoFiltersParam(after);
    }

    annotateCache(testInfo, {
      scenario: 'Filter on A then search B',
      initialQuery: cacheStateQueries.filterable,
      transitionQuery: cacheStateQueries.b,
      expectedState: CACHE_STATE_BEHAVIOR.newSearchClearsFilters
        ? 'no filters param'
        : 'filters may persist (documented)',
      actualState: after.filters || '(none)',
      url: after.url,
      likelyStateSource: 'url-state',
    });
  });

  test('CACHE-008 @smoke @responsive - Clearing search removes stale search UI', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await cache.focusSearch();
    await cache.fillQuery(cacheStateQueries.a);
    await cache.waitForSuggestions();

    await cache.clearSearchUi();
    await expect(cache.input()).toHaveValue('');
    await expect(cache.suggestionsColumn()).toBeHidden({
      timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs,
    });
    await expect(cache.trendingHeading().first()).toBeVisible({
      timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs,
    });

    await cache.fillQuery(cacheStateQueries.b);
    await cache.waitForSuggestions();
    const sugB = await cache.getSuggestionTexts();
    expectSuggestionsRelateToQuery(sugB, cacheStateQueries.b);
    await expect(cache.input()).toHaveValue(cacheStateQueries.b);

    annotateCache(testInfo, {
      scenario: 'Clear then type B',
      initialQuery: cacheStateQueries.a,
      transitionQuery: cacheStateQueries.b,
      expectedState: cacheStateQueries.b,
      actualState: await cache.input().inputValue(),
    });
  });

  test('CACHE-009 - Search state after direct SERP navigation', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openSerp(cacheStateQueries.a);
    await expectSerpSyncedToQuery(cache, cacheStateQueries.a);

    await cache.openSerp(cacheStateQueries.b);
    const b = await expectSerpSyncedToQuery(cache, cacheStateQueries.b);
    expectNotStaleQuery(b, cacheStateQueries.a, cacheStateQueries.b);

    annotateCache(testInfo, {
      scenario: 'Direct /search?q= A then B',
      initialQuery: cacheStateQueries.a,
      transitionQuery: cacheStateQueries.b,
      expectedState: cacheStateQueries.b,
      actualState: b.q || '',
      url: b.url,
    });
  });

  test('CACHE-010 - Cache-busting comparison', async ({ page }, testInfo) => {
    const cache = new CacheStatePage(page);
    const sampler = attachSearchRequestSampler(page);
    try {
      await cache.openHome();
      await cache.openSerp(cacheStateQueries.a);
      const normal = await expectSerpSyncedToQuery(cache, cacheStateQueries.a);

      // Bypass HTTP cache for this navigation only (unique query param).
      await page.goto(
        `/search?q=${encodeURIComponent(cacheStateQueries.a)}&_cacheProbe=${Date.now()}`,
        {
          waitUntil: 'domcontentloaded',
          timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs,
        },
      );
      await cache.waitForUrlQuery(cacheStateQueries.a);
      await expect
        .poll(async () => (await cache.identity()).inputValue, {
          timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs,
        })
        .toBe(cacheStateQueries.a);

      const busted = await cache.identity();
      expect(busted.q).toBe(cacheStateQueries.a);
      expect(
        headingMatchesOrInput(
          busted.heading,
          busted.inputValue,
          cacheStateQueries.a,
        ),
      ).toBeTruthy();

      const sw = await hasServiceWorkerOrCacheApi(page);
      expect(sw.registrations).toEqual([]);
      expect(sw.cacheNames).toEqual([]);

      const searchApiHits = sampler.records.filter((r) =>
        r.url.includes(CACHE_STATE_BEHAVIOR.searchApiHostFragment),
      );
      const apiNoCache = searchApiHits.filter((r) =>
        r.cacheControl?.includes('no-cache'),
      );
      // When Search API traffic is observed, it must advertise no-cache.
      // If RSC serves without a new API round-trip, SW/cache emptiness still documents no SW cache.
      if (searchApiHits.length > 0) {
        expect(apiNoCache.length).toBeGreaterThan(0);
      }

      annotateCache(testInfo, {
        scenario: 'Normal vs cache-busted SERP; SW absent; API no-cache when fetched',
        initialQuery: cacheStateQueries.a,
        expectedState: cacheStateQueries.a,
        actualState: busted.q || '',
        url: busted.url,
        likelyStateSource:
          'no-sw; search-api no-cache when requested; storefront must-revalidate',
        staleFindings:
          normal.q === busted.q
            ? `No incorrect stale SERP identity; searchApiHits=${searchApiHits.length}; no-cache=${apiNoCache.length}`
            : 'Mismatch',
      });
    } finally {
      sampler.detach();
    }
  });

  test('CACHE-011 - New browser context starts clean', async ({
    browser,
  }, testInfo) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const cacheA = new CacheStatePage(pageA);
    await cacheA.openHome();
    await cacheA.searchQuery(cacheStateQueries.a);
    await expectSerpSyncedToQuery(cacheA, cacheStateQueries.a);
    await contextA.close();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    try {
      const cacheB = new CacheStatePage(pageB);
      await cacheB.openHome();
      await cacheB.focusSearch();
      // Fresh context: no SERP for QUERY_A; input empty (ignore Recent Searches storage).
      await expect(cacheB.input()).toHaveValue('');
      expect(pageB.url()).not.toContain(`q=${cacheStateQueries.a}`);

      annotateCache(testInfo, {
        scenario: 'Fresh context isolation',
        initialQuery: cacheStateQueries.a,
        expectedState: 'empty input / not on QUERY_A SERP',
        actualState: await cacheB.input().inputValue(),
        url: pageB.url(),
        likelyStateSource: 'browser-context',
        viewport: testInfo.project.name,
        browser: String(testInfo.project.use.browserName || 'chromium'),
      });
    } finally {
      await contextB.close();
    }
  });

  test('CACHE-012 - Same query repeated after another query', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    const first = await cache.searchQuery(cacheStateQueries.a);
    await cache.searchQuery(cacheStateQueries.b);
    const again = await cache.searchQuery(cacheStateQueries.a);
    await expectSerpSyncedToQuery(cache, cacheStateQueries.a);
    expect(again.q).toBe(first.q);
    expect(again.inputValue).toBe(first.inputValue);
    expect(headingMatchesOrInput(again.heading, again.inputValue, cacheStateQueries.a)).toBeTruthy();

    annotateCache(testInfo, {
      scenario: 'A→B→A',
      initialQuery: cacheStateQueries.a,
      transitionQuery: `${cacheStateQueries.b} → ${cacheStateQueries.a}`,
      expectedState: cacheStateQueries.a,
      actualState: again.q || '',
      url: again.url,
    });
  });

  test('CACHE-013 - Rapid query replacement does not leave stale state', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await cache.focusSearch();
    await cache.fillQuery(cacheStateQueries.a);
    // Rapid replace via fill (not sequential typing)
    await cache.fillQuery(cacheStateQueries.b);
    await cache.submitEnter(cacheStateQueries.b);
    const id = await expectSerpSyncedToQuery(cache, cacheStateQueries.b);
    expectNotStaleQuery(id, cacheStateQueries.a, cacheStateQueries.b);

    annotateCache(testInfo, {
      scenario: 'Rapid fill A then B + Enter',
      initialQuery: cacheStateQueries.a,
      transitionQuery: cacheStateQueries.b,
      expectedState: cacheStateQueries.b,
      actualState: id.q || '',
      url: id.url,
    });
  });

  test('CACHE-014 @responsive - Cache/state validation responsive smoke', async ({
    page,
  }, testInfo) => {
    const cache = new CacheStatePage(page);
    await cache.openHome();
    await cache.searchQuery(cacheStateQueries.a);
    await expectSerpSyncedToQuery(cache, cacheStateQueries.a);
    await cache.searchQuery(cacheStateQueries.b);
    const b = await expectSerpSyncedToQuery(cache, cacheStateQueries.b);
    expectNotStaleQuery(b, cacheStateQueries.a, cacheStateQueries.b);

    annotateCache(testInfo, {
      scenario: 'Responsive A→B sync',
      initialQuery: cacheStateQueries.a,
      transitionQuery: cacheStateQueries.b,
      expectedState: cacheStateQueries.b,
      actualState: b.q || '',
      url: b.url,
      viewport: testInfo.project.name,
      browser: String(testInfo.project.use.browserName || 'chromium'),
    });
  });
});

function headingMatchesOrInput(
  heading: string | null,
  input: string,
  query: string,
): boolean {
  if (input === query && heading) {
    return new RegExp(
      `Search Results for\\s+"${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
      'i',
    ).test(heading);
  }
  return input === query;
}
