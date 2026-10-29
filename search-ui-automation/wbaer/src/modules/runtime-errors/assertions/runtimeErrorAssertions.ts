import { expect, type TestInfo } from '@playwright/test';
import {
  RUNTIME_ERRORS_BEHAVIOR,
  type RuntimeErrorRecord,
} from '../data/behavior';
import { type RuntimeErrorCollector } from '../utils/runtimeErrorCollector';

export function annotateRuntimeSummary(
  testInfo: TestInfo,
  collector: RuntimeErrorCollector,
  extra: Record<string, string> = {},
): void {
  const summary = collector.summary();
  const unexpected = collector.unexpected();
  const fields: Record<string, string> = {
    storageMechanism: 'runtime-collector',
    consoleErrors: String(summary.consoleErrors),
    pageErrors: String(summary.pageErrors),
    requestFailures: String(summary.requestFailures),
    http4xx: String(summary.http4xx),
    http5xx: String(summary.http5xx),
    unexpected: String(summary.unexpected),
    expected: String(summary.expected),
    ignored: String(summary.ignored),
    ...extra,
  };
  if (unexpected[0]) {
    fields.errorType = unexpected[0].type;
    fields.errorMessage = unexpected[0].message;
    fields.errorUrl = unexpected[0].url || '';
    fields.errorStatus = unexpected[0].status != null ? String(unexpected[0].status) : '';
  }
  for (const [type, description] of Object.entries(fields)) {
    testInfo.annotations.push({ type, description });
  }
}

export async function expectNoUnexpectedRuntimeErrors(
  collector: RuntimeErrorCollector,
): Promise<void> {
  const unexpected = collector.unexpected();
  const detail = unexpected
    .slice(0, 5)
    .map(
      (r) =>
        `[${r.classification}/${r.type}] ${r.message}${r.url ? ` @ ${r.url}` : ''}${r.status != null ? ` (${r.status})` : ''}`,
    )
    .join(' | ');
  expect(
    unexpected,
    `Unexpected runtime errors (${unexpected.length}). Strict=${RUNTIME_ERRORS_BEHAVIOR.strict}. ${detail}`,
  ).toEqual([]);
}

export function expectRecordsIsolated(
  a: RuntimeErrorRecord[],
  b: RuntimeErrorRecord[],
): void {
  // Identity isolation: arrays must not be the same reference and post-reset B must not contain A's timestamps
  expect(a).not.toBe(b);
  const aTimes = new Set(a.map((r) => r.timestamp + r.message));
  const overlap = b.filter((r) => aTimes.has(r.timestamp + r.message));
  expect(overlap, 'Collector records leaked across reset boundaries').toEqual(
    [],
  );
}

export function expectClassificationPresent(
  records: RuntimeErrorRecord[],
  classification: RuntimeErrorRecord['classification'],
): void {
  expect(
    records.some((r) => r.classification === classification),
    `Expected at least one record classified as ${classification}`,
  ).toBeTruthy();
}

export function expectCapturedNetworkFailure(
  records: RuntimeErrorRecord[],
): void {
  const hit = records.find(
    (r) => r.type === 'request-failure' || r.type === 'http-error',
  );
  expect(hit, 'Expected a captured request-failure or http-error').toBeTruthy();
  expect(hit!.url || hit!.message).toBeTruthy();
  if (hit!.type === 'http-error') {
    expect(hit!.status).toBeGreaterThanOrEqual(400);
  }
  expect(hit!.method || hit!.resourceType || hit!.message).toBeTruthy();
}
