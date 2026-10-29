import { test, expect } from '../../../core/fixtures';
import { expectNoUnexpectedErrors } from '../assertions/runtimeErrorAssertions';
import { RuntimeErrorsPage } from '../pages/RuntimeErrorsPage';
import { classifyRuntimeError } from '../utils/classify';

test.describe('Runtime errors @runtime-errors', () => {
  test('RUNTIME-001 @smoke @responsive - Initial page load has no unexpected JS errors', async ({
    page,
  }, testInfo) => {
    const runtime = new RuntimeErrorsPage(page);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      testInfo.annotations.push({
        type: 'url',
        description: page.url(),
      });
      expectNoUnexpectedErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-002 @smoke @responsive - Typing in the search box does not introduce unexpected errors', async ({
    page,
  }) => {
    const runtime = new RuntimeErrorsPage(page);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.collector.reset();
      await runtime.typeQuery('hinge');
      expectNoUnexpectedErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-003 @smoke - Opening suggestions does not introduce unexpected errors', async ({
    page,
  }) => {
    const runtime = new RuntimeErrorsPage(page);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.collector.reset();
      await runtime.typeQuery('hinge');
      await runtime.dropdown.waitForResults();
      expectNoUnexpectedErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-004 - Enter-key search works without unexpected errors', async ({
    page,
  }) => {
    const runtime = new RuntimeErrorsPage(page);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.collector.reset();
      await runtime.typeQuery('hinge');
      await runtime.searchPage.searchBox.pressEnter();
      await page.waitForURL(/\/search\?q=hinge/, { timeout: 30_000 });
      expectNoUnexpectedErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-005 - Trending now is not present in the idle dropdown', async ({
    page,
  }) => {
    const runtime = new RuntimeErrorsPage(page);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      await runtime.searchPage.searchBox.focus();
      await expect(runtime.dropdown.trendingHeading()).toHaveCount(0);
      expectNoUnexpectedErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-006 - Recent-search interactions work without unexpected errors', async ({
    page,
  }) => {
    const runtime = new RuntimeErrorsPage(page);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      await page.evaluate(() => localStorage.setItem('recentSearches', JSON.stringify(['hinge'])));
      await page.reload({ waitUntil: 'domcontentloaded' });
      runtime.collector.reset();
      await runtime.searchPage.searchBox.focus();
      expectNoUnexpectedErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-007 - Filter interactions work without unexpected errors', async ({
    page,
  }) => {
    const runtime = new RuntimeErrorsPage(page);
    runtime.attachCollector();
    try {
      await runtime.searchPage.openSearchResults('hinge');
      runtime.collector.reset();
      await runtime.filters.ensureVisible();
      expectNoUnexpectedErrors(runtime.collector);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-008 - Failed network requests are captured and classified', async ({
    page,
  }) => {
    const runtime = new RuntimeErrorsPage(page);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      await page.route('https://example.invalid/qa-probe', (route) => route.abort());
      await page.evaluate(() => fetch('https://example.invalid/qa-probe').catch(() => undefined));
      await expect
        .poll(() => runtime.collector.snapshot().some((r) => r.type === 'request-failure'))
        .toBeTruthy();
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-009 - HTTP 4xx/5xx responses are classified', async () => {
    const ignored = classifyRuntimeError({
      type: 'http-error',
      message: 'HTTP 404',
      url: 'https://cdn.acsbapp.com/missing.js',
      status: 404,
    });
    expect(ignored.classification).toBe('ignored');
    const unexpected = classifyRuntimeError({
      type: 'http-error',
      message: 'HTTP 500',
      url: 'https://wurthlac.com/search?q=hinge',
      status: 500,
    });
    expect(unexpected.classification).toBe('unexpected');
  });

  test('RUNTIME-010 - Each test records only its own errors', async ({ page }) => {
    const runtime = new RuntimeErrorsPage(page);
    runtime.attachCollector();
    try {
      await runtime.openHome();
      runtime.collector.reset();
      const first = runtime.collector.snapshot();
      runtime.collector.reset();
      const second = runtime.collector.snapshot();
      expect(first).not.toBe(second);
      expect(second).toEqual([]);
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-011 - Error reports include useful context', async ({ page }) => {
    const runtime = new RuntimeErrorsPage(page);
    runtime.collector.setContext({
      query: 'hinge',
      viewport: 'desktop-1440',
      browser: 'chromium',
    });
    runtime.attachCollector();
    try {
      await runtime.openHome();
      const snap = runtime.collector.snapshot();
      for (const record of snap) {
        expect(record.timestamp).toBeTruthy();
        expect(record.type).toBeTruthy();
        expect(record.message).toBeTruthy();
      }
    } finally {
      runtime.detachCollector();
    }
  });

  test('RUNTIME-012 @responsive - Expected application errors can be distinguished', async () => {
    const expected = classifyRuntimeError({
      type: 'page-error',
      message: 'Minified React error #418; visit https://react.dev',
    });
    expect(expected.classification).toBe('expected');
  });

  test('RUNTIME-013 - Firefox CSP Report-Only console noise is ignored, real errors are not', async () => {
    const reportOnly = classifyRuntimeError({
      type: 'console-error',
      message:
        'Content-Security-Policy: (Report-Only policy) The page’s settings would block a JavaScript eval (script-src)',
    });
    expect(reportOnly.classification).toBe('ignored');

    const cookieNoise = classifyRuntimeError({
      type: 'console-error',
      message: 'Cookie “_fbp” has been rejected for invalid domain.',
    });
    expect(cookieNoise.classification).toBe('ignored');

    const realError = classifyRuntimeError({
      type: 'console-error',
      message: 'Minified React error #419; visit https://react.dev',
    });
    expect(realError.classification).toBe('unexpected');
  });
});
