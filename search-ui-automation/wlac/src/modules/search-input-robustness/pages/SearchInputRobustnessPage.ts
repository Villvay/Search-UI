import { type Locator, type Page } from '@playwright/test';
import { SearchPage } from '../../../core/pages/SearchPage';
import { INPUT_ROBUSTNESS_BEHAVIOR } from '../data/behavior';

export class SearchInputRobustnessPage {
  readonly searchPage: SearchPage;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
  }

  input(): Locator {
    return this.searchPage.searchBox.input();
  }

  async openHome(): Promise<void> {
    await this.searchPage.open();
  }

  async searchExpectingSerp(query: string): Promise<void> {
    await this.searchPage.searchBox.focus();
    await this.searchPage.searchBox.type(query);
    await this.searchPage.searchBox.pressEnter();
    await this.page.waitForURL(
      (url) => url.pathname === INPUT_ROBUSTNESS_BEHAVIOR.searchPath,
      { timeout: INPUT_ROBUSTNESS_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  noResultsHeading(): Locator {
    return this.page.getByRole('heading', { name: 'No Results', exact: true });
  }

  resultsHeading(query: string): Locator {
    return this.page.getByRole('heading', {
      name: `Search Results for "${query}"`,
      exact: true,
    });
  }
}
