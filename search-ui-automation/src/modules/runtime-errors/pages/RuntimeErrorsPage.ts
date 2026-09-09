import { expect, type Page } from '@playwright/test';
import { FiltersPanel } from '../../../core/components/FiltersPanel';
import { SearchPage } from '../../../core/pages/SearchPage';
import { getEnvironmentConfig } from '../../../../config/environments';
import { RUNTIME_ERRORS_BEHAVIOR } from '../data/behavior';
import { RuntimeErrorCollector } from '../utils/runtimeErrorCollector';

/**
 * Runtime monitoring page — core Search UI interactions only.
 * Does not import feature modules.
 */
export class RuntimeErrorsPage {
  readonly searchPage: SearchPage;
  readonly filters: FiltersPanel;
  collector: RuntimeErrorCollector;

  constructor(
    readonly page: Page,
    options: { viewport?: string; browser?: string } = {},
  ) {
    this.searchPage = new SearchPage(page);
    this.filters = new FiltersPanel(page);
    const env = getEnvironmentConfig();
    this.collector = new RuntimeErrorCollector(page, {
      baseURL: env.baseURL,
      viewport: options.viewport,
      browser: options.browser,
    });
  }

  attachCollector(): void {
    this.collector.attach();
  }

  detachCollector(): void {
    this.collector.detach();
  }

  resetCollector(): void {
    this.collector.reset();
  }

  setQueryContext(query: string): void {
    this.collector.setContext({ query });
  }

  async openHome(): Promise<void> {
    await this.searchPage.open();
  }

  async focusSearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async typeQuery(query: string): Promise<void> {
    this.setQueryContext(query);
    await this.searchPage.searchBox.clear();
    await this.searchPage.searchBox.typeSequentially(query);
  }

  async waitForSuggestions(): Promise<void> {
    await this.page
      .locator('[data-search-column="suggestions"]')
      .locator('visible=true')
      .first()
      .waitFor({
        state: 'visible',
        timeout: RUNTIME_ERRORS_BEHAVIOR.suggestionsVisibleTimeoutMs,
      });
  }

  async submitEnter(query: string): Promise<void> {
    this.setQueryContext(query);
    await Promise.all([
      this.page.waitForURL(
        (url) =>
          url.pathname === '/search' &&
          (url.searchParams.get('q') ?? '') === query,
        { timeout: RUNTIME_ERRORS_BEHAVIOR.uiSettleTimeoutMs },
      ),
      this.searchPage.searchBox.pressEnter(),
    ]);
  }

  async openTrendingAndSelectFirst(): Promise<string> {
    await this.searchPage.searchBox.clear();
    await this.focusSearch();
    const heading = this.page.getByRole('heading', {
      name: 'Trending now',
      exact: true,
    });
    await expect(heading).toBeVisible({
      timeout: RUNTIME_ERRORS_BEHAVIOR.uiSettleTimeoutMs,
    });
    const item = heading
      .locator('xpath=following-sibling::ul[1]')
      .getByRole('button')
      .first();
    await expect(item).toBeVisible({
      timeout: RUNTIME_ERRORS_BEHAVIOR.uiSettleTimeoutMs,
    });
    const text = (await item.innerText()).trim();
    this.setQueryContext(text);
    await Promise.all([
      this.page.waitForURL(
        (url) =>
          url.pathname === '/search' &&
          (url.searchParams.get('q') ?? '') === text,
        { timeout: RUNTIME_ERRORS_BEHAVIOR.uiSettleTimeoutMs },
      ),
      item.click(),
    ]);
    return text;
  }

  /**
   * Seeds recent history via localStorage (QA contract) without importing
   * the recent-searches module.
   */
  async seedRecentSearch(query: string): Promise<void> {
    await this.openHome();
    await this.page.evaluate((q) => {
      localStorage.setItem('recentSearches', JSON.stringify([q]));
    }, query);
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.searchPage.searchBox.ensureVisible();
  }

  async selectRecentSearch(query: string): Promise<void> {
    await this.focusSearch();
    const heading = this.page.getByRole('heading', {
      name: 'Your recent searches',
      exact: true,
    });
    await expect(heading).toBeVisible({
      timeout: RUNTIME_ERRORS_BEHAVIOR.uiSettleTimeoutMs,
    });
    this.setQueryContext(query);
    const btn = heading
      .locator('xpath=following-sibling::ol[1]')
      .getByRole('button', { name: query, exact: true });
    await Promise.all([
      this.page.waitForURL(
        (url) =>
          url.pathname === '/search' &&
          (url.searchParams.get('q') ?? '') === query,
        { timeout: RUNTIME_ERRORS_BEHAVIOR.uiSettleTimeoutMs },
      ),
      btn.click(),
    ]);
  }

  async openFilterableSerp(query: string): Promise<void> {
    this.setQueryContext(query);
    await this.searchPage.openSearchResults(query);
    await expect(this.filters.root()).toBeVisible({
      timeout: RUNTIME_ERRORS_BEHAVIOR.uiSettleTimeoutMs,
    });
  }

  async applyBrandFilter(facet: string, option: string): Promise<void> {
    await this.filters.ensureVisible();
    await this.filters.selectOption(facet, option);
    await this.page
      .waitForURL((url) => url.searchParams.has('filters'), {
        timeout: RUNTIME_ERRORS_BEHAVIOR.uiSettleTimeoutMs,
      })
      .catch(() => undefined);
  }
}
