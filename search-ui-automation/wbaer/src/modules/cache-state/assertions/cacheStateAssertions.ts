import { expect, type TestInfo } from '@playwright/test';
import { CACHE_STATE_BEHAVIOR } from '../data/behavior';
import { type CacheStatePage } from '../pages/CacheStatePage';
import {
  headingMatchesQuery,
  type SerpIdentity,
} from '../utils/cacheStateHelpers';

export function annotateCache(
  testInfo: TestInfo,
  fields: Record<string, string>,
): void {
  for (const [type, description] of Object.entries(fields)) {
    testInfo.annotations.push({ type, description });
  }
}

export async function expectSerpSyncedToQuery(
  cachePage: CacheStatePage,
  query: string,
): Promise<SerpIdentity> {
  await cachePage.waitForSerpQuery(query);
  const id = await cachePage.identity();
  expect(id.q, 'URL q mismatch').toBe(query);
  expect(id.inputValue, 'Search input mismatch').toBe(query);
  expect(
    headingMatchesQuery(id.heading, query),
    `Heading "${id.heading}" does not match query "${query}"`,
  ).toBeTruthy();
  return id;
}

export function expectNotStaleQuery(
  id: SerpIdentity,
  previousQuery: string,
  currentQuery: string,
): void {
  expect(id.q).toBe(currentQuery);
  expect(id.inputValue).toBe(currentQuery);
  expect(id.q).not.toBe(previousQuery);
  if (id.heading) {
    expect(id.heading.toLowerCase()).not.toContain(
      `search results for "${previousQuery.toLowerCase()}"`,
    );
  }
}

export function expectSuggestionsRelateToQuery(
  texts: string[],
  query: string,
): void {
  expect(texts.length).toBeGreaterThan(0);
  const q = query.toLowerCase();
  const related = texts.filter((t) => t.toLowerCase().includes(q));
  expect(
    related.length,
    `Expected suggestions related to "${query}", got ${JSON.stringify(texts)}`,
  ).toBeGreaterThan(0);
}

export function expectSuggestionSetsDiffer(
  a: string[],
  b: string[],
): void {
  const norm = (list: string[]) =>
    [...new Set(list.map((t) => t.toLowerCase()))].sort().join('|');
  expect(norm(a)).not.toBe(norm(b));
}

/**
 * After history back/forward: URL must match expectedQuery AND UI must sync.
 * Documents SPA stale defect when URL updated but heading/input lag.
 */
export async function expectHistoryNavigationSynced(
  cachePage: CacheStatePage,
  expectedQuery: string,
): Promise<SerpIdentity> {
  await cachePage.waitForUrlQuery(expectedQuery);
  const id = await cachePage.identity();
  const urlOk = id.q === expectedQuery;
  const inputOk = id.inputValue === expectedQuery;
  const headingOk = headingMatchesQuery(id.heading, expectedQuery);

  expect(urlOk, `URL q expected "${expectedQuery}", got "${id.q}"`).toBeTruthy();

  expect(
    inputOk && headingOk,
    [
      'Stale SPA search state after history navigation.',
      `Expected query: ${expectedQuery}`,
      `URL q: ${id.q}`,
      `Input: ${id.inputValue}`,
      `Heading: ${id.heading}`,
      `Likely source: client-side routing / React state (not HTTP cache; Search API is no-cache).`,
      `Documented: CACHE_STATE_BEHAVIOR.backForwardKeepsUiInSync=${CACHE_STATE_BEHAVIOR.backForwardKeepsUiInSync}`,
    ].join(' '),
  ).toBeTruthy();

  return id;
}

export function expectNoFiltersParam(id: SerpIdentity): void {
  expect(id.filters).toBeNull();
}
