import fs from 'fs';
import path from 'path';
import { test, expect } from '../../../core/fixtures';
import {
  getActiveAnalyticsDatasetPath,
  loadAnalyticsQueries,
  normalizeAnalyticsQueryKey,
  parseAnalyticsModules,
} from '../../../core/utils/analyticsQueryLoader';
import {
  runAnalyticsViewportBatch,
  type AnalyticsBatchReport,
} from '../analyticsBatchRunner';

/**
 * Viewport-batched analytics: one Playwright test per project (viewport)
 * runs the query dataset across selected modules on a single page.
 * Deduplicates normalized query text within each module; reports every ID.
 * Failures do not abort remaining queries.
 *
 * Existing per-query analytics specs remain unchanged.
 */
const queries = loadAnalyticsQueries();
const modules = parseAnalyticsModules();
const uniqueNormalized = new Set(
  queries.map((q) => normalizeAnalyticsQueryKey(q.query)),
).size;

function browserLabel(projectName: string): string {
  if (/firefox/i.test(projectName)) return 'Firefox';
  if (/safari|webkit/i.test(projectName)) return 'WebKit';
  return 'Chromium';
}

function writeBatchReport(report: AnalyticsBatchReport): void {
  const dir = path.resolve(process.cwd(), 'reports', 'analytics-batch');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${report.viewport}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
}

test.describe('Analytics viewport batch @analytics @analytics-batched', () => {
  test.describe.configure({ mode: 'parallel' });

  test(`batch ${queries.length} rows (${uniqueNormalized} unique) × ${modules.length} modules`, async ({
    page,
  }, testInfo) => {
    // Budget against unique executions (dedupe), not raw row count.
    test.setTimeout(Math.max(600_000, uniqueNormalized * modules.length * 75_000));

    const viewport = testInfo.project.name;
    const browser = browserLabel(viewport);

    testInfo.annotations.push(
      { type: 'analyticsDataset', description: getActiveAnalyticsDatasetPath() },
      { type: 'analyticsQueryCount', description: String(queries.length) },
      {
        type: 'analyticsUniqueNormalized',
        description: String(uniqueNormalized),
      },
      { type: 'analyticsModules', description: modules.join(',') },
    );

    let report: AnalyticsBatchReport | undefined;
    try {
      report = await runAnalyticsViewportBatch({
        page,
        queries,
        browser,
        viewport,
        modules,
      });
    } finally {
      if (report) writeBatchReport(report);
    }

    if (!report) {
      throw new Error(`Viewport batch produced no report for ${viewport}`);
    }

    const passed = report.results.filter((r) => r.status === 'passed').length;
    const failed = report.results.filter((r) => r.status === 'failed').length;
    const skipped = report.results.filter((r) => r.status === 'skipped').length;
    console.log(
      `[${viewport}] totals: passed=${passed} failed=${failed} skippedDup=${skipped} ` +
        `actualExec=${report.lifecycle.actualExecutions} pageRecoveries=${report.lifecycle.pageRecoveries} ` +
        `softFailures=${report.lifecycle.softFailures} durationMs=${report.durationMs}`,
    );

    const failures = report.results.filter((r) => r.status === 'failed');
    if (failures.length) {
      const preview = failures
        .slice(0, 20)
        .map((f) => `${f.id}/${f.module}: ${f.error}`)
        .join('\n');
      expect
        .soft(
          failures.length,
          `${failures.length} executed failure(s) in ${viewport} batch ` +
            `(pageLaunches=${report.lifecycle.pageLaunches}, pageRecoveries=${report.lifecycle.pageRecoveries}). ` +
            `First failures:\n${preview}`,
        )
        .toBe(0);
    }
  });
});
