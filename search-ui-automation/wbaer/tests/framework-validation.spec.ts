import { test, expect } from '../src/core/fixtures';
import { frameworkValidationData } from '../src/test-data/framework-validation';

/**
 * Framework validation only — does not exercise Search feature behavior
 * (on-type, Enter submit, suggestions, filters, results, etc.).
 */
test.describe('Framework validation — Search input', () => {
  test('opens site, types into search input, and clears it', async ({
    searchPage,
  }) => {
    await searchPage.open();

    await searchPage.expectSearchInputVisible();

    const input = searchPage.searchBox.input();
    await expect(input).toBeVisible();

    await searchPage.enterSearchText(frameworkValidationData.sampleQuery);
    await expect(input).toHaveValue(frameworkValidationData.sampleQuery);
    expect(await searchPage.readSearchText()).toBe(
      frameworkValidationData.sampleQuery,
    );

    await searchPage.clearSearchText();
    await expect(input).toHaveValue('');
    expect(await searchPage.readSearchText()).toBe('');
  });
});
