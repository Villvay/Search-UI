import { expect, test } from '@playwright/test';
import { loadSecurityReviewConfig } from '../config';
import { findingsMatchingFailOn, writeSecurityReviewReports } from '../report';
import { runSecurityReview } from '../runReview';

test.describe('Passive security review @security-review', () => {
  test.describe.configure({ mode: 'serial', retries: 0 });

  test('browse the configured site and write a security report', async ({ browser }, testInfo) => {
    const config = loadSecurityReviewConfig();
    testInfo.annotations.push({
      type: 'target',
      description: config.baseURL,
    });
    test.setTimeout(Math.max(180_000, config.maxPages * 45_000));

    const report = await runSecurityReview({ browser, config });
    writeSecurityReviewReports(report, config.reportJsonPath, config.reportHtmlPath);

    await testInfo.attach('security-review-summary', {
      body: JSON.stringify(report.summary, null, 2),
      contentType: 'application/json',
    });

    expect(report.summary.baseURL, 'A target URL is required').toBeTruthy();
    expect(
      report.summary.pagesVisited + report.probes.length,
      'Review should probe or visit at least one URL',
    ).toBeGreaterThan(0);

    const failing = findingsMatchingFailOn(report.findings, config.failOn);
    expect(
      failing,
      failing
        .slice(0, 12)
        .map((item) => `[${item.severity}] ${item.title} — ${item.affectedUrls[0] ?? ''}`)
        .join('\n'),
    ).toEqual([]);
  });
});
