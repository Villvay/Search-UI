/**
 * Generic Search Dropdown interactions shared across feature modules.
 * No feature-specific expected values live here.
 */
import { type Locator, type Page } from '@playwright/test';

export const DROPDOWN_SELECTORS = {
  suggestionsColumn: '[data-search-column="suggestions"]',
  resultsColumn: '[data-search-column="results"]',
  suggestionItem: '[data-search-suggestion]',
} as const;

export class SearchDropdown {
  constructor(private readonly page: Page) {}

  /**
   * Header search dropdown panel observed on WBS QA.
   * Class-based fallback — prefer column/heading locators for state checks.
   */
  panel(): Locator {
    return this.page
      .locator('div.relative.z-50')
      .filter({
        has: this.page.locator(
          `${DROPDOWN_SELECTORS.suggestionsColumn}, ${DROPDOWN_SELECTORS.resultsColumn}, h2`,
        ),
      })
      .locator('visible=true')
      .first();
  }

  suggestionsColumn(): Locator {
    return this.page
      .locator(DROPDOWN_SELECTORS.suggestionsColumn)
      .locator('visible=true')
      .first();
  }

  resultsColumn(): Locator {
    return this.page
      .locator(DROPDOWN_SELECTORS.resultsColumn)
      .locator('visible=true')
      .first();
  }

  suggestionItems(): Locator {
    return this.suggestionsColumn().locator(DROPDOWN_SELECTORS.suggestionItem);
  }

  resultItemLinks(): Locator {
    return this.resultsColumn().locator('a[href]');
  }

  async isVisible(): Promise<boolean> {
    if (await this.suggestionsColumn().isVisible().catch(() => false)) {
      return true;
    }
    if (
      await this.page
        .getByRole('heading', { name: 'Trending now', exact: true })
        .isVisible()
        .catch(() => false)
    ) {
      return true;
    }
    return this.panel().isVisible().catch(() => false);
  }

  async isSuggestionsColumnVisible(): Promise<boolean> {
    return this.suggestionsColumn().isVisible().catch(() => false);
  }

  async isResultsColumnVisible(): Promise<boolean> {
    return this.resultsColumn().isVisible().catch(() => false);
  }

  async waitForSuggestions(timeoutMs = 15_000): Promise<void> {
    await this.suggestionsColumn().waitFor({ state: 'visible', timeout: timeoutMs });
  }

  async waitForSuggestionItems(timeoutMs = 15_000): Promise<void> {
    await this.suggestionItems().first().waitFor({
      state: 'visible',
      timeout: timeoutMs,
    });
  }

  async getSuggestionCount(): Promise<number> {
    if (!(await this.isSuggestionsColumnVisible())) {
      return 0;
    }
    return this.suggestionItems().count();
  }

  async getSuggestionTexts(): Promise<string[]> {
    const count = await this.getSuggestionCount();
    const texts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const text = (await this.suggestionItems().nth(i).innerText())
        .trim()
        .replace(/\s+/g, ' ');
      texts.push(text);
    }
    return texts;
  }

  async getSuggestionAttributes(): Promise<string[]> {
    const count = await this.getSuggestionCount();
    const attrs: string[] = [];
    for (let i = 0; i < count; i += 1) {
      attrs.push(
        (await this.suggestionItems()
          .nth(i)
          .getAttribute('data-search-suggestion')) ?? '',
      );
    }
    return attrs;
  }

  async getResultCount(): Promise<number> {
    if (!(await this.isResultsColumnVisible())) {
      return 0;
    }
    return this.resultItemLinks().count();
  }

  getResultItems(): Locator {
    return this.resultItemLinks();
  }

  suggestionByText(text: string): Locator {
    return this.suggestionItems().filter({ hasText: new RegExp(`^${escapeRegExp(text)}$`) }).first();
  }

  suggestionByAttribute(attr: string): Locator {
    return this.suggestionsColumn()
      .locator(`[data-search-suggestion="${attr}"]`)
      .first();
  }

  async clickSuggestion(target?: {
    text?: string;
    attr?: string;
  }): Promise<void> {
    if (target?.attr) {
      await this.suggestionByAttribute(target.attr).click();
      return;
    }
    if (target?.text) {
      await this.suggestionByText(target.text).click();
      return;
    }
    await this.suggestionItems().first().click();
  }

  async clickResult(index = 0): Promise<void> {
    await this.resultItemLinks().nth(index).click();
  }

  async getPanelBox() {
    return this.panel().boundingBox();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
