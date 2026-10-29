import { test, expect } from '../../../core/fixtures';
import {
  annotateRuntimeSummary,
  expectCapturedNetworkFailure,
  expectClassificationPresent,
  expectNoUnexpectedRuntimeErrors,
  expectRecordsIsolated,
} from '../assertions/runtimeErrorAssertions';
import { classifyRuntimeError } from '../utils/classify';
import { getEnvironmentConfig } from '../../../../config/environments';
import {
  runtimeErrorQueries,
  runtimeFilterOptions,
} from '../data/queries';
import { RuntimeErrorsPage } from '../pages/RuntimeErrorsPage';

/**
 * RUNTIME ERRORS — console / page / network monitoring for Search UI.
 * Independent of functional feature modules.
 */
test.describe('Runtime errors @runtime-errors', () => {
  test.describe.configure({ mode: 'parallel' });

  function createPage(
    page: import('@playwright/test').Page,
    testInfo: { project: { name: string; use: { browserName?: unknown } } },
  ) {
    return new RuntimeErrorsPage(page, {
      viewport: testInfo.project.name,
      browser: String(testInfo.project.use.browserName || 'chromium'),
    });
  }

  test('RUNTIME-001 @smoke @responsive - Search page loads without unexpected console errors', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Home/search shell load',
        query: '',
      });
      await expectNoUnexpectedRuntimeErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-002 @smoke @responsive - Search input interaction produces no unexpected runtime errors', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.resetCollector();
      await runtime.focusSearch();
      await runtime.typeQuery(runtimeErrorQueries.valid);
      await page.waitForTimeout(800);
      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Focus + type valid query',
        query: runtimeErrorQueries.valid,
      });
      await expectNoUnexpectedRuntimeErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-003 @smoke - Suggestions interaction produces no unexpected runtime errors', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.resetCollector();
      await runtime.focusSearch();
      await runtime.typeQuery(runtimeErrorQueries.suggestion);
      await runtime.waitForSuggestions();
      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Suggestions dropdown',
        query: runtimeErrorQueries.suggestion,
      });
      await expectNoUnexpectedRuntimeErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-004 - Enter search produces no unexpected runtime errors', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.resetCollector();
      await runtime.focusSearch();
      await runtime.typeQuery(runtimeErrorQueries.result);
      await runtime.submitEnter(runtimeErrorQueries.result);
      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Enter → SRP',
        query: runtimeErrorQueries.result,
        url: page.url(),
      });
      await expectNoUnexpectedRuntimeErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-005 - Trending Now interaction produces no unexpected runtime errors', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.resetCollector();
      const selected = await runtime.openTrendingAndSelectFirst();
      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Trending Now → SRP',
        query: selected,
        url: page.url(),
      });
      await expectNoUnexpectedRuntimeErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-006 - Recent Searches interaction produces no unexpected runtime errors', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      // QA stores recent searches in localStorage; seed without importing that module.
      await runtime.seedRecentSearch(runtimeErrorQueries.recent);
      runtime.resetCollector();
      await runtime.selectRecentSearch(runtimeErrorQueries.recent);
      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Recent Searches → SRP',
        query: runtimeErrorQueries.recent,
        url: page.url(),
      });
      await expectNoUnexpectedRuntimeErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
      await page
        .evaluate(() => localStorage.removeItem('recentSearches'))
        .catch(() => undefined);
    }
  });

  test('RUNTIME-007 - Filter interaction produces no unexpected runtime errors', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      await runtime.openFilterableSerp(runtimeErrorQueries.filter);
      runtime.resetCollector();
      await runtime.applyBrandFilter(
        runtimeFilterOptions.brandFacet,
        runtimeFilterOptions.brandPrimary,
      );
      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Apply Brand filter on SERP',
        query: runtimeErrorQueries.filter,
        url: page.url(),
      });
      await expectNoUnexpectedRuntimeErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-008 - Failed network requests are captured and reported', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.resetCollector();
      await runtime.collector.probeRequestFailure();
      await runtime.collector.probeIgnoredHttp404();
      await page.waitForTimeout(500);
      const records = runtime.collector.snapshot();
      expectCapturedNetworkFailure(records);
      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Controlled network failure capture',
        query: '',
      });
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-009 - HTTP 4xx/5xx responses are classified correctly', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    const baseURL = getEnvironmentConfig().baseURL;
    try {
      // Classifier unit checks (no fabricated app 500)
      const ignored = classifyRuntimeError({
        type: 'http-error',
        message: 'HTTP 404',
        url: 'https://cdn.acsbapp.com/config/qa-baersupply.vercel.app/config.json',
        status: 404,
        baseURL,
      });
      expect(ignored.classification).toBe('ignored');

      const searchFail = classifyRuntimeError({
        type: 'http-error',
        message: 'HTTP 500',
        url: 'https://search-api-wurthbaer-qa.search-villvay.workers.dev/suggestions?query=hinge',
        status: 500,
        baseURL,
      });
      expect(searchFail.classification).toBe('unexpected');

      await runtime.openHome();
      runtime.resetCollector();
      await runtime.collector.probeIgnoredHttp404();
      await page.waitForTimeout(500);
      const records = runtime.collector.snapshot();
      expectClassificationPresent(records, 'ignored');
      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Classification ignored vs unexpected Search API',
        query: '',
      });
      await expectNoUnexpectedRuntimeErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-010 - Runtime errors are isolated per test', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      await runtime.collector.probeIgnoredHttp404();
      await page.waitForTimeout(300);
      const phaseA = runtime.collector.snapshot();
      expect(phaseA.length).toBeGreaterThan(0);

      runtime.resetCollector();
      const phaseB = runtime.collector.snapshot();
      expect(phaseB).toEqual([]);
      expectRecordsIsolated(phaseA, phaseB);

      await runtime.focusSearch();
      const phaseC = runtime.collector.snapshot();
      expectRecordsIsolated(phaseA, phaseC);

      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Collector reset isolation',
        query: '',
      });
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-011 - Runtime error report contains execution context', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.resetCollector();
      runtime.setQueryContext(runtimeErrorQueries.valid);
      await runtime.collector.probeIgnoredHttp404();
      await page.waitForTimeout(400);
      const records = runtime.collector.snapshot();
      expect(records.length).toBeGreaterThan(0);
      const sample = records[0];
      expect(sample.type).toBeTruthy();
      expect(sample.message).toBeTruthy();
      expect(sample.viewport || testInfo.project.name).toBeTruthy();
      expect(sample.query).toBe(runtimeErrorQueries.valid);

      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Context fields on captured error',
        query: runtimeErrorQueries.valid,
        browser: String(testInfo.project.use.browserName || 'chromium'),
        viewport: testInfo.project.name,
        errorType: sample.type,
        errorMessage: sample.message,
        errorUrl: sample.url || '',
        errorStatus: sample.status != null ? String(sample.status) : '',
      });

      const types = new Set(testInfo.annotations.map((a) => a.type));
      for (const key of [
        'query',
        'viewport',
        'browser',
        'errorType',
        'errorMessage',
      ]) {
        expect(types.has(key), `missing annotation ${key}`).toBeTruthy();
      }
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-012 @responsive - Responsive runtime monitoring smoke', async ({
    page,
  }, testInfo) => {
    const runtime = createPage(page, testInfo);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.resetCollector();
      await runtime.focusSearch();
      await runtime.typeQuery(runtimeErrorQueries.valid);
      await page.waitForTimeout(600);
      annotateRuntimeSummary(testInfo, runtime.collector, {
        scenario: 'Responsive smoke: focus + type',
        query: runtimeErrorQueries.valid,
        viewport: testInfo.project.name,
        browser: String(testInfo.project.use.browserName || 'chromium'),
      });
      await expectNoUnexpectedRuntimeErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });
});
