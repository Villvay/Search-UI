import { expect, type TestInfo } from '@playwright/test';
import { SEARCH_INPUT_ROBUSTNESS_BEHAVIOR } from '../data/behavior';
import type { RobustnessQuery } from '../data/queries';
import { type SearchInputRobustnessPage } from '../pages/SearchInputRobustnessPage';
import {
  captureDomSafety,
  headingMatchesQuery,
  sanitizeReportValue,
  type DialogCapture,
  type SerpSnapshot,
} from '../utils/inputSafetyHelpers';
import type { RuntimeErrorCollector } from '../../runtime-errors/utils/runtimeErrorCollector';

export function annotateInput(
  testInfo: TestInfo,
  fields: Record<string, string>,
): void {
  for (const [type, description] of Object.entries(fields)) {
    testInfo.annotations.push({ type, description });
  }
}

export function annotateRobustnessCase(
  testInfo: TestInfo,
  query: RobustnessQuery,
  extra: Record<string, string> = {},
): void {
  annotateInput(testInfo, {
    inputCategory: query.category,
    inputValue: sanitizeReportValue(query),
    browser: String(testInfo.project.use.browserName || 'chromium'),
    viewport: testInfo.project.name,
    ...extra,
  });
}

export async function expectSerpSynced(
  pageObj: SearchInputRobustnessPage,
  query: string,
): Promise<SerpSnapshot> {
  await pageObj.waitForSerpSettled(query);
  const id = await pageObj.snapshot();
  expect(id.q, 'URL q (decoded) mismatch').toBe(query);
  expect(id.inputValue, 'Search input mismatch').toBe(query);
  expect(
    headingMatchesQuery(id.heading, query),
    `Heading "${id.heading}" does not match query`,
  ).toBeTruthy();
  return id;
}

export function expectNoUnexpectedDialog(dialogs: DialogCapture[]): void {
  expect(
    dialogs,
    dialogs.length
      ? `Unexpected dialog: type=${dialogs[0].type} message=${dialogs[0].message} input=${dialogs[0].inputUsed} url=${dialogs[0].url} viewport=${dialogs[0].viewport}`
      : 'dialog',
  ).toEqual([]);
}

export async function expectMarkupTreatedAsText(
  pageObj: SearchInputRobustnessPage,
  query: string,
): Promise<void> {
  const snap = await pageObj.snapshot();
  expect(snap.q).toBe(query);
  expect(snap.inputValue).toBe(query);
  const dom = await captureDomSafety(pageObj.page);
  expect(
    dom.unexpectedImgSrcX,
    'Query must not create img[src=x] in the document',
  ).toBeFalsy();
  expect(
    dom.boldFromQuery,
    'HTML-like query must not create bold DOM from markup',
  ).toBeFalsy();
  if (snap.heading && /Search Results for/i.test(snap.heading)) {
    // Literal angle brackets (or encoded display) — not rendered HTML children.
    expect(snap.heading.includes(query) || snap.heading.includes('<')).toBeTruthy();
  }
}

export async function expectPageUsable(
  pageObj: SearchInputRobustnessPage,
): Promise<void> {
  await expect(pageObj.input()).toBeVisible();
}

export function expectNoUnrelatedRedirect(
  beforePath: string,
  afterUrl: string,
  allowed: 'home' | 'search' | 'home-or-search',
): void {
  let path = '/';
  try {
    path = new URL(afterUrl).pathname;
  } catch {
    throw new Error(`Invalid URL after action: ${afterUrl}`);
  }
  if (allowed === 'home') {
    expect(path === '/' || path === '').toBeTruthy();
  } else if (allowed === 'search') {
    expect(path).toBe(SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.searchPath);
  } else {
    expect(
      path === '/' ||
        path === '' ||
        path === SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.searchPath,
    ).toBeTruthy();
  }
  // Unrelated: e.g. jumped to external host or non-search route from home.
  if (beforePath === '/' || beforePath === '') {
    expect(
      path === '/' ||
        path === '' ||
        path === SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.searchPath,
      `Unexpected navigation from home to ${path}`,
    ).toBeTruthy();
  }
}

export function expectNoUnexpectedRuntime(
  collector: RuntimeErrorCollector,
): void {
  const unexpected = collector.unexpected();
  expect(
    unexpected,
    unexpected[0]
      ? `Unexpected runtime: ${unexpected[0].type} ${unexpected[0].message}`
      : 'runtime',
  ).toEqual([]);
}

export function expectTemplateNotEvaluated(
  snap: SerpSnapshot,
  literal: string,
): void {
  expect(snap.q).toBe(literal);
  expect(snap.inputValue).toBe(literal);
  // Must not become "49" from ${7*7} / {{7*7}} evaluation.
  expect(snap.q).not.toBe('49');
  expect(snap.inputValue).not.toBe('49');
  if (snap.heading) {
    expect(snap.heading).not.toMatch(/Search Results for\s+"49"/i);
  }
}
