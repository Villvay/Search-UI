import { type Locator, type Page } from '@playwright/test';
import { SearchPage } from '../../../core/pages/SearchPage';
import { ON_ENTER_BEHAVIOR, ON_ENTER_COPY } from '../data/behavior';

export function queriesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export class OnEnterSearchPage {
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

  async focusSearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async enterQuery(query: string): Promise<void> {
    await this.searchPage.searchBox.type(query);
  }

  async typeQuerySequentially(query: string): Promise<void> {
    await this.searchPage.searchBox.typeSequentially(query);
  }

  async clearQuery(): Promise<void> {
    await this.searchPage.searchBox.clear();
  }

  async readQuery(): Promise<string> {
    return this.searchPage.searchBox.getValue();
  }

  async pressEnter(): Promise<void> {
    await this.searchPage.searchBox.pressEnter();
  }

  async searchWithEnter(query: string): Promise<void> {
    await this.focusSearch();
    await this.enterQuery(query);
    await this.pressEnter();
    await this.waitForSearchNavigation(query);
  }

  searchResultsHeading(query: string): Locator {
    return this.page.getByRole('heading', {
      name: `${ON_ENTER_COPY.searchResultsHeadingPrefix} "${query}"`,
      exact: true,
    });
  }

  noResultsHeading(): Locator {
    return this.page.getByRole('heading', {
      name: ON_ENTER_COPY.noResultsHeading,
      exact: true,
    });
  }

  noResultsMessage(): Locator {
    return this.page.getByText(ON_ENTER_COPY.noResultsMessage, { exact: false });
  }

  productsTab(): Locator {
    return this.page.getByRole('tab', { name: /Products/i }).first();
  }

  productTitleLinks(): Locator {
    return this.page.locator('a.product-title').locator('visible=true');
  }

  getSearchQueryFromUrl(): string {
    return new URL(this.page.url()).searchParams.get(ON_ENTER_BEHAVIOR.queryParam) ?? '';
  }

  async waitForSearchNavigation(query: string): Promise<void> {
    await this.page.waitForURL(
      (url) =>
        url.pathname === ON_ENTER_BEHAVIOR.searchPath &&
        queriesMatch(url.searchParams.get(ON_ENTER_BEHAVIOR.queryParam) ?? '', query),
      { timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  async waitForSearchResultsHeading(query: string): Promise<void> {
    await this.searchResultsHeading(query).waitFor({
      state: 'visible',
      timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs,
    });
  }

  async waitForNoResultsState(): Promise<void> {
    await this.noResultsHeading().waitFor({
      state: 'visible',
      timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs,
    });
  }

  async resetToHome(): Promise<void> {
    await this.open();
  }
}
