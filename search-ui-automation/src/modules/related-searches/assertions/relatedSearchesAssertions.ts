import { expect, type Page } from '@playwright/test';
import { RELATED_SEARCHES_BEHAVIOR } from '../data/behavior';
import { type RelatedSearchesPage } from '../pages/RelatedSearchesPage';

export async function expectRelatedSearchesVisible(
  relatedPage: RelatedSearchesPage,
): Promise<void> {
  await expect(relatedPage.relatedSearches.section()).toBeVisible({
    timeout: RELATED_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
  });
  await expect
    .poll(async () => relatedPage.relatedSearches.getItemCount(), {
      timeout: RELATED_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
    })
    .toBeGreaterThanOrEqual(RELATED_SEARCHES_BEHAVIOR.minItemCountWhenPresent);
}

export async function expectRelatedSearchItemsHaveValidText(
  relatedPage: RelatedSearchesPage,
): Promise<void> {
  const texts = await relatedPage.relatedSearches.getItemTexts();
  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) {
    expect(text.trim().length).toBeGreaterThan(0);
  }
  // Display labels may repeat (e.g. two "hinge" rows); identity is data-search-suggestion.
  const attrs = await relatedPage.relatedSearches.dropdown.getSuggestionAttributes();
  expect(attrs.length).toBe(texts.length);
  expect(attrs.every((a) => a.trim().length > 0)).toBeTruthy();
  expect(new Set(attrs).size).toBe(attrs.length);
}

export async function expectRelatedSearchesInteractable(
  relatedPage: RelatedSearchesPage,
): Promise<void> {
  const first = relatedPage.relatedSearches.items().first();
  await expect(first).toBeVisible({
    timeout: RELATED_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
  });
  await expect(first).toBeEnabled();
}

export async function expectEmptyRelatedSearchesState(
  relatedPage: RelatedSearchesPage,
): Promise<void> {
  await expect(relatedPage.relatedSearches.noSuggestionsMessage()).toBeVisible({
    timeout: RELATED_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
  });
}

/** Related Searches must not appear as a SERP section. */
export async function expectRelatedSearchesAbsentOnSerp(
  relatedPage: RelatedSearchesPage,
): Promise<void> {
  await expect(relatedPage.relatedSearches.serpHeading()).toHaveCount(0);
}

export async function expectSearchStateAfterRelatedClick(
  page: Page,
  relatedPage: RelatedSearchesPage,
  selectedText: string,
): Promise<void> {
  await relatedPage.waitForSearchLanding(selectedText);
  await expect(relatedPage.input()).toHaveValue(new RegExp(selectedText, 'i'));
  const url = new URL(page.url());
  expect(url.pathname).toBe(RELATED_SEARCHES_BEHAVIOR.searchPath);
  expect(
    (
      url.searchParams.get(RELATED_SEARCHES_BEHAVIOR.queryParam) ?? ''
    ).toLowerCase(),
  ).toBe(selectedText.toLowerCase());
}
