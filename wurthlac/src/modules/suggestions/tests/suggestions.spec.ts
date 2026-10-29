import { test, expect } from '../../../core/fixtures';
import {
  expectActiveResults,
  expectIdleSuggestions,
  expectResultsMentionQuery,
} from '../assertions/suggestionsAssertions';
import { SUGGESTIONS_BEHAVIOR } from '../data/behavior';
import { suggestionQueries } from '../data/queries';
import { SuggestionsPage } from '../pages/SuggestionsPage';

test.describe('Search dropdown and suggestions @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  test('SUG-001 @smoke - Focusing an empty search box displays the idle dropdown', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.focusSearch();
    await expectIdleSuggestions(suggestions);
  });

  test('SUG-002 @smoke - A valid query displays dropdown results', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.productType);
    await expectActiveResults(suggestions);
    await expectResultsMentionQuery(suggestions, suggestionQueries.productType);
  });

  test('SUG-003 - Dropdown text is consistent with the query', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.productType);
    const heading = suggestions.dropdown.productsHeading(
      suggestionQueries.productType,
    );
    const categories = suggestions.dropdown.categoriesHeading(
      suggestionQueries.productType,
    );
    const headingVisible = await heading.isVisible().catch(() => false);
    const categoriesVisible = await categories.isVisible().catch(() => false);
    expect(headingVisible || categoriesVisible).toBeTruthy();
  });

  test('SUG-004 - Clicking a category item navigates to that category', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.productType);
    const link = suggestions.dropdown.categoryLinks().first();
    await expect(link).toBeVisible({
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });
    await expect(link).toBeEnabled();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/category\//);
    await link.click();
    await expect(page).toHaveURL(/\/category\//, {
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });
  });

  test('SUG-005 - Clicking a product preview opens a product page', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.productType);
    const link = suggestions.dropdown.productLinks().first();
    await expect(link).toBeVisible({
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });
    await link.click();
    await expect(page).toHaveURL(/\/product\//, {
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });
  });

  test('SUG-006 - Product previews appear when applicable', async ({ page }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.productType);
    await expect(suggestions.dropdown.productLinks().first()).toBeVisible({
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });
    const texts = await suggestions.dropdown.getProductTexts();
    expect(texts.length).toBeGreaterThan(0);
    expect(texts[0]?.trim().length).toBeGreaterThan(0);
  });

  test('SUG-007 - A no-match query still keeps the dropdown usable', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.noResult);
    await expect(suggestions.input()).toHaveValue(suggestionQueries.noResult);
    await expect(suggestions.input()).toBeVisible();
  });

  test('SUG-008 - Clearing the query restores the idle dropdown', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.productType);
    await suggestions.clearQuery();
    await expect(suggestions.input()).toHaveValue('');
    await expectIdleSuggestions(suggestions);
  });

  test('SUG-009 - Replacing the query refreshes dropdown content', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.replaceFrom);
    await suggestions.clearQuery();
    await suggestions.searchAndWaitForResults(suggestionQueries.replaceTo);
    await expectResultsMentionQuery(suggestions, suggestionQueries.replaceTo);
  });

  test('SUG-010 - Escape closes the dropdown if supported', async ({ page }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.productType);
    await page.keyboard.press('Escape');
    await expect(suggestions.dropdown.resultsColumn()).toBeHidden({
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });
    await expect(suggestions.input()).toHaveValue(suggestionQueries.productType);
  });

  test('SUG-011 - Brand queries populate dropdown results', async ({ page }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.brand);
    await expectActiveResults(suggestions);
    await expectResultsMentionQuery(suggestions, suggestionQueries.brand);
  });

  test('SUG-012 - SKU queries populate dropdown results', async ({ page }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForResults(suggestionQueries.sku);
    await expectActiveResults(suggestions);
  });

  test('SUG-013 - A query below the minimum length stays idle', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.focusSearch();
    await suggestions.typeQuerySequentially(suggestionQueries.shortBelowThreshold);
    await expectIdleSuggestions(suggestions);
  });
});
