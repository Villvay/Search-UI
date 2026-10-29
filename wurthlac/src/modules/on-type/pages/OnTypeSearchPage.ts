import { type Locator, type Page } from '@playwright/test';
import { SearchPage } from '../../../core/pages/SearchPage';
import { SearchDropdown } from '../../../core/components/SearchDropdown';
import { ON_TYPE_BEHAVIOR, ON_TYPE_COPY } from '../data/behavior';

export class OnTypeSearchPage {
  readonly searchPage: SearchPage;
  readonly dropdown: SearchDropdown;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.dropdown = new SearchDropdown(page);
  }

  async open(): Promise<void> {
    await this.searchPage.open();
  }

  input(): Locator {
    return this.searchPage.searchBox.input();
  }

  resultsColumn(): Locator {
    return this.dropdown.resultsColumn();
  }

  suggestionsColumn(): Locator {
    return this.dropdown.suggestionsColumn();
  }

  recentHeading(): Locator {
    return this.dropdown.recentHeading();
  }

  smarterBanner(): Locator {
    return this.dropdown.smarterBanner();
  }

  trendingHeading(): Locator {
    return this.page.getByRole('heading', {
      name: ON_TYPE_COPY.trendingHeading,
      exact: true,
    });
  }

  async focusSearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async typeQuery(query: string): Promise<void> {
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

  async typeAndAwaitOnTypeState(query: string): Promise<void> {
    await this.focusSearch();
    await this.typeQuerySequentially(query);

    if (
      query.trim().length >= ON_TYPE_BEHAVIOR.minCharacters ||
      query.length >= ON_TYPE_BEHAVIOR.minCharacters
    ) {
      await this.dropdown.waitForResults(ON_TYPE_BEHAVIOR.uiSettleTimeoutMs);
    }
  }
}
