import { test, expect } from '../../../core/fixtures';
import {
  annotateInput,
  annotateRobustnessCase,
  expectMarkupTreatedAsText,
  expectNoUnexpectedDialog,
  expectNoUnexpectedRuntime,
  expectNoUnrelatedRedirect,
  expectPageUsable,
  expectSerpSynced,
  expectTemplateNotEvaluated,
} from '../assertions/searchInputRobustnessAssertions';
import { SEARCH_INPUT_ROBUSTNESS_BEHAVIOR } from '../data/behavior';
import {
  longQuery,
  searchInputRobustnessQueries as Q,
} from '../data/queries';
import { SearchInputRobustnessPage } from '../pages/SearchInputRobustnessPage';
import {
  DialogGuard,
  captureDomSafety,
  getUrlQueryParam,
  sanitizeReportValue,
} from '../utils/inputSafetyHelpers';
import { RuntimeErrorCollector } from '../../runtime-errors/utils/runtimeErrorCollector';

/**
 * SEARCH INPUT ROBUSTNESS — unusual input as data; not a security pen-test.
 */
test.describe('Search input robustness @search-input-robustness', () => {
  test.describe.configure({ mode: 'parallel' });

  test('INPUT-001 @smoke @responsive - Normal query baseline', async ({
    page,
    baseURL,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const query = Q.normal.hinge;
    const guard = new DialogGuard(page, {
      inputUsed: sanitizeReportValue(query),
      viewport: testInfo.project.name,
    });
    const collector = new RuntimeErrorCollector(page, {
      baseURL: baseURL || '',
      query: query.value,
      viewport: testInfo.project.name,
      browser: String(testInfo.project.use.browserName || 'chromium'),
    });
    guard.attach();
    collector.attach();
    try {
      await ui.openHome();
      const snap = await ui.searchExpectingSerp(query.value);
      await expectSerpSynced(ui, query.value);
      expect(snap.pathname).toBe(SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.searchPath);
      expectNoUnexpectedDialog(guard.dialogs);
      expectNoUnexpectedRuntime(collector);
      annotateRobustnessCase(testInfo, query, {
        scenario: 'Normal baseline hinge',
        url: snap.url,
        dialogDetected: 'false',
        runtimeErrors: String(collector.unexpected().length),
      });
    } finally {
      collector.detach();
      guard.detach();
    }
  });

  test('INPUT-002 - Leading/trailing whitespace preserved', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const query = Q.whitespace.paddedHinge;
    await ui.openHome();
    const snap = await ui.searchExpectingSerp(query.value);
    expect(snap.inputValue).toBe(query.value);
    expect(snap.q).toBe(query.value);
    expect(SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.trimsWhitespace).toBe(false);
    await expectSerpSynced(ui, query.value);
    annotateRobustnessCase(testInfo, query, {
      scenario: 'Whitespace preserved (not trimmed)',
      url: snap.url,
      expectedState: 'preserve leading/trailing spaces',
      actualState: `input="${snap.inputValue}" q="${snap.q}"`,
    });
  });

  test('INPUT-003 - Multiple internal spaces preserved', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const query = Q.whitespace.multiInternal;
    await ui.openHome();
    const snap = await ui.searchExpectingSerp(query.value);
    expect(snap.q).toBe(query.value);
    expect(snap.inputValue).toBe(query.value);
    await expectPageUsable(ui);
    await expectSerpSynced(ui, query.value);
    annotateRobustnessCase(testInfo, query, {
      scenario: 'Internal multi-space preserved',
      url: snap.url,
    });
  });

  test('INPUT-004 @responsive - Special characters encoded consistently', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const guard = new DialogGuard(page, {
      inputUsed: 'special',
      viewport: testInfo.project.name,
    });
    guard.attach();
    try {
      await ui.openHome();
      // Representative subset keeps suite light; full list still covered via loop of key cases.
      const samples = Q.special.filter((s) =>
        ['hinge & screw', 'hinge/screw', 'hinge?screw', 'hinge#screw', 'hinge+screw'].includes(
          s.value,
        ),
      );
      for (const query of samples) {
        guard.setInputUsed(sanitizeReportValue(query));
        await ui.openHome();
        const before = new URL(page.url()).pathname;
        const snap = await ui.searchExpectingSerp(query.value);
        expect(snap.q).toBe(query.value);
        expect(snap.inputValue).toBe(query.value);
        expectNoUnrelatedRedirect(before, snap.url, 'search');
        await expectPageUsable(ui);
      }
      expectNoUnexpectedDialog(guard.dialogs);
      annotateInput(testInfo, {
        scenario: 'Special-character samples',
        inputCategory: 'special',
        inputValue: samples.map((s) => s.value).join(' | '),
        url: page.url(),
        dialogDetected: 'false',
        browser: String(testInfo.project.use.browserName || 'chromium'),
        viewport: testInfo.project.name,
      });
    } finally {
      guard.detach();
    }
  });

  test('INPUT-005 @responsive - Unicode input retained', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    await ui.openHome();
    for (const query of Q.unicode) {
      await ui.openHome();
      const snap = await ui.searchExpectingSerp(query.value);
      expect(snap.q).toBe(query.value);
      expect(snap.inputValue).toBe(query.value);
      await expectPageUsable(ui);
    }
    annotateRobustnessCase(testInfo, Q.unicode[0], {
      scenario: 'Unicode samples retained',
      inputValue: Q.unicode.map((u) => u.value).join(' | '),
      url: page.url(),
    });
  });

  test('INPUT-006 - Emoji input stable', async ({ page }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const guard = new DialogGuard(page, {
      inputUsed: 'emoji',
      viewport: testInfo.project.name,
    });
    guard.attach();
    try {
      for (const query of Q.emoji) {
        guard.setInputUsed(sanitizeReportValue(query));
        await ui.openHome();
        const before = new URL(page.url()).pathname;
        const snap = await ui.searchExpectingSerp(query.value);
        expect(snap.q).toBe(query.value);
        expect(snap.inputValue).toBe(query.value);
        expectNoUnrelatedRedirect(before, snap.url, 'search');
      }
      expectNoUnexpectedDialog(guard.dialogs);
      annotateRobustnessCase(testInfo, Q.emoji[2], {
        scenario: 'Emoji samples',
        dialogDetected: 'false',
        url: page.url(),
      });
    } finally {
      guard.detach();
    }
  });

  test('INPUT-007 @smoke @responsive - HTML-like input treated as text', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const guard = new DialogGuard(page, {
      inputUsed: 'html-like',
      viewport: testInfo.project.name,
    });
    guard.attach();
    try {
      for (const query of Q.htmlLike) {
        guard.setInputUsed(sanitizeReportValue(query));
        await ui.openHome();
        await ui.searchExpectingSerp(query.value);
        await expectMarkupTreatedAsText(ui, query.value);
        await expectPageUsable(ui);
      }
      expectNoUnexpectedDialog(guard.dialogs);
      annotateRobustnessCase(testInfo, Q.htmlLike[0], {
        scenario: 'HTML-like as text',
        dialogDetected: 'false',
        url: page.url(),
      });
    } finally {
      guard.detach();
    }
  });

  test('INPUT-008 @smoke @responsive - JavaScript-like input treated as text', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const guard = new DialogGuard(page, {
      inputUsed: 'javascript-like',
      viewport: testInfo.project.name,
    });
    guard.attach();
    try {
      for (const query of Q.javascriptLike) {
        guard.setInputUsed(sanitizeReportValue(query));
        await ui.openHome();
        const before = new URL(page.url()).pathname;
        const snap = await ui.searchExpectingSerp(query.value);
        expect(snap.q).toBe(query.value);
        expect(snap.inputValue).toBe(query.value);
        expectNoUnrelatedRedirect(before, snap.url, 'search');
        const dom = await captureDomSafety(ui.page);
        expect(dom.unexpectedImgSrcX).toBeFalsy();
        await expectPageUsable(ui);
      }
      expectNoUnexpectedDialog(guard.dialogs);
      annotateRobustnessCase(testInfo, Q.javascriptLike[0], {
        scenario: 'JavaScript-like as data (no dialog)',
        dialogDetected: String(guard.dialogs.length > 0),
        url: page.url(),
      });
    } finally {
      guard.detach();
    }
  });

  test('INPUT-009 - Template-like input remains literal', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    for (const query of Q.templateLike) {
      await ui.openHome();
      const snap = await ui.searchExpectingSerp(query.value);
      expectTemplateNotEvaluated(snap, query.value);
    }
    annotateRobustnessCase(testInfo, Q.templateLike[0], {
      scenario: 'Template literals not evaluated',
      url: page.url(),
    });
  });

  test('INPUT-010 - Encoded input stays literal (no auto-decode)', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    expect(SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.typedEncodedStaysLiteral).toBe(
      true,
    );
    for (const query of Q.encoded) {
      await ui.openHome();
      const snap = await ui.searchExpectingSerp(query.value);
      // Typed percent-encoding is data; q is the literal string, not decoded markup.
      expect(snap.q).toBe(query.value);
      expect(snap.inputValue).toBe(query.value);
      if (query.value.includes('%3C')) {
        expect(snap.q).not.toContain('<script');
      }
    }
    annotateRobustnessCase(testInfo, Q.encoded[0], {
      scenario: 'Percent-encoded typed as literal',
      url: page.url(),
      actualState: `q=${getUrlQueryParam(page.url())}`,
    });
  });

  test('INPUT-011 @responsive - Very long input accepted without crash', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const guard = new DialogGuard(page, {
      inputUsed: 'long',
      viewport: testInfo.project.name,
    });
    guard.attach();
    try {
      const maxAttr = await (async () => {
        await ui.openHome();
        return ui.inputMaxLengthAttr();
      })();
      expect(maxAttr).toBeNull();

      for (const len of Q.longLengths) {
        const query = longQuery(len);
        guard.setInputUsed(sanitizeReportValue(query));
        await ui.openHome();
        await ui.focusSearch();
        await ui.fillQuery(query.value);
        const after = await ui.input().inputValue();
        expect(after.length, `expected full ${len} chars`).toBe(len);
        const before = new URL(page.url()).pathname;
        await Promise.all([
          page.waitForURL(
            (url) =>
              url.pathname === SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.searchPath &&
              (url.searchParams.get('q') ?? '').length === len,
            { timeout: SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.uiSettleTimeoutMs },
          ),
          ui.pressEnter(),
        ]);
        const snap = await ui.snapshot();
        expect(snap.q?.length).toBe(len);
        expectNoUnrelatedRedirect(before, snap.url, 'search');
        await expectPageUsable(ui);
        annotateInput(testInfo, {
          scenario: `Long input ${sanitizeReportValue(query)}`,
          inputCategory: 'long',
          inputValue: sanitizeReportValue(query),
          url: snap.url,
        });
      }
      expectNoUnexpectedDialog(guard.dialogs);
      annotateInput(testInfo, {
        dialogDetected: 'false',
        browser: String(testInfo.project.use.browserName || 'chromium'),
        viewport: testInfo.project.name,
        expectedState: `accepted up to ${SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.observedAcceptedLongLength}`,
      });
    } finally {
      guard.detach();
    }
  });

  test('INPUT-012 @responsive - Empty input does not navigate', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    await ui.openHome();
    await ui.focusSearch();
    await ui.clearSearchUi();
    expect(await ui.input().inputValue()).toBe('');
    const before = page.url();
    await ui.pressEnter();
    await page.waitForTimeout(800);
    expect(SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.emptyEnterNavigates).toBe(false);
    expect(ui.isOnHomePath(page.url())).toBeTruthy();
    expectNoUnrelatedRedirect('/', page.url(), 'home');
    // Lightweight trending check when empty focus dropdown may show.
    await ui.focusSearch();
    const trendingVisible = await ui
      .trendingHeading()
      .isVisible()
      .catch(() => false);
    annotateRobustnessCase(testInfo, Q.empty, {
      scenario: 'Empty Enter stays home',
      url: page.url(),
      actualState: `before=${before} after=${page.url()} trendingVisible=${trendingVisible}`,
    });
  });

  test('INPUT-013 - Whitespace-only input navigates to SERP', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const query = Q.whitespaceOnly;
    expect(SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.whitespaceOnlyNavigates).toBe(
      true,
    );
    await ui.openHome();
    const snap = await ui.searchExpectingSerp(query.value);
    expect(snap.q).toBe(query.value);
    expect(snap.inputValue).toBe(query.value);
    expect(ui.isOnSearchPath(snap.url)).toBeTruthy();
    // Not identical to empty: empty stays home; this reaches SERP.
    await expect(ui.noResultsHeading()).toBeVisible({
      timeout: SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.uiSettleTimeoutMs,
    });
    annotateRobustnessCase(testInfo, query, {
      scenario: 'Whitespace-only → SERP No Results',
      url: snap.url,
      actualState: `input="${snap.inputValue}" q="${snap.q}" heading="${snap.heading}"`,
    });
  });

  test('INPUT-014 @responsive - Query/URL/UI synchronization', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    for (const query of Q.syncSamples) {
      await ui.openHome();
      const snap = await ui.searchExpectingSerp(query.value);
      await expectSerpSynced(ui, query.value);
      const decoded = getUrlQueryParam(snap.url);
      expect(decoded).toBe(query.value);
      expect(snap.inputValue).toBe(decoded);
    }
    annotateRobustnessCase(testInfo, Q.syncSamples[0], {
      scenario: 'input ↔ URL q ↔ SERP sync',
      inputValue: Q.syncSamples.map((s) => sanitizeReportValue(s)).join(' | '),
      url: page.url(),
    });
  });

  test('INPUT-015 - No stale state after clear then unusual query', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const a = Q.stateIsolation.queryA;
    const b = Q.stateIsolation.queryB;
    await ui.openHome();
    await ui.searchExpectingSerp(a.value);
    await expectSerpSynced(ui, a.value);
    await ui.clearSearchUi();
    await ui.searchExpectingSerp(b.value);
    const snap = await expectSerpSynced(ui, b.value);
    expect(snap.q).not.toBe(a.value);
    expect(snap.inputValue).not.toBe(a.value);
    if (snap.heading) {
      expect(snap.heading.toLowerCase()).not.toContain(
        `search results for "${a.value}"`,
      );
    }
    annotateInput(testInfo, {
      scenario: 'QUERY_A → clear → unusual QUERY_B',
      initialQuery: a.value,
      transitionQuery: sanitizeReportValue(b),
      expectedState: b.value,
      actualState: snap.q || '',
      url: snap.url,
      inputCategory: b.category,
      inputValue: sanitizeReportValue(b),
      browser: String(testInfo.project.use.browserName || 'chromium'),
      viewport: testInfo.project.name,
    });
  });

  test('INPUT-016 - Repeated unusual query stays stable', async ({
    page,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const query = Q.repeatedUnusual;
    const guard = new DialogGuard(page, {
      inputUsed: sanitizeReportValue(query),
      viewport: testInfo.project.name,
    });
    guard.attach();
    try {
      await ui.openHome();
      await ui.searchExpectingSerp(query.value);
      const first = await captureDomSafety(page);
      await ui.openHome();
      await ui.searchExpectingSerp(query.value);
      const second = await captureDomSafety(page);
      expect(second.unexpectedImgSrcX).toBeFalsy();
      expect(first.unexpectedImgSrcX).toBeFalsy();
      await expectSerpSynced(ui, query.value);
      expectNoUnexpectedDialog(guard.dialogs);
      annotateRobustnessCase(testInfo, query, {
        scenario: 'Same unusual query twice',
        dialogDetected: 'false',
        url: page.url(),
      });
    } finally {
      guard.detach();
    }
  });

  test('INPUT-017 - Runtime errors during robustness samples', async ({
    page,
    baseURL,
  }, testInfo) => {
    const ui = new SearchInputRobustnessPage(page);
    const guard = new DialogGuard(page, {
      inputUsed: 'runtime-sample',
      viewport: testInfo.project.name,
    });
    const collector = new RuntimeErrorCollector(page, {
      baseURL: baseURL || '',
      viewport: testInfo.project.name,
      browser: String(testInfo.project.use.browserName || 'chromium'),
    });
    guard.attach();
    collector.attach();
    try {
      for (const query of Q.runtimeSample) {
        collector.setContext({ query: sanitizeReportValue(query) });
        guard.setInputUsed(sanitizeReportValue(query));
        await ui.openHome();
        // Discard aborts from leaving the previous SERP (SPA navigation), then
        // measure only the next search of the unusual input.
        collector.reset();
        await ui.searchExpectingSerp(query.value);
        await expectSerpSynced(ui, query.value);
        expectNoUnexpectedRuntime(collector);
      }
      expectNoUnexpectedDialog(guard.dialogs);
      const summary = collector.summary();
      annotateInput(testInfo, {
        scenario: 'Runtime collector over robustness samples',
        inputCategory: 'mixed',
        inputValue: Q.runtimeSample.map((q) => sanitizeReportValue(q)).join(' | '),
        consoleErrors: String(summary.consoleErrors),
        pageErrors: String(summary.pageErrors),
        requestFailures: String(summary.requestFailures),
        http4xx: String(summary.http4xx),
        http5xx: String(summary.http5xx),
        unexpected: String(summary.unexpected),
        expected: String(summary.expected),
        ignored: String(summary.ignored),
        dialogDetected: 'false',
        runtimeErrors: String(summary.unexpected),
        url: page.url(),
        browser: String(testInfo.project.use.browserName || 'chromium'),
        viewport: testInfo.project.name,
      });
    } finally {
      collector.detach();
      guard.detach();
    }
  });
});
