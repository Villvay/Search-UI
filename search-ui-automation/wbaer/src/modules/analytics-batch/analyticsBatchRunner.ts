/**
 * Viewport-batched analytics execution helpers.
 * One page runs all queries for selected modules; failures do not abort the batch.
 *
 * Optimizations (analytics-only — functional specs untouched):
 * - Execute-once dedupe by normalized query text (report every original ID)
 * - Soft ON-ENTER failures stay on SERP (no home navigation)
 * - Hard recovery only when the page is unusable
 */
import { type Locator, type Page, expect } from '@playwright/test';
import {
  normalizeAnalyticsQueryKey,
  parseAnalyticsModules,
  type AnalyticsModuleId,
  type AnalyticsQuery,
} from '../../core/utils/analyticsQueryLoader';
import { ON_TYPE_BEHAVIOR, ON_TYPE_COPY } from '../on-type/data/behavior';
import { OnTypeSearchPage } from '../on-type/pages/OnTypeSearchPage';
import { SUGGESTIONS_BEHAVIOR } from '../suggestions/data/behavior';
import { SuggestionsPage } from '../suggestions/pages/SuggestionsPage';
import { expectSerpProductsMatchAnalyticsQuery } from '../on-enter/assertions/onEnterAnalyticsAssertions';
import { ON_ENTER_BEHAVIOR } from '../on-enter/data/behavior';
import {
  OnEnterSearchPage,
  queriesMatch,
} from '../on-enter/pages/OnEnterSearchPage';

export type { AnalyticsModuleId };

export type AnalyticsQueryResult = {
  id: string;
  query: string;
  module: AnalyticsModuleId;
  browser: string;
  viewport: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
  url?: string;
  recovered?: boolean;
  meta?: Record<string, string | number | boolean>;
};

export type AnalyticsBatchLifecycle = {
  browserLaunches: number;
  contextLaunches: number;
  pageLaunches: number;
  /** @deprecated Prefer pageRecoveries — kept for older report consumers. */
  pageRecovers: number;
  pageRecoveries: number;
  softFailures: number;
  hardFailures: number;
  homeNavigations: number;
  reloadRecoveries: number;
  datasetRows: number;
  uniqueNormalizedQueries: number;
  duplicateRows: number;
  actualExecutions: number;
  deduplicatedExecutions: number;
};

export type AnalyticsBatchReport = {
  browser: string;
  viewport: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  queryCount: number;
  modules: AnalyticsModuleId[];
  lifecycle: AnalyticsBatchLifecycle;
  results: AnalyticsQueryResult[];
};

function createLifecycle(datasetRows: number): AnalyticsBatchLifecycle {
  return {
    browserLaunches: 1,
    contextLaunches: 1,
    pageLaunches: 1,
    pageRecovers: 0,
    pageRecoveries: 0,
    softFailures: 0,
    hardFailures: 0,
    homeNavigations: 0,
    reloadRecoveries: 0,
    datasetRows,
    uniqueNormalizedQueries: 0,
    duplicateRows: 0,
    actualExecutions: 0,
    deduplicatedExecutions: 0,
  };
}

function logBatchHeader(
  browser: string,
  viewport: string,
  datasetRows: number,
  uniqueCount: number,
  modules: AnalyticsModuleId[],
): void {
  console.log('');
  console.log('========================================');
  console.log(`Browser: ${browser}`);
  console.log(`Viewport: ${viewport}`);
  console.log(`Dataset rows: ${datasetRows}`);
  console.log(`Unique normalized queries: ${uniqueCount}`);
  console.log(`Modules: ${modules.join(',')}`);
  console.log('========================================');
  console.log('');
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message.split('\n')[0] ?? error.message;
  return String(error);
}

function countUniqueNormalized(queries: AnalyticsQuery[]): number {
  return new Set(queries.map((q) => normalizeAnalyticsQueryKey(q.query))).size;
}

