import { type Page, expect } from '@playwright/test';
import { SearchDropdown } from '../../../core/components/SearchDropdown';
import { SearchPage } from '../../../core/pages/SearchPage';
import {
  SUGGESTIONS_BEHAVIOR,
  SUGGESTIONS_COPY,
} from '../data/behavior';
import { TrendingSection } from '../components/TrendingSection';

/**
 * Feature page object for dropdown/suggestions validation.
 * Uses core SearchBox/SearchPage/SearchDropdown — no on-type module imports.
 */
export class SuggestionsPage {
  readonly searchPage: SearchPage;
  readonly dropdown: SearchDropdown;
  readonly trending: TrendingSection;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.dropdown = new SearchDropdown(page);
    this.trending = new TrendingSection(page);
  }

  async open(): Promise<void> {
    await this.searchPage.open();
  }

  input() {
    return this.searchPage.searchBox.input();
  }

  trendingHeading() {
    return this.trending.heading();
  }

  clearSearchButton() {
    return this.page.getByRole('button', {
      name: SUGGESTIONS_COPY.clearSearchButton,
      exact: true,
    });
  }

  noSuggestionsMessage() {
    return this.page.getByText(SUGGESTIONS_COPY.noSuggestions, { exact: true });
  }

  async focusSearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async enterQuery(query: string): Promise<void> {
    await this.searchPage.searchBox.type(query);
  }

  async typeQuerySequentially(query: string, delayMs = 40): Promise<void> {
    await this.searchPage.searchBox.typeSequentially(query, delayMs);
  }

  async clearQuery(): Promise<void> {
    await this.searchPage.searchBox.clear();
  }

  async readQuery(): Promise<string> {
    return this.searchPage.searchBox.getValue();
  }

  /**
   * Types a query and waits for suggestions via network response + UI state.
   */
  async searchAndWaitForSuggestions(query: string): Promise<void> {
    await this.focusSearch();

    const responsePromise = this.page
      .waitForResponse(
        (response) => {
          try {
            const url = new URL(response.url());
            if (!url.href.includes('/suggestions')) {
              return false;
            }
            const q = url.searchParams.get('query') ?? '';
            return response.ok() && q.toLowerCase() === query.toLowerCase();
          } catch {
            return false;
          }
        },
        { timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs },
      )
      .catch(() => null);

    await this.typeQuerySequentially(query);
    await responsePromise;
    await this.dropdown.waitForSuggestions(SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs);
  }

  async waitForIdleTrending(): Promise<void> {
    await expect(this.trendingHeading()).toBeVisible({
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });
  }

  async selectSuggestion(target: { text?: string; attr?: string }): Promise<void> {
    await this.dropdown.clickSuggestion(target);
  }

  async selectFirstResult(): Promise<void> {
    await this.dropdown.resultItemLinks().first().waitFor({
      state: 'visible',
      timeout: SUGGESTIONS_BEHAVIOR.uiSettleTimeoutMs,
    });
    await this.dropdown.clickResult(0);
  }
}
