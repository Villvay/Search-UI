const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { loadCatalog, resolveSite } = require('../lib/catalog');
const {
  openHome,
  readSnapshot,
  waitForLanding,
  searchSku,
  classifySearch,
  classifyHistory,
  describePage,
  showsRecord,
  isNoise,
  productIdFromUrl,
} = require('../lib/observe');
const { writeCsv, writeSummary, summarize } = require('../lib/report');
const { datasetVersion, recordRun } = require('../lib/versions');

const site = resolveSite();
const REPORT_DIR = site.reportDir;
const CSV_PATH = path.join(REPORT_DIR, 'lac-sku-cache-report.csv');
const SUMMARY_PATH = path.join(REPORT_DIR, 'lac-sku-cache-summary.json');
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');

function safeName(sku) {
  return String(sku).replace(/[^A-Za-z0-9._-]+/g, '_');
}

function attachCollectors(page) {
  const bucket = { consoleErrors: [], networkErrors: [] };
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!isNoise(text)) bucket.consoleErrors.push(text.slice(0, 400));
  });
  page.on('pageerror', (error) => {
    bucket.consoleErrors.push(String(error && error.message ? error.message : error).slice(0, 400));
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const url = response.url();
    const type = response.request().resourceType();
    if (type === 'image' || type === 'font' || type === 'stylesheet' || type === 'media') return;
    if (isNoise(url)) return;
    bucket.networkErrors.push(`${response.status()} ${type} ${url.slice(0, 220)}`);
  });
  return {
    take() {
      const snapshot = {
        consoleErrors: bucket.consoleErrors.splice(0),
        networkErrors: bucket.networkErrors.splice(0),
      };
      return snapshot;
    },
  };
}

async function settle(page, ms = 1500) {
  const started = Date.now();
  let last = page.url();
  let lastChange = started;
  while (Date.now() - started < 5000) {
    await page.waitForTimeout(150);
    const current = page.url();
    if (current !== last) {
      last = current;
      lastChange = Date.now();
      continue;
    }
    if (Date.now() - lastChange >= ms) return;
  }
}

