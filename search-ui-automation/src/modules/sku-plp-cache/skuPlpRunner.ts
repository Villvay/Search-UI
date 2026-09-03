/**
 * Sequential same-session SKU search runner.
 * One browser page searches every SKU in order so stale product-page cache can surface.
 * Failures do not abort the remaining SKUs.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { type ConsoleMessage, type Page, type Response } from '@playwright/test';
import {
  classifySkuFailure,
  validatePLPUrl,
  type CheckResult,
  type FailureCode,
} from './assertions/skuPlpAssertions';
import { skusMatch, type SkuDataset } from './data/skuLoader';
import { SkuPlpPage, productPathKey } from './pages/SkuPlpPage';

export type SkuSearchRow = {
  index: number;
  total: number;
  searchedSku: string;
  previousSku: string | null;
  searchCompleted: CheckResult;
  urlValidation: CheckResult;
  plpLoaded: CheckResult;
  skuMatch: CheckResult;
  overall: CheckResult;
  failureCode?: FailureCode;
  cacheBugSuspected: boolean;
  expectedUrl: string;
  actualUrl: string;
  expectedPlpSku: string;
  actualPlpSku: string | null;
  allDisplayedSkus: string[];
  landing: string;
  timestamp: string;
  durationMs: number;
  reason?: string;
  screenshot?: string;
  consoleMessages?: string[];
  networkErrors?: string[];
  sequenceSoFar: string[];
};

export type SkuPlpSummary = {
  totalSkus: number;
  uniqueSkus: number;
  passed: number;
  failed: number;
  urlMismatches: number;
  skuMismatches: number;
  timeouts: number;
  navigationFailures: number;
  plpNotLoaded: number;
  cacheBugsSuspected: number;
};

export type SkuPlpReport = {
  generatedAt: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  baseURL: string;
  dataset: string;
  uniqueSkus: string[];
  searchSequence: string[];
  environment?: string;
  browser?: string;
  viewport?: string;
  command?: string;
  runId?: string;
  summary: SkuPlpSummary;
  results: SkuSearchRow[];
};

const REPORTS_ROOT = path.join('reports', 'sku-plp');
let activeRunDir = '';

export function isoRunId(iso: string): string {
  return `${iso.slice(0, 19).replace(/:/g, '-')}Z`;
}

export function resolveRunDir(startedAt: string): string {
  if (activeRunDir) return activeRunDir;
  const runId = process.env.SKU_PLP_RUN_ID?.trim() || isoRunId(startedAt);
  activeRunDir = path.resolve(process.cwd(), REPORTS_ROOT, 'runs', runId);
  fs.mkdirSync(path.join(activeRunDir, 'screenshots'), { recursive: true });
  return activeRunDir;
}

export function reportJsonPath(): string {
  if (!activeRunDir) {
    throw new Error('SKU PLP report directory is not initialized');
  }
  return path.join(activeRunDir, 'sku_search_results.json');
}

export function reportMarkdownPath(): string {
  if (!activeRunDir) {
    throw new Error('SKU PLP report directory is not initialized');
  }
  return path.join(activeRunDir, 'sku_search_results.md');
}

function passFail(ok: boolean): CheckResult {
  return ok ? 'PASS' : 'FAIL';
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message.split('\n')[0] ?? error.message;
  return String(error);
}

function isTimeoutError(error: unknown): boolean {
  const message = formatError(error).toLowerCase();
  return message.includes('timeout') || message.includes('timed out');
}

export async function runSkuPlpCacheBatch(options: {
  page: Page;
  dataset: SkuDataset;
  screenshotDir?: string;
  environment?: string;
  browser?: string;
  viewport?: string;
  command?: string;
}): Promise<SkuPlpReport> {
  const { page, dataset } = options;
  const startedAt = new Date().toISOString();
  const runDir = resolveRunDir(startedAt);
  const screenshotDir = path.join(runDir, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const skuPage = new SkuPlpPage(page);
  const wallStart = Date.now();
  const results: SkuSearchRow[] = [];
  const sequence = dataset.searchSequence;

  await skuPage.open();

  let previousSku: string | null = null;
  let previousProductUrl: string | null = null;

  for (let i = 0; i < sequence.length; i += 1) {
    const sku = sequence[i];
    const index = i + 1;
    const label = `[${index}/${sequence.length}]`;
    console.log(`${label} Searching SKU: ${sku}`);

    const row = await runOneSku({
      skuPage,
      page,
      sku,
      index,
      total: sequence.length,
      previousSku,
      previousProductUrl,
      sequenceSoFar: previousSku ? [previousSku, sku] : [sku],
      screenshotDir,
    });

    results.push(row);
    console.log(`${label} URL: ${row.actualUrl}`);
    console.log(`${label} PLP SKU: ${row.actualPlpSku ?? '(none)'}`);
    if (row.overall === 'PASS') {
      console.log(`${label} PASS`);
    } else if (row.cacheBugSuspected) {
      console.log(`${label} FAIL — stale PLP detected`);
    } else {
      console.log(`${label} FAIL — ${row.failureCode ?? row.reason ?? 'unknown'}`);
    }

    previousSku = sku;
    if (productPathKey(row.actualUrl)) {
      previousProductUrl = row.actualUrl;
    } else if (row.landing !== 'product') {
      previousProductUrl = null;
    }

    if (index === 1 || index === sequence.length || index % 25 === 0) {
      writeProgressSnapshot({
        page,
        dataset,
        options,
        startedAt,
        wallStart,
        sequence,
        results,
        generateDashboard: index === sequence.length || index % 200 === 0,
      });
    }
  }

  const finishedAt = new Date().toISOString();
  const report: SkuPlpReport = {
    generatedAt: finishedAt,
    startedAt,
    finishedAt,
    durationMs: Date.now() - wallStart,
    baseURL: page.url() ? new URL(page.url()).origin : '',
    dataset: path.relative(process.cwd(), dataset.sourcePath) || dataset.sourcePath,
    uniqueSkus: dataset.uniqueSkus,
    searchSequence: sequence,
    environment: options.environment,
    browser: options.browser,
    viewport: options.viewport,
    command: options.command,
    runId: path.basename(activeRunDir),
    summary: summarize(results, dataset.uniqueSkus.length),
    results,
  };

  writeReports(report);
  return report;
}

async function runOneSku(options: {
  skuPage: SkuPlpPage;
  page: Page;
  sku: string;
  index: number;
  total: number;
  previousSku: string | null;
  previousProductUrl: string | null;
  sequenceSoFar: string[];
  screenshotDir: string;
}): Promise<SkuSearchRow> {
  const {
    skuPage,
    page,
    sku,
    index,
    total,
    previousSku,
    previousProductUrl,
    sequenceSoFar,
    screenshotDir,
  } = options;

  const started = Date.now();
  const timestamp = new Date().toISOString();
  const consoleMessages: string[] = [];
  const networkErrors: string[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`.slice(0, 300));
    }
  };
  const onResponse = (response: Response) => {
    if (response.status() >= 400) {
      const url = response.url();
      if (/\/search|\/product|\/suggestions/i.test(url)) {
        networkErrors.push(`${response.status()} ${url}`.slice(0, 300));
      }
    }
  };

  page.on('console', onConsole);
  page.on('response', onResponse);

  const row: SkuSearchRow = {
    index,
    total,
    searchedSku: sku,
    previousSku,
    searchCompleted: 'FAIL',
    urlValidation: 'FAIL',
    plpLoaded: 'FAIL',
    skuMatch: 'FAIL',
    overall: 'FAIL',
    cacheBugSuspected: false,
    expectedUrl: `/search?q=${encodeURIComponent(sku)} or /product/{id}/{slug}`,
    actualUrl: page.url(),
    expectedPlpSku: sku,
    actualPlpSku: null,
    allDisplayedSkus: [],
    landing: 'unknown',
    timestamp,
    durationMs: 0,
    sequenceSoFar,
  };

  try {
    const urlBefore = page.url();
    await skuPage.searchSku(sku);
    row.searchCompleted = 'PASS';

    await skuPage.waitForLandingToSettle(sku, urlBefore);
    const snap = await skuPage.snapshotLanding(sku);
    row.actualUrl = snap.url;
    row.landing = snap.landing;
    row.actualPlpSku = snap.displayedSku;
    row.allDisplayedSkus = snap.allDisplayedSkus;

    const urlCheck = validatePLPUrl(
      snap.url,
      sku,
      previousProductUrl,
      previousSku,
    );
    row.expectedUrl = urlCheck.expectedUrl;
    row.urlValidation = passFail(urlCheck.ok);

    const plpLoaded =
      (snap.landing === 'product' && snap.displayedSku != null) ||
      (snap.landing === 'search' &&
        !snap.hasNoResults &&
        (snap.hasSearchResultsHeading ||
          snap.productTitleCount > 0 ||
          snap.displayedSku != null));
    row.plpLoaded = passFail(plpLoaded);

    const skuOk =
      skusMatch(snap.displayedSku, sku) ||
      (snap.landing === 'search' &&
        snap.allDisplayedSkus.some((displayed) => skusMatch(displayed, sku)));
    row.skuMatch = passFail(skuOk);

    const cacheBugSuspected = isCacheBug({
      searchedSku: sku,
      previousSku,
      actualSku: snap.displayedSku,
      urlStale: urlCheck.stalePreviousUrl,
    });
    row.cacheBugSuspected = cacheBugSuspected;

    const overall =
      row.searchCompleted === 'PASS' &&
      row.urlValidation === 'PASS' &&
      row.plpLoaded === 'PASS' &&
      row.skuMatch === 'PASS';
    row.overall = passFail(overall);

    if (!overall) {
      row.failureCode = classifySkuFailure({
        searchCompleted: true,
        timedOut: false,
        landing: snap.landing,
        urlOk: urlCheck.ok,
        plpLoaded,
        displayedSku: snap.displayedSku,
        skuOk,
        cacheBugSuspected,
        elementMissing: snap.displayedSku == null && snap.landing === 'product',
      });
      row.reason = cacheBugSuspected
        ? 'Newly searched SKU loaded the previously searched PLP.'
        : urlCheck.reason ||
          (skuOk
            ? urlCheck.reason
            : `Expected PLP SKU ${sku}, got ${snap.displayedSku ?? '(none)'}`);
      row.screenshot = await captureFailureScreenshot(
        page,
        screenshotDir,
        index,
        sku,
      );
    }
  } catch (error) {
    const timedOut = isTimeoutError(error);
    row.actualUrl = page.url();
    row.failureCode = classifySkuFailure({
      searchCompleted: row.searchCompleted === 'PASS',
      timedOut,
      landing: 'unknown',
      urlOk: false,
      plpLoaded: false,
      displayedSku: null,
      skuOk: false,
      cacheBugSuspected: false,
      elementMissing: /locator|element|strict/i.test(formatError(error)),
    });
    row.reason = formatError(error);
    row.cacheBugSuspected = isCacheBug({
      searchedSku: sku,
      previousSku,
      actualSku: row.actualPlpSku,
      urlStale: productPathKey(row.actualUrl) === productPathKey(previousProductUrl ?? ''),
    });
    if (row.cacheBugSuspected) {
      row.reason = 'Newly searched SKU loaded the previously searched PLP.';
    }
    row.screenshot = await captureFailureScreenshot(
      page,
      screenshotDir,
      index,
      sku,
    );
  } finally {
    page.off('console', onConsole);
    page.off('response', onResponse);
    row.durationMs = Date.now() - started;
    if (consoleMessages.length) {
      row.consoleMessages = consoleMessages.slice(-20);
    }
    if (networkErrors.length) {
      row.networkErrors = networkErrors.slice(-20);
    }
  }

  return row;
}

function isCacheBug(input: {
  searchedSku: string;
  previousSku: string | null;
  actualSku: string | null;
  urlStale: boolean;
}): boolean {
  if (!input.previousSku) return input.urlStale;
  if (skusMatch(input.searchedSku, input.previousSku)) return false;
  if (input.urlStale) return true;
  return skusMatch(input.actualSku, input.previousSku);
}

async function captureFailureScreenshot(
  page: Page,
  dir: string,
  index: number,
  sku: string,
): Promise<string | undefined> {
  const raw = process.env.SKU_SCREENSHOTS?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no') return undefined;
  const safeSku = sku.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 40);
  const file = path.join(dir, `${String(index).padStart(3, '0')}-${safeSku}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true });
    return path.relative(process.cwd(), file);
  } catch {
    return undefined;
  }
}

function summarize(results: SkuSearchRow[], uniqueCount: number): SkuPlpSummary {
  const failed = results.filter((r) => r.overall === 'FAIL');
  return {
    totalSkus: results.length,
    uniqueSkus: uniqueCount,
    passed: results.filter((r) => r.overall === 'PASS').length,
    failed: failed.length,
    urlMismatches: results.filter((r) => r.urlValidation === 'FAIL').length,
    skuMismatches: results.filter((r) => r.skuMatch === 'FAIL').length,
    timeouts: results.filter((r) => r.failureCode === 'TIMEOUT').length,
    navigationFailures: results.filter((r) => r.failureCode === 'NAVIGATION_FAILED')
      .length,
    plpNotLoaded: results.filter((r) => r.failureCode === 'PLP_NOT_LOADED').length,
    cacheBugsSuspected: results.filter((r) => r.cacheBugSuspected).length,
  };
}

function writeProgressSnapshot(input: {
  page: Page;
  dataset: SkuDataset;
  options: {
    environment?: string;
    browser?: string;
    viewport?: string;
    command?: string;
  };
  startedAt: string;
  wallStart: number;
  sequence: string[];
  results: SkuSearchRow[];
  generateDashboard: boolean;
}): void {
  const finishedAt = new Date().toISOString();
  const report: SkuPlpReport = {
    generatedAt: finishedAt,
    startedAt: input.startedAt,
    finishedAt,
    durationMs: Date.now() - input.wallStart,
    baseURL: input.page.url() ? new URL(input.page.url()).origin : '',
    dataset:
      path.relative(process.cwd(), input.dataset.sourcePath) ||
      input.dataset.sourcePath,
    uniqueSkus: input.generateDashboard ? input.dataset.uniqueSkus : [],
    searchSequence: input.results.map((row) => row.searchedSku),
    environment: input.options.environment,
    browser: input.options.browser,
    viewport: input.options.viewport,
    command: input.options.command,
    runId: path.basename(activeRunDir),
    summary: summarize(input.results, input.dataset.uniqueSkus.length),
    results: input.results,
  };
  writeReports(report, { generateDashboard: input.generateDashboard, quiet: true });
}

export function writeReports(
  report: SkuPlpReport,
  opts?: { generateDashboard?: boolean; quiet?: boolean },
): void {
  const jsonPath = reportJsonPath();
  const mdPath = reportMarkdownPath();
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(report, null, opts?.quiet ? 0 : 2),
  );
  if (!opts?.quiet || opts?.generateDashboard) {
    fs.writeFileSync(mdPath, renderMarkdown(report));
  }
  if (!opts?.quiet) {
    console.log('');
    console.log(`Wrote ${path.relative(process.cwd(), jsonPath)}`);
    console.log(`Wrote ${path.relative(process.cwd(), mdPath)}`);
  }
  if (opts?.generateDashboard !== false) {
    generateDashboardHtml();
  }
  if (!opts?.quiet) {
    logSummary(report.summary);
  }
}

function generateDashboardHtml(): void {
  const script = path.resolve(
    process.cwd(),
    'scripts',
    'generate-sku-plp-dashboard.mjs',
  );
  if (!fs.existsSync(script) || !activeRunDir) return;
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      SKU_PLP_REPORT_DIR: activeRunDir,
    },
  });
  if (result.status !== 0) {
    console.warn('SKU PLP dashboard generation exited', result.status);
  }
}

function logSummary(summary: SkuPlpSummary): void {
  console.log('');
  console.log(`Total SKUs     : ${summary.totalSkus}`);
  console.log(`Passed         : ${summary.passed}`);
  console.log(`Failed         : ${summary.failed}`);
  console.log(`URL mismatches : ${summary.urlMismatches}`);
  console.log(`SKU mismatches : ${summary.skuMismatches}`);
  console.log(`Timeouts       : ${summary.timeouts}`);
  console.log(`Cache/stale    : ${summary.cacheBugsSuspected}`);
  console.log('');
}

function renderMarkdown(report: SkuPlpReport): string {
  const s = report.summary;
  const lines: string[] = [];
  lines.push('# SKU search → PLP cache validation');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('```text');
  lines.push(`Total SKUs     : ${s.totalSkus}`);
  lines.push(`Passed         : ${s.passed}`);
  lines.push(`Failed         : ${s.failed}`);
  lines.push(`URL mismatches : ${s.urlMismatches}`);
  lines.push(`SKU mismatches : ${s.skuMismatches}`);
  lines.push(`Timeouts       : ${s.timeouts}`);
  lines.push(`Cache/stale    : ${s.cacheBugsSuspected}`);
  lines.push('```');
  lines.push('');
  const seqPreview =
    report.searchSequence.length <= 20
      ? report.searchSequence.join(' → ')
      : `${report.searchSequence.slice(0, 12).join(' → ')} … (${report.searchSequence.length} total)`;
  lines.push(`Dataset: \`${report.dataset}\``);
  lines.push(`Sequence: ${seqPreview}`);
  lines.push('');

  const stale = report.results.filter((r) => r.cacheBugSuspected);
  const stalePreview = stale.slice(0, 50);
  if (stale.length) {
    lines.push('## Cache / stale PLP failures');
    lines.push('');
    if (stale.length > stalePreview.length) {
      lines.push(
        `Showing first ${stalePreview.length} of ${stale.length} stale/cache failures.`,
      );
      lines.push('');
    }
    for (const row of stalePreview) {
      lines.push('```text');
      lines.push('FAIL — Cache/Stale PLP suspected');
      lines.push('');
      lines.push(`Previous SKU : ${row.previousSku ?? '(none)'}`);
      lines.push(`Searched SKU : ${row.searchedSku}`);
      lines.push('');
      lines.push(`Expected PLP SKU : ${row.expectedPlpSku}`);
      lines.push(`Actual PLP SKU   : ${row.actualPlpSku ?? '(none)'}`);
      lines.push('');
      lines.push(`Expected URL : ${row.expectedUrl}`);
      lines.push(`Actual URL   : ${row.actualUrl}`);
      lines.push('');
      lines.push(`Reason: ${row.reason ?? 'Newly searched SKU loaded the previously searched PLP.'}`);
      if (row.screenshot) lines.push(`Screenshot: ${row.screenshot}`);
      lines.push('```');
      lines.push('');
    }
  }

  lines.push('## All results');
  lines.push('');
  if (report.results.length > 300) {
    lines.push(
      `Table omitted (${report.results.length} rows). See \`sku_search_results.json\`.`,
    );
    lines.push('');
    return lines.join('\n');
  }
  lines.push('| # | Searched | Previous | URL | PLP SKU | Overall | Code | Cache |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const row of report.results) {
    lines.push(
      `| ${row.index} | ${row.searchedSku} | ${row.previousSku ?? ''} | ${row.urlValidation} | ${row.skuMatch} | ${row.overall} | ${row.failureCode ?? ''} | ${row.cacheBugSuspected ? 'YES' : ''} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}
