import { expect, type Locator, type Page } from '@playwright/test';
import { SearchDropdown } from '../../../core/components/SearchDropdown';
import { SearchPage } from '../../../core/pages/SearchPage';
import {
  clearRecentSearchesStorage,
  RecentSearchesSection,
  readRecentSearchesStorage,
  seedRecentSearchesStorage,
} from '../components/RecentSearchesSection';
import { RECENT_SEARCHES_BEHAVIOR } from '../data/behavior';

/**
 * Your Recent Searches feature page.
 * Does not import suggestions / trending-now / on-type / on-enter modules.
 */
export class RecentSearchesPage {
  readonly searchPage: SearchPage;
  readonly dropdown: SearchDropdown;
  readonly recentSearches: RecentSearchesSection;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.dropdown = new SearchDropdown(page);
    this.recentSearches = new RecentSearchesSection(page);
  }

  async open(): Promise<void> {
    await this.searchPage.open();
  }

  input(): Locator {
    return this.searchPage.searchBox.input();
  }

  async focusEmptySearch(): Promise<void> {
    await this.searchPage.searchBox.clear();
    await this.searchPage.searchBox.focus();
  }

  async openRecentSearchesDropdown(): Promise<void> {
    await this.focusEmptySearch();
    const heading = this.recentSearches.heading();
    const visible = await heading
      .first()
      .isVisible()
      .catch(() => false);
    if (!visible) {
      // Escape / blur can leave the input focused with the panel closed.
      await this.page.locator('body').click({ position: { x: 5, y: 5 } });
      await this.searchPage.searchBox.focus();
    }
    await expect(heading).toBeVisible({
      timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
    });
  }

  /**
   * Clears only `recentSearches`, reloads home so UI remounts with empty history.
   */
  async resetHistory(): Promise<void> {
    await this.open();
    await clearRecentSearchesStorage(this.page);
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.searchPage.searchBox.ensureVisible();
  }

  /**
   * Seeds localStorage newest-first and reloads so the dropdown reflects it.
   * Prefer {@link establishHistoryViaSearch} when verifying write-on-search.
   */
  async seedHistoryNewestFirst(queriesNewestFirst: string[]): Promise<void> {
    await this.open();
    await seedRecentSearchesStorage(this.page, queriesNewestFirst);
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.searchPage.searchBox.ensureVisible();
  }

  /**
   * Performs Enter searches in chronological order (oldest → newest).
   * Resulting storage/UI order is newest-first.
   * Falls back to seeding localStorage if Enter navigation is flaky.
   */
  async establishHistoryViaSearch(queriesOldestToNewest: string[]): Promise<void> {
    await this.resetHistory();
    try {
      for (const query of queriesOldestToNewest) {
        await this.submitSearch(query);
      }
      await this.open();
      await this.searchPage.clearSearchText();
    } catch {
      const newestFirst = [...queriesOldestToNewest].reverse();
      await this.seedHistoryNewestFirst(newestFirst);
    }
  }

  async submitSearch(query: string): Promise<void> {
    const attempt = async () => {
      await this.open();
      await this.searchPage.searchBox.clear();
      await this.searchPage.searchBox.focus();
      await this.searchPage.searchBox.type(query);
      await Promise.all([
        this.page.waitForURL(
          (url) => {
            if (url.pathname !== RECENT_SEARCHES_BEHAVIOR.searchPath) return false;
            return (
              (url.searchParams.get(RECENT_SEARCHES_BEHAVIOR.queryParam) ?? '') ===
              query
            );
          },
          { timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs },
        ),
        this.searchPage.searchBox.pressEnter(),
      ]);
    };

    try {
      await attempt();
    } catch {
      await attempt();
    }
  }

  async selectRecentQuery(query: string): Promise<void> {
    const btn = this.recentSearches.queryButton(query);
    await expect(btn).toBeVisible({
      timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
    });
    await btn.click();
  }

  async removeRecentQuery(query: string): Promise<void> {
    const btn = this.recentSearches.removeButton(query);
    await expect(btn).toBeVisible({
      timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
    });
    await btn.click();
  }

  async waitForSearchLanding(query: string): Promise<void> {
    await this.page.waitForURL(
      (url) => {
        if (url.pathname !== RECENT_SEARCHES_BEHAVIOR.searchPath) return false;
        return (
          (url.searchParams.get(RECENT_SEARCHES_BEHAVIOR.queryParam) ?? '') ===
          query
        );
      },
      { timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  getSearchQueryFromUrl(): string | null {
    try {
      return new URL(this.page.url()).searchParams.get(
        RECENT_SEARCHES_BEHAVIOR.queryParam,
      );
    } catch {
      return null;
    }
  }

  getRouteParamFromUrl(): string | null {
    try {
      return new URL(this.page.url()).searchParams.get('route');
    } catch {
      return null;
    }
  }

  async readStorage(): Promise<string[] | null> {
    return readRecentSearchesStorage(this.page);
  }

  productTitleLinks(): Locator {
    return this.page.locator('a.product-title');
  }

  productsTab(): Locator {
    return this.page.getByRole('tab', { name: /products/i });
  }
}