test('sequential SKU search cache and navigation on Würth LAC', async ({ page }) => {
  test.setTimeout(50 * 60 * 1000);
  const { sourcePath, skus } = loadCatalog();
  fs.rmSync(SCREENSHOT_DIR, { recursive: true, force: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const rows = [];
  const collector = attachCollectors(page);

  const persist = () => {
    writeCsv(CSV_PATH, rows);
  };

  await openHome(page);
  collector.take();

  let previous = null;
  const repeatIndexes = new Set(
    [0, 1, 2, 24, 49, 74, 98, skus.length - 1].filter((index) => index >= 0 && index < skus.length),
  );

  for (let index = 0; index < skus.length; index += 1) {
    const record = skus[index];
    const label = `[${index + 1}/${skus.length}]`;
    console.log(`${label} Searching ${record.sku}`);
    const events = collector.take();
    let row;
    try {
      const { typed, urlBefore } = await searchSku(page, record.sku);
      const landing = await waitForLanding(page, {
        sku: record.sku,
        expectedProductId: record.productId,
        previousProductId: previous ? previous.productId : '',
        urlBefore,
      });
      const snap = await readSnapshot(page);
      const during = collector.take();
      row = classifySearch({
        sku: record.sku,
        record,
        previous,
        url: page.url(),
        snap,
        landing,
        consoleErrors: [...events.consoleErrors, ...during.consoleErrors],
        networkErrors: [...events.networkErrors, ...during.networkErrors],
      });
      if (typed && typed.toUpperCase() !== record.sku.toUpperCase()) {
        row.Status = 'Fail';
        row.severity = row.severity || 'Medium';
        row.signature = row.signature === 'ok' ? 'input-type' : row.signature;
        row['Cache issue'] = `${row['Cache issue']} Medium: search field accepted "${typed}" for ${record.sku}`.trim();
        row['Error details'] =
          `Previous SKU: ${previous ? previous.sku : 'none'}. Current SKU: ${record.sku}. ${row['Error details']}`.trim();
      }
      row.snap = snap;
      row.record = record;
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      row = {
        SKU: record.sku,
        'Search query': record.sku,
        'Expected page': record.productId ? `PLP /product/${record.productId}` : 'PLP or SRP',
        'Actual page': describePage(page.url(), { visibleItem: null, heading: '' }),
        'Cache issue': 'Medium: search could not be completed',
        'Error details': `Previous SKU: ${previous ? previous.sku : 'none'}. Current SKU: ${record.sku}. ${message}`,
        Status: 'Fail',
        severity: 'Medium',
        signature: 'search-failed',
        kind: 'search',
        url: page.url(),
        consoleErrors: [],
        networkErrors: [],
      };
    }

    if (row.Status === 'Fail') {
      const file = path.join(SCREENSHOT_DIR, `${String(index + 1).padStart(3, '0')}-${safeName(record.sku)}.png`);
      await page.screenshot({ path: file, fullPage: false }).catch(() => undefined);
      row['Error details'] = `${row['Error details']} Screenshot: ${path.relative(REPORT_DIR, file)}`.trim();
    }

    rows.push(row);
    persist();
    console.log(`${label} ${row.Status} ${row['Actual page']}`);
    previous = record;

    const historyAt = new Set([2, Math.min(49, skus.length - 1)].filter((point) => point > 0));
    if (historyAt.has(index)) {
      rows.push(await historyCheck(page, 'back', skus[index - 1] || null, record, collector));
      rows.push(await historyCheck(page, 'forward', skus[index - 1] || null, record, collector));
      persist();
    }
  }

  for (const index of [...repeatIndexes].sort((a, b) => a - b)) {
    const record = skus[index];
    const original = rows.find((row) => row.kind === 'search' && row.SKU === record.sku);
    console.log(`Repeat ${record.sku}`);
    const previousRecord = index > 0 ? skus[index - 1] : null;
    try {
      const { urlBefore } = await searchSku(page, record.sku);
      const landing = await waitForLanding(page, {
        sku: record.sku,
        expectedProductId: record.productId,
        previousProductId: previous ? previous.productId : '',
        urlBefore,
      });
      const during = collector.take();
      const snap = await readSnapshot(page);
      const row = classifySearch({
        sku: record.sku,
        record,
        previous,
        url: page.url(),
        snap,
        landing,
        consoleErrors: during.consoleErrors,
        networkErrors: during.networkErrors,
      });
      row.kind = 'repeat';
      row['Search query'] = `${record.sku} (repeat)`;
      row.originalSignature = original ? original.signature : '';
      row.originalStatus = original ? original.Status : '';
      if (original && original.signature === row.signature && row.Status === 'Fail') {
        row['Error details'] =
          `${row['Error details']} Repeat matched the original failure (${row.signature}); reproducible in this session.`.trim();
      } else if (original && original.Status === 'Fail' && row.Status === 'Pass') {
        row.intermittentClear = true;
        row['Error details'] =
          `Previous SKU: ${previous ? previous.sku : 'none'}. Current SKU: ${record.sku}. Repeat displayed the correct page after an earlier failure.`.trim();
      }
      if (row.Status === 'Fail') {
        const file = path.join(SCREENSHOT_DIR, `repeat-${safeName(record.sku)}.png`);
        await page.screenshot({ path: file, fullPage: false }).catch(() => undefined);
        row['Error details'] = `${row['Error details']} Screenshot: ${path.relative(REPORT_DIR, file)}`.trim();
      }
      rows.push(row);
      previous = record;
      console.log(`Repeat ${record.sku} ${row.Status} ${row['Actual page']}`);
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      rows.push({
        SKU: record.sku,
        'Search query': `${record.sku} (repeat)`,
        'Expected page': `PLP /product/${record.productId}`,
        'Actual page': page.url(),
        'Cache issue': 'Medium: repeat search could not be completed',
        'Error details': `Previous SKU: ${previousRecord ? previousRecord.sku : 'none'}. Current SKU: ${record.sku}. ${message}`,
        Status: 'Fail',
        severity: 'Medium',
        signature: 'search-failed',
        kind: 'repeat',
        consoleErrors: [],
        networkErrors: [],
      });
    }
    persist();
  }

  const last = rows.filter((row) => row.kind === 'search').at(-1);
  if (last) {
    console.log('Refreshing the current page');
    const before = await readSnapshot(page);
    const beforeUrl = page.url();
    const beforeId = productIdFromUrl(beforeUrl);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page, 800);
    const after = await readSnapshot(page);
    const afterUrl = page.url();
    const afterId = productIdFromUrl(afterUrl);
    const urlRecord = skus.find((item) => item.productId === afterId) || null;
    const contentMatchesUrl = !urlRecord || showsRecord(afterUrl, after, urlRecord);
    const showsSearchedSku = last.record ? showsRecord(afterUrl, after, last.record) : false;
    let cacheIssue = '';
    let severity = '';
    if (!contentMatchesUrl) {
      severity = 'High';
      cacheIssue = `High: refresh left content that does not match the URL for ${last.SKU}`;
    } else if (!showsSearchedSku) {
      severity = 'Medium';
      cacheIssue = `Medium: refresh reloaded ${beforeId === afterId ? 'the same' : 'a'} product URL and still does not show ${last.SKU}`;
    }
    const refreshRow = {
      SKU: last.SKU,
      'Search query': 'refresh',
      'Expected page': last['Expected page'],
      'Actual page': describePage(afterUrl, after),
      'Cache issue': cacheIssue,
      'Error details': `Previous SKU: ${skus.length > 1 ? skus[skus.length - 2].sku : 'none'}. Current SKU: ${last.SKU}. URL before refresh: ${beforeUrl}. URL after refresh: ${afterUrl}. Item before: ${before.visibleItem || 'none'}. Item after: ${after.visibleItem || 'none'}.`,
      Status: severity ? 'Fail' : 'Pass',
      severity,
      signature: severity ? 'refresh' : 'ok',
      kind: 'refresh',
      refreshResolved: showsSearchedSku,
      url: afterUrl,
      consoleErrors: collector.take().consoleErrors,
      networkErrors: [],
    };
    if (severity) {
      const file = path.join(SCREENSHOT_DIR, `refresh-${safeName(last.SKU)}.png`);
      await page.screenshot({ path: file, fullPage: false }).catch(() => undefined);
      refreshRow['Error details'] += ` Screenshot: ${path.relative(REPORT_DIR, file)}`;
    }
    rows.push(refreshRow);
    console.log(`Refresh ${refreshRow.Status} ${refreshRow['Actual page']}`);

    const followUp = [skus[skus.length - 1], skus[0]].filter(Boolean);
    for (const record of followUp) {
      console.log(`After refresh ${record.sku}`);
      try {
        const { urlBefore } = await searchSku(page, record.sku);
        const landing = await waitForLanding(page, {
          sku: record.sku,
          expectedProductId: record.productId,
          previousProductId: previous ? previous.productId : '',
          urlBefore,
        });
        const during = collector.take();
        const snap = await readSnapshot(page);
        const row = classifySearch({
          sku: record.sku,
          record,
          previous,
          url: page.url(),
          snap,
          landing,
          consoleErrors: during.consoleErrors,
          networkErrors: during.networkErrors,
        });
        row.kind = 'after-refresh';
        row['Search query'] = `${record.sku} (after refresh)`;
        if (row.Status === 'Fail') {
          const file = path.join(SCREENSHOT_DIR, `after-refresh-${safeName(record.sku)}.png`);
          await page.screenshot({ path: file, fullPage: false }).catch(() => undefined);
          row['Error details'] = `${row['Error details']} Screenshot: ${path.relative(REPORT_DIR, file)}`.trim();
        }
        rows.push(row);
        previous = record;
        console.log(`After refresh ${record.sku} ${row.Status} ${row['Actual page']}`);
      } catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        rows.push({
          SKU: record.sku,
          'Search query': `${record.sku} (after refresh)`,
          'Expected page': `PLP /product/${record.productId}`,
          'Actual page': page.url(),
          'Cache issue': 'Medium: search after refresh could not be completed',
          'Error details': `Previous SKU: ${previous ? previous.sku : 'none'}. Current SKU: ${record.sku}. ${message}`,
          Status: 'Fail',
          severity: 'Medium',
          signature: 'search-failed',
          kind: 'after-refresh',
          consoleErrors: [],
          networkErrors: [],
        });
      }
    }
    persist();
  }

  const summary = summarize(rows);
  const dataset = datasetVersion(site.key);
  const generatedAt = new Date().toISOString();
  const run = recordRun({
    site: site.key,
    createdAt: generatedAt,
    datasetVersion: dataset.version,
    datasetCreatedAt: dataset.createdAt,
    skuCount: skus.length,
    passed: summary.passed,
    failed: summary.failed,
    reportDir: site.reportDir,
  });
  writeSummary(SUMMARY_PATH, summary, {
    generatedAt,
    site: site.url,
    label: site.label,
    dataset: sourcePath,
    moduleVersion: dataset.moduleVersion,
    moduleCreatedAt: dataset.moduleCreatedAt,
    datasetVersion: dataset.version,
    datasetCreatedAt: dataset.createdAt,
    runVersion: run.version,
    csv: CSV_PATH,
  });
  persist();
  console.log(JSON.stringify(summary, null, 2));

  expect(summary.failed, 'SKU searches that failed').toBe(0);
  expect(summary.high, 'high cache defects').toBe(0);
});

async function historyCheck(page, action, previous, current, collector) {
  const before = { url: page.url(), snap: await readSnapshot(page) };
  const navigation =
    action === 'back'
      ? page.goBack({ waitUntil: 'domcontentloaded' })
      : page.goForward({ waitUntil: 'domcontentloaded' });
  await navigation.catch(() => undefined);
  await settle(page, 800);
  const after = { url: page.url(), snap: await readSnapshot(page) };
  const events = collector.take();
  const row = classifyHistory({
    action,
    previous,
    current,
    before,
    after,
    consoleErrors: events.consoleErrors,
  });
  if (row.Status === 'Fail') {
    const file = path.join(
      SCREENSHOT_DIR,
      `${action}-${safeName(current ? current.sku : 'page')}.png`,
    );
    await page.screenshot({ path: file, fullPage: false }).catch(() => undefined);
    row['Error details'] = `${row['Error details']} Screenshot: ${path.relative(REPORT_DIR, file)}`.trim();
  }
  console.log(`History ${action} ${row.Status} ${row['Actual page']}`);
  return row;
}