function cloneAsDeduped(
  canonical: AnalyticsQueryResult,
  item: AnalyticsQuery,
): AnalyticsQueryResult {
  return {
    id: item.id,
    query: item.query,
    module: canonical.module,
    browser: canonical.browser,
    viewport: canonical.viewport,
    status: 'skipped',
    durationMs: 0,
    error: canonical.error,
    url: canonical.url,
    meta: {
      ...(canonical.meta || {}),
      execution: 'SKIPPED_DUPLICATE',
      normalizedQuery: normalizeAnalyticsQueryKey(item.query),
      canonicalId: canonical.id,
      canonicalStatus: canonical.status,
      canonicalDurationMs: canonical.durationMs,
      deduplicated: true,
    },
  };
}

async function isSearchInputUsable(input: Locator): Promise<boolean> {
  try {
    const page = input.page();
    if (page.isClosed()) return false;
    const visible = await input.isVisible().catch(() => false);
    if (!visible) return false;
    const enabled = await input.isEnabled().catch(() => false);
    return enabled;
  } catch {
    return false;
  }
}

async function hardRecover(options: {
  page: Page;
  openHome: () => Promise<void>;
  lifecycle: AnalyticsBatchLifecycle;
}): Promise<boolean> {
  const { page, openHome, lifecycle } = options;
  lifecycle.hardFailures += 1;
  try {
    await openHome();
    lifecycle.homeNavigations += 1;
    lifecycle.pageRecoveries += 1;
    lifecycle.pageRecovers += 1;
    return true;
  } catch {
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      lifecycle.reloadRecoveries += 1;
      await openHome();
      lifecycle.homeNavigations += 1;
      lifecycle.pageRecoveries += 1;
      lifecycle.pageRecovers += 1;
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Soft failure path: stay on page and reset search when possible.
 * Hard recovery only if the search input is unusable.
 */
async function handleAnalyticsFailure(options: {
  page: Page;
  input: Locator;
  softReset: () => Promise<void>;
  openHome: () => Promise<void>;
  lifecycle: AnalyticsBatchLifecycle;
}): Promise<{ recovered: boolean; hard: boolean }> {
  const { page, input, softReset, openHome, lifecycle } = options;

  const usable = await isSearchInputUsable(input);
  if (usable) {
    try {
      await softReset();
      lifecycle.softFailures += 1;
      return { recovered: false, hard: false };
    } catch {
      // fall through to hard recovery
    }
  }

  const ok = await hardRecover({ page, openHome, lifecycle });
  return { recovered: ok, hard: true };
}

type ExecuteOne = (
  item: AnalyticsQuery,
  execIndex: number,
  execTotal: number,
) => Promise<AnalyticsQueryResult>;

async function runDedupedModuleBatch(options: {
  queries: AnalyticsQuery[];
  browser: string;
  viewport: string;
  module: AnalyticsModuleId;
  lifecycle: AnalyticsBatchLifecycle;
  executeOne: ExecuteOne;
}): Promise<AnalyticsQueryResult[]> {
  const { queries, module, lifecycle, executeOne } = options;
  const results: AnalyticsQueryResult[] = [];
  const canonicalByKey = new Map<string, AnalyticsQueryResult>();
  const uniqueTotal = countUniqueNormalized(queries);
  let execIndex = 0;

  for (const item of queries) {
    const key = normalizeAnalyticsQueryKey(item.query);
    const existing = canonicalByKey.get(key);
    if (existing) {
      lifecycle.deduplicatedExecutions += 1;
      const dup = cloneAsDeduped(existing, item);
      console.log(
        `[dup] ${item.id} ${module.toUpperCase()} "${item.query}" → SKIPPED_DUPLICATE of ${existing.id} (${existing.status})`,
      );
      results.push(dup);
      continue;
    }

    execIndex += 1;
    lifecycle.actualExecutions += 1;
    const result = await executeOne(item, execIndex, uniqueTotal);
    canonicalByKey.set(key, result);
    results.push(result);
  }

  return results;
}

export async function runOnTypeBatch(options: {
  page: Page;
  queries: AnalyticsQuery[];
  browser: string;
  viewport: string;
  lifecycle: AnalyticsBatchLifecycle;
}): Promise<AnalyticsQueryResult[]> {
  const { page, queries, browser, viewport, lifecycle } = options;
  const onType = new OnTypeSearchPage(page);

  await onType.open();
  lifecycle.homeNavigations += 1;

  return runDedupedModuleBatch({
    queries,
    browser,
    viewport,
    module: 'on-type',
    lifecycle,
    executeOne: async (item, execIndex, execTotal): Promise<AnalyticsQueryResult> => {
      console.log(
        `[${execIndex}/${execTotal}] ${item.id} ON-TYPE "${item.query}"`,
      );
      const started = Date.now();

      try {
        await onType.focusSearch();
        await onType.clearQuery();
        await onType.typeQuery(item.query);
        await expect(onType.input()).toHaveValue(item.query);

        const trimmed = item.query.trim();
        if (trimmed.length < ON_TYPE_BEHAVIOR.minCharacters) {
          await expect(onType.trendingHeading()).toBeVisible({
            timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs,
          });
        } else {
          await expect
            .poll(
              async () => {
                const suggestionsVisible = await onType
                  .suggestionsColumn()
                  .isVisible()
                  .catch(() => false);
                const resultsVisible = await onType
                  .resultsColumn()
                  .isVisible()
                  .catch(() => false);
                const emptyMsg = await onType.page
                  .getByText(ON_TYPE_COPY.noSuggestions, { exact: true })
                  .isVisible()
                  .catch(() => false);
                return suggestionsVisible || resultsVisible || emptyMsg;
              },
              { timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs },
            )
            .toBeTruthy();
        }

        await onType.resetSearchState();
        return {
          id: item.id,
          query: item.query,
          module: 'on-type',
          browser,
          viewport,
          status: 'passed',
          durationMs: Date.now() - started,
          meta: {
            execution: 'EXECUTED',
            normalizedQuery: normalizeAnalyticsQueryKey(item.query),
          },
        };
      } catch (error) {
        const { recovered } = await handleAnalyticsFailure({
          page,
          input: onType.input(),
          softReset: () => onType.resetSearchState(),
          openHome: () => onType.open(),
          lifecycle,
        });
        return {
          id: item.id,
          query: item.query,
          module: 'on-type',
          browser,
          viewport,
          status: 'failed',
          durationMs: Date.now() - started,
          error: formatError(error),
          recovered,
          meta: {
            execution: 'EXECUTED',
            normalizedQuery: normalizeAnalyticsQueryKey(item.query),
          },
        };
      }
    },
  });
}

export async function runSuggestionsBatch(options: {
  page: Page;
  queries: AnalyticsQuery[];
  browser: string;
  viewport: string;
  lifecycle: AnalyticsBatchLifecycle;
}): Promise<AnalyticsQueryResult[]> {
  const { page, queries, browser, viewport, lifecycle } = options;
  const suggestions = new SuggestionsPage(page);

  await suggestions.open();
  lifecycle.homeNavigations += 1;

  return runDedupedModuleBatch({
    queries,
    browser,
    viewport,
    module: 'suggestions',
    lifecycle,
    executeOne: async (item, execIndex, execTotal): Promise<AnalyticsQueryResult> => {
      console.log(
        `[${execIndex}/${execTotal}] ${item.id} SUGGESTIONS "${item.query}"`,
      );
      const started = Date.now();

      try {
        const trimmed = item.query.trim();
        if (trimmed.length < SUGGESTIONS_BEHAVIOR.minCharacters) {
          await suggestions.focusSearch();
          await suggestions.enterQuery(item.query);
          await expect(suggestions.input()).toHaveValue(item.query);
          lifecycle.softFailures += 1;
          await suggestions.resetSearchState().catch(() => undefined);
          return {
            id: item.id,
            query: item.query,
            module: 'suggestions',
            browser,
            viewport,
            status: 'failed',
            durationMs: Date.now() - started,
            error: `Query below min characters (${SUGGESTIONS_BEHAVIOR.minCharacters})`,
            meta: {
              execution: 'EXECUTED',
              normalizedQuery: normalizeAnalyticsQueryKey(item.query),
              suggestionCount: 0,
              suggestionsAvailable: false,
            } satisfies Record<string, string | number | boolean>,
          };
        }

        await suggestions.searchAndWaitForSuggestions(item.query, {
          inputMode: 'fill',
        });
        await expect(suggestions.input()).toHaveValue(item.query);

        const emptyVisible = await suggestions
          .noSuggestionsMessage()
          .isVisible()
          .catch(() => false);
        const suggestionCount = emptyVisible
          ? 0
          : await suggestions.dropdown.getSuggestionCount();
        const resultsCount = await suggestions.dropdown.getResultCount();

        if (emptyVisible || suggestionCount <= 0) {
          throw new Error(
            `Expected suggestions for ${item.id}; empty=${emptyVisible} count=${suggestionCount}`,
          );
        }

        await suggestions.resetSearchState();
        return {
          id: item.id,
          query: item.query,
          module: 'suggestions',
          browser,
          viewport,
          status: 'passed',
          durationMs: Date.now() - started,
          meta: {
            execution: 'EXECUTED',
            normalizedQuery: normalizeAnalyticsQueryKey(item.query),
            suggestionCount,
            resultCount: resultsCount,
            suggestionsAvailable: true,
          } satisfies Record<string, string | number | boolean>,
        };
      } catch (error) {
        const { recovered } = await handleAnalyticsFailure({
          page,
          input: suggestions.input(),
          softReset: () => suggestions.resetSearchState(),
          openHome: () => suggestions.open(),
          lifecycle,
        });
        return {
          id: item.id,
          query: item.query,
          module: 'suggestions',
          browser,
          viewport,
          status: 'failed',
          durationMs: Date.now() - started,
          error: formatError(error),
          recovered,
          meta: {
            execution: 'EXECUTED',
            normalizedQuery: normalizeAnalyticsQueryKey(item.query),
          } satisfies Record<string, string | number | boolean>,
        };
      }
    },
  });
}

export async function runOnEnterBatch(options: {
  page: Page;
  queries: AnalyticsQuery[];
  browser: string;
  viewport: string;
  lifecycle: AnalyticsBatchLifecycle;
}): Promise<AnalyticsQueryResult[]> {
  const { page, queries, browser, viewport, lifecycle } = options;
  const onEnter = new OnEnterSearchPage(page);

  await onEnter.open();
  lifecycle.homeNavigations += 1;

  return runDedupedModuleBatch({
    queries,
    browser,
    viewport,
    module: 'on-enter',
    lifecycle,
    executeOne: async (item, execIndex, execTotal): Promise<AnalyticsQueryResult> => {
      console.log(
        `[${execIndex}/${execTotal}] ${item.id} ON-ENTER "${item.query}"`,
      );
      const started = Date.now();
      let landedUrl = '';

      try {
        // Prefer SERP → clear → fill → Enter (no home between queries).
        await onEnter.focusSearch();
        await onEnter.clearQuery();
        await onEnter.searchWithEnter(item.query, { inputMode: 'fill' });
        await onEnter.waitForSearchNavigation(item.query);

        landedUrl = page.url();
        const url = new URL(landedUrl);
        if (url.pathname.startsWith('/product/')) {
          throw new Error('Analytics ON-ENTER expects SERP, not PDP redirect');
        }
        if (url.pathname !== ON_ENTER_BEHAVIOR.searchPath) {
          throw new Error(`Unexpected pathname ${url.pathname}`);
        }
        const q = url.searchParams.get(ON_ENTER_BEHAVIOR.queryParam) ?? '';
        if (!queriesMatch(q, item.query)) {
          throw new Error(`URL q mismatch: got "${q}"`);
        }
        await expect(onEnter.input()).toHaveValue(item.query);

        const { productCount, titles } =
          await expectSerpProductsMatchAnalyticsQuery(onEnter, item.query);

        return {
          id: item.id,
          query: item.query,
          module: 'on-enter',
          browser,
          viewport,
          status: 'passed',
          durationMs: Date.now() - started,
          url: landedUrl,
          meta: {
            execution: 'EXECUTED',
            normalizedQuery: normalizeAnalyticsQueryKey(item.query),
            productCount,
            productTitlesSample: titles.slice(0, 3).join(' | '),
          } satisfies Record<string, string | number | boolean>,
        };
      } catch (error) {
        // Soft failures (relevance / URL / no products): stay on page, clear input.
        const { recovered } = await handleAnalyticsFailure({
          page,
          input: onEnter.input(),
          softReset: async () => {
            await onEnter.focusSearch();
            await onEnter.clearQuery();
          },
          openHome: () => onEnter.resetToHome(),
          lifecycle,
        });
        return {
          id: item.id,
          query: item.query,
          module: 'on-enter',
          browser,
          viewport,
          status: 'failed',
          durationMs: Date.now() - started,
          error: formatError(error),
          url: landedUrl || page.url(),
          recovered,
          meta: {
            execution: 'EXECUTED',
            normalizedQuery: normalizeAnalyticsQueryKey(item.query),
          } satisfies Record<string, string | number | boolean>,
        };
      }
    },
  });
}

export async function runAnalyticsViewportBatch(options: {
  page: Page;
  queries: AnalyticsQuery[];
  browser: string;
  viewport: string;
  modules?: AnalyticsModuleId[];
}): Promise<AnalyticsBatchReport> {
  const {
    page,
    queries,
    browser,
    viewport,
    modules = parseAnalyticsModules(),
  } = options;

  const uniqueCount = countUniqueNormalized(queries);
  const lifecycle = createLifecycle(queries.length);
  lifecycle.uniqueNormalizedQueries = uniqueCount;
  lifecycle.duplicateRows = Math.max(0, queries.length - uniqueCount);

  logBatchHeader(browser, viewport, queries.length, uniqueCount, modules);
  const startedAt = new Date().toISOString();
  const wallStart = Date.now();
  const results: AnalyticsQueryResult[] = [];

  // Per-module counters for actual/deduped are cumulative across modules.
  for (const moduleId of modules) {
    console.log(`--- Module: ${moduleId.toUpperCase()} ---`);
    if (moduleId === 'on-type') {
      results.push(
        ...(await runOnTypeBatch({ page, queries, browser, viewport, lifecycle })),
      );
    } else if (moduleId === 'suggestions') {
      results.push(
        ...(await runSuggestionsBatch({
          page,
          queries,
          browser,
          viewport,
          lifecycle,
        })),
      );
    } else {
      results.push(
        ...(await runOnEnterBatch({ page, queries, browser, viewport, lifecycle })),
      );
    }
    console.log(`Completed ${moduleId} @ ${viewport}`);
  }

  console.log(`\nCompleted ${viewport}`);
  console.log(
    `Dedup: datasetRows=${lifecycle.datasetRows} unique=${lifecycle.uniqueNormalizedQueries} actualExecutions=${lifecycle.actualExecutions} skippedDup=${lifecycle.deduplicatedExecutions}`,
  );
  console.log(
    `Recovery: softFailures=${lifecycle.softFailures} hardFailures=${lifecycle.hardFailures} pageRecoveries=${lifecycle.pageRecoveries} homeNavigations=${lifecycle.homeNavigations} reloadRecoveries=${lifecycle.reloadRecoveries}`,
  );
  console.log('');

  return {
    browser,
    viewport,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - wallStart,
    queryCount: queries.length,
    modules,
    lifecycle,
    results,
  };
}
