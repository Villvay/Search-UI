import { type Locator, type Page } from '@playwright/test';
import { FiltersPanel } from '../../../core/components/FiltersPanel';
import { SearchDropdown } from '../../../core/components/SearchDropdown';
import { SearchPage } from '../../../core/pages/SearchPage';
import { CACHE_STATE_BEHAVIOR } from '../data/behavior';

export class CacheStatePage {
  readonly searchPage: SearchPage;
  readonly dropdown: SearchDropdown;
  readonly filters: FiltersPanel;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.dropdown = new SearchDropdown(page);
    this.filters = new FiltersPanel(page);
  }

  input(): Locator {
    return this.searchPage.searchBox.input();
  }

  resultsHeading(query: string): Locator {
    return this.page.getByRole('heading', {
      name: `Search Results for "${query}"`,
      exact: true,
    });
  }

  async openHome(): Promise<void> {
    await this.searchPage.open();
  }

  async openSerp(query: string): Promise<void> {
    await this.searchPage.openSearchResults(query);
  }

  async searchQuery(query: string): Promise<void> {
    await this.searchPage.searchBox.focus();
    await this.searchPage.searchBox.type(query);
    await this.searchPage.searchBox.pressEnter();
    await this.waitForSerpQuery(query);
  }

  async waitForSerpQuery(query: string): Promise<void> {
    await this.page.waitForURL(
      (url) =>
        url.pathname === CACHE_STATE_BEHAVIOR.searchPath &&
        (url.searchParams.get(CACHE_STATE_BEHAVIOR.queryParam) ?? '') === query,
      { timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs },
    );
    await this.resultsHeading(query).waitFor({
      state: 'visible',
      timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs,
    });
  }

  getFiltersParam(): string | null {
    return new URL(this.page.url()).searchParams.get('filters');
  }
}
