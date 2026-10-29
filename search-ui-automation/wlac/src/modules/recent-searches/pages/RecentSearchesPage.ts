import { type Locator, type Page } from '@playwright/test';
import { SearchPage } from '../../../core/pages/SearchPage';
import { RecentSearchesSection } from '../components/RecentSearchesSection';
import { RECENT_SEARCHES_BEHAVIOR } from '../data/behavior';

export class RecentSearchesPage {
  readonly searchPage: SearchPage;
  readonly section: RecentSearchesSection;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.section = new RecentSearchesSection(page);
  }

  input(): Locator {
    return this.searchPage.searchBox.input();
  }

  async open(): Promise<void> {
    await this.searchPage.open();
  }

  async focusEmptySearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async resetHistory(): Promise<void> {
    await this.page.evaluate((key) => localStorage.removeItem(key), RECENT_SEARCHES_BEHAVIOR.storageKey);
  }

  async seedHistoryNewestFirst(queries: readonly string[]): Promise<void> {
    await this.page.evaluate(
      ({ key, queries: values }) => {
        localStorage.setItem(key, JSON.stringify([...values]));
      },
      { key: RECENT_SEARCHES_BEHAVIOR.storageKey, queries },
    );
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.searchPage.searchBox.ensureVisible();
  }

  async submitSearch(query: string): Promise<void> {
    await this.searchPage.searchBox.focus();
    await this.searchPage.searchBox.type(query);
    await this.searchPage.searchBox.pressEnter();
    await this.page.waitForURL(
      (url) =>
        url.pathname === RECENT_SEARCHES_BEHAVIOR.searchPath &&
        (url.searchParams.get(RECENT_SEARCHES_BEHAVIOR.queryParam) ?? '') === query,
      { timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  async establishHistoryViaSearch(queries: readonly string[]): Promise<void> {
    for (const query of queries) {
      await this.open();
      await this.submitSearch(query);
    }
    await this.open();
  }

  async openRecentSearchesDropdown(): Promise<void> {
    await this.focusEmptySearch();
    await this.section.heading().locator('visible=true').first().waitFor({
      state: 'visible',
      timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
    });
  }

  async selectRecentQuery(query: string): Promise<void> {
    await this.section.queryButton(query).click();
  }

  async removeRecentQuery(query: string): Promise<void> {
    await this.section.removeButton(query).click();
  }

  async waitForSearchLanding(query: string): Promise<void> {
    await this.page.waitForURL(
      (url) =>
        url.pathname === RECENT_SEARCHES_BEHAVIOR.searchPath &&
        (url.searchParams.get(RECENT_SEARCHES_BEHAVIOR.queryParam) ?? '') === query,
      { timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  getSearchQueryFromUrl(): string {
    return new URL(this.page.url()).searchParams.get(RECENT_SEARCHES_BEHAVIOR.queryParam) ?? '';
  }

  getRouteParamFromUrl(): string | null {
    return new URL(this.page.url()).searchParams.get('route');
  }

  async readStorage(): Promise<string[]> {
    return this.page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    }, RECENT_SEARCHES_BEHAVIOR.storageKey);
  }
}
