import { expect } from '@playwright/test';
import { SORTING_BEHAVIOR } from '../data/behavior';
import { type SortingPage } from '../pages/SortingPage';

/** Asserts dedicated sorting control is currently absent on QA SERP. */
export async function expectSortingControlAbsent(
  sortingPage: SortingPage,
): Promise<void> {
  await expect
    .poll(async () => sortingPage.sorting.isPresent(), {
      timeout: SORTING_BEHAVIOR.uiSettleTimeoutMs,
    })
    .toBeFalsy();
}

/** Asserts dedicated sorting control is visible (when product ships UI). */
export async function expectSortingControlVisible(
  sortingPage: SortingPage,
): Promise<void> {
  await expect(sortingPage.sorting.control()).toBeVisible({
    timeout: SORTING_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export async function expectSortingOptionsMatch(
  sortingPage: SortingPage,
  expected: readonly string[],
): Promise<void> {
  const options = await sortingPage.sorting.getAvailableOptions();
  for (const label of expected) {
    expect(options, `Expected sorting option "${label}"`).toContain(label);
  }
}

export async function expectSelectedSort(
  sortingPage: SortingPage,
  label: string,
): Promise<void> {
  await expect
    .poll(async () => sortingPage.sorting.getSelectedLabel(), {
      timeout: SORTING_BEHAVIOR.uiSettleTimeoutMs,
    })
    .toContain(label);
}
