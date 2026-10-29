import { test, expect } from '../../../core/fixtures';
import {
  expectNoUnexpectedRouteParam,
  expectSearchInputRetainsQuery,
  expectSrpLoadedForTrendingQuery,
  expectSrpResultsStateValid,
  expectTrendingItemTextsValid,
  expectTrendingItemsInteractable,
  expectTrendingItemsPresent,
  expectTrendingNowVisible,
  expectUrlQueryMatchesSelected,
} from '../assertions/trendingNowAssertions';
import { TrendingNowPage } from '../pages/TrendingNowPage';

/**
 * TRENDING NOW — idle empty-focus dropdown chips → SRP.
 * Independent of suggestions / on-type / on-enter / filters / sorting.
 */
test.describe('Trending Now @trending-now @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  function annotate(
    testInfo: { annotations: { type: string; description?: string }[] },
    fields: Record<string, string>,
  ): void {
    for (const [type, description] of Object.entries(fields)) {
      testInfo.annotations.push({ type, description });
    }
  }

  test('TREND-001 @smoke - Empty search + focus displays Trending Now', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Empty search focus shows Trending Now',
    });

    const trending = new TrendingNowPage(page);
    await trending.open();
    await trending.openTrendingNow();

    // Live QA: click opens Trending Now; DOM focus may move off the input afterward.
    await expect(trending.input()).toHaveValue('');
    expect(await trending.dropdown.isVisible()).toBeTruthy();
    await expectTrendingNowVisible(trending);

    annotate(testInfo, { url: page.url() });
  });

  test('TREND-002 @smoke - Trending Now contains search query items', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Trending Now lists interactable query chips',
    });

    const trending = new TrendingNowPage(page);
    await trending.open();
    await trending.openTrendingNow();

    await expectTrendingItemsPresent(trending);
    await expectTrendingItemsInteractable(trending);

    const count = await trending.getItemCount();
    annotate(testInfo, {
      trendingItemCount: String(count),
      url: page.url(),
    });
  });

  test('TREND-003 - Trending Now query text is non-empty', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Every visible trending chip has searchable text',
    });

    const trending = new TrendingNowPage(page);
    await trending.open();
    await trending.openTrendingNow();

    await expectTrendingItemTextsValid(trending);
    annotate(testInfo, {
      trendingQueries: (await trending.getItemTexts()).join(' | '),
      url: page.url(),
    });
  });

  test('TREND-004 @smoke - Clicking a Trending Now query navigates to SRP', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Trending chip click → /search?q=<selected>',
    });

    const trending = new TrendingNowPage(page);
    await trending.open();
    await trending.openTrendingNow();

    const selected = await trending.selectTrendingByIndex(0);
    annotate(testInfo, { trendingQuery: selected });

    await trending.waitForSearchLanding(selected);
    await expectUrlQueryMatchesSelected(page, selected);
    annotate(testInfo, { url: page.url() });
  });

  test('TREND-005 - Selected Trending Now query matches the SRP query', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'URL q equals selected chip after decode',
    });

    const trending = new TrendingNowPage(page);
    await trending.open();
    await trending.openTrendingNow();

    const selected = await trending.selectTrendingByIndex(0);
    annotate(testInfo, { trendingQuery: selected });

    await expectSrpLoadedForTrendingQuery(page, trending, selected);
    const decoded = trending.getSearchQueryFromUrl();
    expect(decoded).toBe(selected);
    annotate(testInfo, { url: page.url() });
  });

  test('TREND-006 - SRP displays results for the selected Trending Now query', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'SERP loaded with input + results markers',
    });

    const trending = new TrendingNowPage(page);
    await trending.open();
    await trending.openTrendingNow();

    const selected = await trending.selectTrendingByIndex(0);
    annotate(testInfo, { trendingQuery: selected });

    await expectSrpLoadedForTrendingQuery(page, trending, selected);
    await expectSearchInputRetainsQuery(trending, selected);
    await expectSrpResultsStateValid(trending, selected, {
      expectProducts: true,
    });
    annotate(testInfo, { url: page.url() });
  });

  test('TREND-007 - Trending Now works after clearing/reopening search', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Trending survives navigate → reset → refocus',
    });

    const trending = new TrendingNowPage(page);
    await trending.open();
    await trending.openTrendingNow();
    await expectTrendingNowVisible(trending);

    const selected = await trending.selectTrendingByIndex(0);
    annotate(testInfo, { trendingQuery: selected });
    await trending.waitForSearchLanding(selected);

    await trending.resetToCleanSearch();
    await trending.openTrendingNow();
    await expectTrendingNowVisible(trending);
    await expectTrendingItemsPresent(trending);
    annotate(testInfo, { url: page.url() });
  });

  test('TREND-008 @responsive - Trending Now works across supported viewports', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Trending Now visible on current viewport project',
      viewport: testInfo.project.name,
      browser: String(testInfo.project.use.browserName || 'chromium'),
    });

    const trending = new TrendingNowPage(page);
    await trending.open();
    await trending.openTrendingNow();

    await expectTrendingNowVisible(trending);
    await expectTrendingItemsPresent(trending);
    await expectTrendingItemsInteractable(trending);
    annotate(testInfo, { url: page.url() });
  });

  test('TREND-009 - Trending query selection does not produce an incorrect route', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Trending click must not add suggestion route=',
    });

    const trending = new TrendingNowPage(page);
    await trending.open();
    await trending.openTrendingNow();

    const selected = await trending.selectTrendingByIndex(0);
    annotate(testInfo, { trendingQuery: selected });

    await trending.waitForSearchLanding(selected);
    await expectNoUnexpectedRouteParam(page);
    annotate(testInfo, { url: page.url() });
  });

  test('TREND-010 - Trending Now handles multiple available queries', async ({
    page,
  }, testInfo) => {
    annotate(testInfo, {
      scenario: 'Two different trending chips update SRP q',
    });

    const trending = new TrendingNowPage(page);
    await trending.open();
    await trending.openTrendingNow();

    const texts = await trending.getItemTexts();
    testInfo.skip(
      texts.length < 2,
      `Live Trending Now provided ${texts.length} item(s); need ≥2 for TREND-010`,
    );

    const first = texts[0];
    const second = texts[1];
    expect(first).not.toBe(second);

    await trending.selectTrendingQuery(first);
    await expectSrpLoadedForTrendingQuery(page, trending, first);
    annotate(testInfo, { trendingQuery: first, url: page.url() });

    await trending.resetToCleanSearch();
    await trending.openTrendingNow();

    await trending.selectTrendingQuery(second);
    await expectSrpLoadedForTrendingQuery(page, trending, second);
    expect(trending.getSearchQueryFromUrl()).toBe(second);
    annotate(testInfo, {
      trendingQuery: `${first} → ${second}`,
      url: page.url(),
    });
  });
});
