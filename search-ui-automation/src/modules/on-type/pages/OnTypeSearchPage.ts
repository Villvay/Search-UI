import { type Locator, type Page } from '@playwright/test';
import { SearchPage } from '../../../core/pages/SearchPage';
import {
  ON_TYPE_BEHAVIOR,
  ON_TYPE_COPY,
  ON_TYPE_SELECTORS,
} from '../data/behavior';

/**
 * On-type specific interactions built on core SearchPage/SearchBox.
 * Does not implement Enter-submit, suggestion ranking, or results-page flows.
 */
export class OnTypeSearchPage {
  readonly searchPage: SearchPage;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
  }

  async open(): Promise<void> {
    await this.searchPage.open();
  }

  input(): Locator {
    return this.searchPage.searchBox.input();
  }

  suggestionsColumn(): Locator {
    return this.page.locator(ON_TYPE_SELECTORS.suggestionsColumn).first();
  }

  resultsColumn(): Locator {
    return this.page.locator(ON_TYPE_SELECTORS.resultsColumn).first();
  }

  trendingHeading(): Locator {
    return this.page.getByRole('heading', {
      name: ON_TYPE_COPY.trendingHeading,
      exact: true,
    });
  }

  clearSearchButton(): Locator {
    return this.page.getByRole('button', {
      name: ON_TYPE_COPY.clearSearchButton,
      exact: true,
    });
  }

  async focusSearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async typeQuery(query: string): Promise<void> {
    await this.searchPage.searchBox.type(query);
  }

  async typeQuerySequentially(
    query: string,
    delayMs = 40,
  ): Promise<void> {
    await this.searchPage.searchBox.typeSequentially(query, delayMs);
  }

  async clearQuery(): Promise<void> {
    await this.searchPage.searchBox.clear();
  }

  /** Clear input and wait for idle trending (safe between analytics queries). */
  async resetSearchState(): Promise<void> {
    await this.clearQuery();
    await this.trendingHeading()
      .waitFor({
        state: 'visible',
        timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs,
      })
      .catch(() => undefined);
  }

  async readQuery(): Promise<string> {
    return this.searchPage.searchBox.getValue();
  }

  /**
   * Types a full query sequentially, waiting for active on-type UI when
   * the query meets the discovered character threshold.
   */
  async typeAndAwaitOnTypeState(query: string): Promise<void> {
    await this.focusSearch();
    await this.typeQuerySequentially(query);

    if (query.trim().length >= ON_TYPE_BEHAVIOR.minCharacters || query.length >= ON_TYPE_BEHAVIOR.minCharacters) {
      await this.suggestionsColumn().waitFor({
        state: 'visible',
        timeout: ON_TYPE_BEHAVIOR.uiSettleTimeoutMs,
      });
    }
  }
}
