import { test, expect } from '../../../core/fixtures';
import {
  expectDropdownNotFullyClipped,
  expectNoSuggestionsState,
  expectProductNavigation,
  expectSearchNavigationForQuery,
  expectSuggestionPresent,
  expectSuggestionTextsNonEmpty,
  expectSuggestionsDropdownVisible,
  expectSuggestionsInteractable,
  expectTrendingDropdown,
} from '../assertions/suggestionsAssertions';
import { SUGGESTIONS_BEHAVIOR } from '../data/behavior';
import {
  noResultQuery,
  shortBelowThresholdQuery,
  suggestionCases,
} from '../data/queries';
import { SuggestionsPage } from '../pages/SuggestionsPage';

/**
 * SUGGESTIONS / DROPDOWN module.
 * Does not import on-type. Does not cover Enter-key search submission.
 */
test.describe('Search dropdown and suggestions @responsive', () => {
  test.describe.configure({ mode: 'parallel' });

  test('SUG-001 @smoke - Empty search displays trending dropdown', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.focusSearch();

    await expectTrendingDropdown(suggestions);
    await expect(suggestions.trending.items().first()).toBeVisible({
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });
    const trendingCount = await suggestions.trending.items().count();
    expect(trendingCount).toBeGreaterThan(0);
  });

  test('SUG-002 @smoke - Valid query displays suggestions', async ({ page }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForSuggestions(suggestionCases.productType.query);

    await expectSuggestionsDropdownVisible(suggestions.dropdown);
    await expectSuggestionTextsNonEmpty(suggestions.dropdown);
    await expect(suggestions.trendingHeading()).toBeHidden();
    await expectDropdownNotFullyClipped(page, suggestions.dropdown);
  });

  test('SUG-003 - Suggestions contain expected query', async ({ page }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForSuggestions(suggestionCases.productType.query);

    await expectSuggestionPresent(
      suggestions.dropdown,
      suggestionCases.productType.expectedSuggestionTexts[0],
    );

    if (suggestionCases.productType.expectedSuggestionAttr) {
      await expect(
        suggestions.dropdown.suggestionByAttribute(
          suggestionCases.productType.expectedSuggestionAttr,
        ),
      ).toBeVisible();
    }

    const attrs = await suggestions.dropdown.getSuggestionAttributes();
    expect(
      attrs.some((attr) =>
        attr.startsWith(suggestionCases.productType.expectedAttrPrefix ?? ''),
      ),
    ).toBeTruthy();
  });

  test('SUG-004 - Suggestion items are interactable', async ({ page }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForSuggestions(suggestionCases.brand.query);

    await expectSuggestionsInteractable(suggestions.dropdown);
    await expectSuggestionPresent(
      suggestions.dropdown,
      suggestionCases.brand.expectedSuggestionTexts[0],
    );
  });

  test('SUG-005 - Selecting suggestion updates search', async ({ page }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForSuggestions(suggestionCases.productType.query);

    const targetAttr = suggestionCases.productType.expectedSuggestionAttr!;
    const targetText = suggestionCases.productType.expectedSuggestionTexts[0];

    await suggestions.selectSuggestion({ attr: targetAttr });
    await expectSearchNavigationForQuery(page, targetText);
    await expect(suggestions.input()).toHaveValue(new RegExp(targetText, 'i'));
  });

  test('SUG-006 - Dropdown displays product results when applicable', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForSuggestions(suggestionCases.productType.query);

    await expect(
      suggestions.dropdown.resultsColumn(),
    ).toBeVisible({ timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs });

    const firstResult = suggestions.dropdown.resultItemLinks().first();
    await expect(firstResult).toBeVisible({
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });

    const resultText = (await firstResult.innerText()).trim();
    expect(resultText.length).toBeGreaterThan(0);
    expect(resultText.toLowerCase()).toContain('item #');

    const href = await firstResult.getAttribute('href');
    expect(href).toMatch(/\/product\//);

    await expect(firstResult.locator('img').first()).toBeVisible();

    await firstResult.click();
    await expectProductNavigation(page);
  });

  test('SUG-007 - No-result query displays empty suggestion state', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForSuggestions(noResultQuery);
    await expectNoSuggestionsState(suggestions);
  });

  test('SUG-008 - Clearing search returns to trending state', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForSuggestions(suggestionCases.productType.query);
    await expectSuggestionsDropdownVisible(suggestions.dropdown);

    await suggestions.clearSearchButton().click();
    await expect(suggestions.input()).toHaveValue('');
    await expectTrendingDropdown(suggestions);
  });

  test('SUG-009 - Replacing query updates dropdown content', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();

    await suggestions.searchAndWaitForSuggestions(suggestionCases.replaceFrom.query);
    await expectSuggestionPresent(
      suggestions.dropdown,
      suggestionCases.replaceFrom.expectedSuggestionTexts[0],
    );

    await suggestions.clearQuery();
    await suggestions.searchAndWaitForSuggestions(suggestionCases.replaceTo.query);

    await expectSuggestionPresent(
      suggestions.dropdown,
      suggestionCases.replaceTo.expectedSuggestionTexts[0],
    );

    const texts = (await suggestions.dropdown.getSuggestionTexts()).map((t) =>
      t.toLowerCase(),
    );
    expect(texts.some((t) => t.includes('blum'))).toBeTruthy();

    const attrs = await suggestions.dropdown.getSuggestionAttributes();
    expect(attrs.some((attr) => attr.startsWith('BRAND'))).toBeTruthy();
  });

  test('SUG-010 - Escape closes active suggestions dropdown', async ({
    page,
  }) => {
    // Arrow-key suggestion highlighting was not reliably observed.
    // Escape closing active suggestions WAS observed and is covered here.
    test.skip(
      !SUGGESTIONS_BEHAVIOR.escapeClosesActiveSuggestions,
      'Escape close behavior not supported',
    );

    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.searchAndWaitForSuggestions(suggestionCases.productType.query);
    await expectSuggestionsDropdownVisible(suggestions.dropdown);

    await page.keyboard.press('Escape');

    await expect(suggestions.dropdown.suggestionsColumn()).toBeHidden({
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });
    await expect(suggestions.input()).toHaveValue(suggestionCases.productType.query);
  });

  test('SUG-011 - Brand and SKU suggestion types appear for matching queries', async ({
    page,
  }) => {
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();

    await suggestions.searchAndWaitForSuggestions(suggestionCases.sku.query);
    await expectSuggestionPresent(
      suggestions.dropdown,
      suggestionCases.sku.expectedSuggestionTexts[0],
    );
    await expect(
      suggestions.dropdown.suggestionByAttribute(
        suggestionCases.sku.expectedSuggestionAttr!,
      ),
    ).toBeVisible();
  });

  test('SUG-012 - Below-threshold query keeps trending dropdown', async ({
    page,
  }) => {
    // Validates dropdown idle content for a short query — not the on-type
    // threshold matrix (owned by the on-type module).
    const suggestions = new SuggestionsPage(page);
    await suggestions.open();
    await suggestions.focusSearch();
    await expectTrendingDropdown(suggestions);

    await suggestions.typeQuerySequentially(shortBelowThresholdQuery);
    await expect(suggestions.input()).toHaveValue(shortBelowThresholdQuery);
    await expectTrendingDropdown(suggestions);
  });
});
