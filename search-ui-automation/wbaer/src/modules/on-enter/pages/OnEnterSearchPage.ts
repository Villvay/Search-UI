import { type Page, expect } from '@playwright/test';
import { SearchPage } from '../../../core/pages/SearchPage';
import { ON_ENTER_BEHAVIOR, ON_ENTER_COPY } from '../data/behavior';

/**
 * ON-ENTER specific flows. Reuses core SearchPage/SearchBox for input I/O.
 */
export class OnEnterSearchPage {
  readonly searchPage: SearchPage;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
  }

  async open(): Promise<void> {
    await this.searchPage.open();
  }

  input() {
    return this.searchPage.searchBox.input();
  }

  async focusSearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async enterQuery(query: string): Promise<void> {
    await this.searchPage.searchBox.type(query);
  }

  async typeQuerySequentially(query: string, delayMs = 35): Promise<void> {
    await this.searchPage.searchBox.typeSequentially(query, delayMs);
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

  /** Presses Enter only (does not type). */
  async submitSearchWithEnter(): Promise<void> {
    await this.pressEnter();
  }

  /**
   * Types a query (dropdown may open) and submits with Enter.
   * This is normal Enter search — not suggestion selection.
   * Use `inputMode: 'fill'` for analytics (not keystroke/debounce coverage).
   */
  async searchWithEnter(
    query: string,
    options?: { inputMode?: 'type' | 'fill' },
  ): Promise<void> {
    const inputMode = options?.inputMode ?? 'type';
    await this.focusSearch();
    if (query.length === 0) {
      await this.clearQuery();
    } else if (inputMode === 'fill') {
      await this.enterQuery(query);
    } else {
      await this.typeQuerySequentially(query);
    }
    await this.submitSearchWithEnter();
  }

  /** Return to storefront home so the next analytics query starts cleanly. */
  async resetToHome(): Promise<void> {
    await this.open();
  }

  getSearchUrl(): string {
    return this.page.url();
  }

  getSearchQueryFromUrl(): string | null {
    try {
      return new URL(this.page.url()).searchParams.get(
        ON_ENTER_BEHAVIOR.queryParam,
      );
    } catch {
      return null;
    }
  }

  searchResultsHeading(query: string) {
    return this.page.getByRole('heading', {
      name: new RegExp(
        `${ON_ENTER_COPY.searchResultsHeadingPrefix}\\s+"${escapeRegExp(query)}"`,
        'i',
      ),
    });
  }

  noResultsHeading() {
    return this.page
      .getByRole('main')
      .getByRole('heading', {
        name: ON_ENTER_COPY.noResultsHeading,
        exact: true,
      });
  }

  noResultsMessage() {
    return this.page
      .getByRole('main')
      .getByText(ON_ENTER_COPY.noResultsMessage, { exact: true });
  }

  productsTab() {
    return this.page.getByRole('tab', { name: /products/i });
  }

  /** SERP product title links (stable on QA). */
  productTitleLinks() {
    return this.page.getByRole('main').locator('a.product-title');
  }

  async getSerpProductTitles(limit = 10): Promise<string[]> {
    const links = this.productTitleLinks();
    await links
      .first()
      .waitFor({ state: 'visible', timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs })
      .catch(() => undefined);

    const count = await links.count();
    const seen = new Set<string>();
    const titles: string[] = [];

    for (let i = 0; i < count && titles.length < limit; i += 1) {
      const text = (await links.nth(i).innerText()).trim().replace(/\s+/g, ' ');
      if (!text || seen.has(text)) continue;
      seen.add(text);
      titles.push(text);
    }

    return titles;
  }

  async hasNoResultsState(): Promise<boolean> {
    return this.noResultsHeading().isVisible().catch(() => false);
  }

  async waitForSearchNavigation(query?: string): Promise<void> {
    await this.page.waitForURL(
      (url) => {
        if (url.pathname !== ON_ENTER_BEHAVIOR.searchPath) {
          return false;
        }
        if (!url.searchParams.has(ON_ENTER_BEHAVIOR.queryParam)) {
          return false;
        }
        if (query === undefined) {
          return true;
        }
        const q = url.searchParams.get(ON_ENTER_BEHAVIOR.queryParam) ?? '';
        return queriesMatch(q, query);
      },
      { timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  async waitForSearchResultsHeading(query: string): Promise<void> {
    await expect(this.searchResultsHeading(query)).toBeVisible({
      timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs,
    });
  }

  async waitForNoResultsState(): Promise<void> {
    await expect(this.noResultsHeading()).toBeVisible({
      timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs,
    });
    await expect(this.noResultsMessage()).toBeVisible({
      timeout: ON_ENTER_BEHAVIOR.uiSettleTimeoutMs,
    });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Exact match, case-insensitive; whitespace-only queries match whitespace `q`. */
export function queriesMatch(actual: string, expected: string): boolean {
  if (expected.trim() === '' && expected.length > 0) {
    return actual.trim() === '' && actual.length > 0;
  }
  return actual.toLowerCase() === expected.toLowerCase();
}
