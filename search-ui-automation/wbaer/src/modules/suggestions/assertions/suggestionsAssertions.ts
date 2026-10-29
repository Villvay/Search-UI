import { expect, type Page } from '@playwright/test';
import { type SearchDropdown } from '../../../core/components/SearchDropdown';
import {
  SUGGESTIONS_BEHAVIOR,
  SUGGESTIONS_COPY,
} from '../data/behavior';
import { type SuggestionsPage } from '../pages/SuggestionsPage';

export async function expectTrendingDropdown(
  suggestionsPage: SuggestionsPage,
): Promise<void> {
  await expect(suggestionsPage.trendingHeading()).toBeVisible({
    timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
  });
  await expect(suggestionsPage.dropdown.suggestionsColumn()).toBeHidden();
}

export async function expectSuggestionsDropdownVisible(
  dropdown: SearchDropdown,
): Promise<void> {
  await expect(dropdown.suggestionsColumn()).toBeVisible({
    timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export async function expectSuggestionPresent(
  dropdown: SearchDropdown,
  text: string,
): Promise<void> {
  await expectSuggestionsDropdownVisible(dropdown);
  const texts = await dropdown.getSuggestionTexts();
  expect(
    texts.some((item) => item.toLowerCase() === text.toLowerCase()),
    `Expected suggestion "${text}" in ${JSON.stringify(texts)}`,
  ).toBeTruthy();
}

export async function expectSuggestionTextsNonEmpty(
  dropdown: SearchDropdown,
): Promise<void> {
  await expectSuggestionsDropdownVisible(dropdown);
  const texts = await dropdown.getSuggestionTexts();
  expect(texts.length).toBeGreaterThan(0);
  for (const text of texts) {
    expect(text.trim().length).toBeGreaterThan(0);
  }
}

export async function expectSuggestionsInteractable(
  dropdown: SearchDropdown,
): Promise<void> {
  const first = dropdown.suggestionItems().first();
  await expect(first).toBeVisible({
    timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
  });
  await expect(first).toBeEnabled();
}

export async function expectNoSuggestionsState(
  suggestionsPage: SuggestionsPage,
): Promise<void> {
  await expect(suggestionsPage.noSuggestionsMessage()).toBeVisible({
    timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
  });
  await expect(suggestionsPage.dropdown.suggestionsColumn()).toBeVisible();
}

export async function expectDropdownNotFullyClipped(
  page: Page,
  dropdown: SearchDropdown,
): Promise<void> {
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  if (!viewport) return;

  const suggestionsBox = await dropdown.suggestionsColumn().boundingBox();
  const panelBox = suggestionsBox ?? (await dropdown.getPanelBox());
  expect(panelBox, 'Expected dropdown geometry').toBeTruthy();
  if (!panelBox) return;

  expect(panelBox.width).toBeGreaterThan(40);
  expect(panelBox.height).toBeGreaterThan(20);
  // At least part of the panel must intersect the viewport.
  expect(panelBox.x + panelBox.width).toBeGreaterThan(0);
  expect(panelBox.x).toBeLessThan(viewport.width);
  expect(panelBox.y + panelBox.height).toBeGreaterThan(0);
  expect(panelBox.y).toBeLessThan(viewport.height);
}

export async function expectSearchNavigationForQuery(
  page: Page,
  query: string,
): Promise<void> {
  await expect
    .poll(
      () => {
        const current = page.url();
        try {
          const url = new URL(current);
          const q = url.searchParams.get('q') ?? '';
          return (
            url.pathname === '/search' &&
            (q.toLowerCase() === query.toLowerCase() ||
              current.toLowerCase().includes(`q=${query.toLowerCase()}`))
          );
        } catch {
          return false;
        }
      },
      { timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs },
    )
    .toBeTruthy();
}

export async function expectProductNavigation(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/product\//, {
    timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export { SUGGESTIONS_COPY };
