import { expect } from '@playwright/test';
import { SORTING_BEHAVIOR } from '../data/behavior';
import { type SortingPage } from '../pages/SortingPage';

export async function expectSortingContract(sortingPage: SortingPage): Promise<void> {
  const present = await sortingPage.sorting.isPresent();
  if (SORTING_BEHAVIOR.sortingUiPresent) {
    expect(present).toBeTruthy();
  } else {
    expect(present).toBeFalsy();
  }
}
