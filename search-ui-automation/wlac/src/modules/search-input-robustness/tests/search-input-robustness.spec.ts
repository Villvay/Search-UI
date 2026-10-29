import { test, expect } from '../../../core/fixtures';
import { expectSyncedSerp } from '../assertions/searchInputRobustnessAssertions';
import { INPUT_ROBUSTNESS_BEHAVIOR } from '../data/behavior';
import { inputQueries } from '../data/queries';
import { SearchInputRobustnessPage } from '../pages/SearchInputRobustnessPage';

test.describe('Search input robustness @search-input-robustness', () => {
  test('INPUT-001 @smoke @responsive - A normal search query works', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.normal);
    await expectSyncedSerp(inputPage, inputQueries.normal);
  });

  test('INPUT-002 - Leading and trailing spaces are preserved', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.leadingTrailing);
    await expect(inputPage.input()).toHaveValue(inputQueries.leadingTrailing);
  });

  test('INPUT-003 - Internal whitespace is handled', async ({ page }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.internal);
    await expect(inputPage.input()).toHaveValue(inputQueries.internal);
  });

  test('INPUT-004 @responsive - Special characters are handled', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.special);
    expect(new URL(page.url()).pathname).toBe(INPUT_ROBUSTNESS_BEHAVIOR.searchPath);
  });

  test('INPUT-005 @responsive - Unicode input works', async ({ page }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.unicode);
    await expect(inputPage.input()).toHaveValue(inputQueries.unicode);
  });

  test('INPUT-006 - Emoji input does not crash the interface', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.emoji);
    await expect(inputPage.input()).toBeVisible();
  });

  test('INPUT-007 @smoke @responsive - HTML-like input is treated as text', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.html);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await expect(inputPage.input()).toHaveValue(inputQueries.html);
  });

  test('INPUT-008 @smoke @responsive - Script-like input remains literal', async ({
    page,
  }) => {
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.script);
    expect(dialogs).toEqual([]);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
  });

  test('INPUT-009 - Encoded text is handled as typed characters', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.encoded);
    await expect(inputPage.input()).toHaveValue(inputQueries.encoded);
  });

  test('INPUT-010 - Very long input does not break the interface', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.long);
    await expect(inputPage.input()).toBeVisible();
  });

  test('INPUT-011 @responsive - Empty Enter does not navigate', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    const before = page.url();
    await inputPage.searchPage.searchBox.focus();
    await inputPage.searchPage.searchBox.pressEnter();
    await expect(page).toHaveURL(before);
  });

  test('INPUT-012 - Whitespace-only Enter follows application rules', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.whitespace);
    expect(new URL(page.url()).pathname).toBe(INPUT_ROBUSTNESS_BEHAVIOR.searchPath);
  });

  test('INPUT-013 - Query text, URL, and results remain synchronized', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.normal);
    await expectSyncedSerp(inputPage, inputQueries.normal);
  });

  test('INPUT-014 @responsive - Replacing unusual queries does not leave stale UI', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.html);
    await inputPage.searchPage.searchBox.type(inputQueries.normal);
    await inputPage.searchPage.searchBox.pressEnter();
    await inputPage.page.waitForURL(
      (url) =>
        url.pathname === INPUT_ROBUSTNESS_BEHAVIOR.searchPath &&
        url.searchParams.get(INPUT_ROBUSTNESS_BEHAVIOR.queryParam) ===
          inputQueries.normal,
      { timeout: INPUT_ROBUSTNESS_BEHAVIOR.uiSettleTimeoutMs },
    );
    await expectSyncedSerp(inputPage, inputQueries.normal);
  });

  test('INPUT-015 - Unexpected input does not crash the application', async ({
    page,
  }) => {
    const inputPage = new SearchInputRobustnessPage(page);
    await inputPage.openHome();
    await inputPage.searchExpectingSerp(inputQueries.script);
    await expect(inputPage.input()).toBeVisible();
  });
});
