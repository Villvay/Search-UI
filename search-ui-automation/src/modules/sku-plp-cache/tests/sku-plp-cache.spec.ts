import { test, expect } from '../../../core/fixtures';
import { loadSkuDataset } from '../data/skuLoader';
import { runSkuPlpCacheBatch } from '../skuPlpRunner';

/**
 * SKU search → product-page cache validation.
 * One page, sequential searches (no reload between SKUs).
 */
const dataset = loadSkuDataset();

test.describe('SKU search PLP cache @sku-plp', () => {
  test.describe.configure({ mode: 'serial', retries: 0 });

  test(`sequential SKU searches (${dataset.searchSequence.length} steps, ${dataset.uniqueSkus.length} unique)`, async ({
    page,
  }, testInfo) => {
    // Playwright timeouts are 32-bit signed ints; 109k * 45s overflows and becomes 1ms.
    const maxPlaywrightTimeoutMs = 2_147_483_647;
    test.setTimeout(
      Math.min(
        maxPlaywrightTimeoutMs,
        Math.max(180_000, dataset.searchSequence.length * 45_000),
      ),
    );

    testInfo.annotations.push(
      { type: 'skuDataset', description: dataset.sourcePath },
      {
        type: 'skuSequence',
        description:
          dataset.searchSequence.slice(0, 12).join(' → ') +
          (dataset.searchSequence.length > 12
            ? ` … (${dataset.searchSequence.length} total)`
            : ''),
      },
    );

    const browserName = String(testInfo.project.use.browserName || 'chromium');
    const report = await runSkuPlpCacheBatch({
      page,
      dataset,
      environment: (process.env.ENV || 'qa').trim() || 'qa',
      browser: browserName.charAt(0).toUpperCase() + browserName.slice(1),
      viewport: testInfo.project.name,
      command:
        process.env.SKU_DATASET?.trim()
          ? `ENV=qa SKU_DATASET=${process.env.SKU_DATASET} npm run test:sku-plp`
          : 'ENV=qa npm run test:sku-plp',
    });
    const { summary } = report;

    testInfo.annotations.push(
      {
        type: 'skuSummary',
        description: `passed=${summary.passed} failed=${summary.failed} cache=${summary.cacheBugsSuspected}`,
      },
    );

    const stale = report.results.filter((r) => r.cacheBugSuspected);
    if (stale.length) {
      const preview = stale
        .slice(0, 8)
        .map(
          (row) =>
            `searched=${row.searchedSku} previous=${row.previousSku} actual=${row.actualPlpSku} url=${row.actualUrl}`,
        )
        .join('\n');
      expect
        .soft(
          stale.length,
          `${stale.length} stale/cache PLP failure(s).\n${preview}`,
        )
        .toBe(0);
    }

    expect
      .soft(
        summary.failed,
        `${summary.failed} SKU search failure(s) (url=${summary.urlMismatches} sku=${summary.skuMismatches} timeout=${summary.timeouts}). See reports/sku-plp/sku_search_results.md`,
      )
      .toBe(0);
  });
});
