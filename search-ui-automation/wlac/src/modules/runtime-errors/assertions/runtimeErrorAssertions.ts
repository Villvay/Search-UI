import { expect } from '@playwright/test';
import { type RuntimeErrorCollector } from '../utils/runtimeErrorCollector';

export function expectNoUnexpectedErrors(collector: RuntimeErrorCollector): void {
  const unexpected = collector.unexpected();
  expect(
    unexpected,
    unexpected
      .map((e) => `${e.type}: ${e.message} (${e.url ?? ''})`)
      .join('\n') || 'unexpected errors',
  ).toEqual([]);
}
