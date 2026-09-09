import { expect, type Locator, type Page } from '@playwright/test';
import { FiltersPanel } from '../../../core/components/FiltersPanel';
import { SearchPage } from '../../../core/pages/SearchPage';
import {
  CACHE_STATE_BEHAVIOR,
  CACHE_STATE_COPY,
} from '../data/behavior';
import {
  captureSerpIdentity,
  headingMatchesQuery,
  type SerpIdentity,
} from '../utils/cacheStateHelpers';

/**
 * Cache / search-state page — core only; no feature-module imports.
 */
export class CacheStatePage {
  readonly searchPage: SearchPage;
  readonly filters: FiltersPanel;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.filters = new FiltersPanel(page);
  }

  input(): Locator {
    return this.searchPage.searchBox.input();
  }

  async openHome(): Promise<void> {
    await this.searchPage.open();
  }

  async openSerp(query: string): Promise<void> {
    await this.searchPage.openSearchResults(query);
    await this.waitForSerpQuery(query);
  }

  async focusSearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async fillQuery(query: string): Promise<void> {
    await this.searchPage.searchBox.clear();
    await this.searchPage.searchBox.type(query);
  }

  async clearSearchUi(): Promise<void> {
    const clearBtn = this.page.getByRole('button', {
      name: CACHE_STATE_COPY.clearSearch,
      exact: true,
    });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
    } else {
      await this.searchPage.searchBox.clear();
    }
  }

  async submitEnter(query: string): Promise<void> {
    await Promise.all([
      this.page.waitForURL(
        (url) =>
          url.pathname === CACHE_STATE_BEHAVIOR.searchPath &&
          (url.searchParams.get(CACHE_STATE_BEHAVIOR.queryParam) ?? '') ===
            query,
        { timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs },
      ),
      this.searchPage.searchBox.pressEnter(),
    ]);
    await this.waitForSerpQuery(query);
  }

  /** Search from home or current page via fill + Enter (same page, no reload). */
  async searchQuery(query: string): Promise<SerpIdentity> {
    await this.focusSearch();
    await this.fillQuery(query);
    await this.submitEnter(query);
    return this.identity();
  }

  async waitForSerpQuery(query: string): Promise<void> {
    await expect
      .poll(
        async () => {
          const id = await captureSerpIdentity(this.page);
          return (
            id.q === query &&
            id.inputValue === query &&
            headingMatchesQuery(id.heading, query)
          );
        },
        { timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs },
      )
      .toBeTruthy();
  }

  /**
   * Soft wait used after history navigation where URL may update before UI.
   * Does not require heading sync (that is the defect under test).
   */
  async waitForUrlQuery(query: string): Promise<void> {
    await this.page.waitForURL(
      (url) =>
        url.pathname === CACHE_STATE_BEHAVIOR.searchPath &&
        (url.searchParams.get(CACHE_STATE_BEHAVIOR.queryParam) ?? '') === query,
      { timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  resultsHeading(query: string): Locator {
    return this.page.getByRole('heading', {
      name: new RegExp(
        `${CACHE_STATE_COPY.searchResultsHeadingPrefix}\\s+"${escapeRegExp(query)}"`,
        'i',
      ),
    });
  }

  suggestionsColumn(): Locator {
    return this.page
      .locator('[data-search-column="suggestions"]')
      .locator('visible=true')
      .first();
  }

  suggestionItems(): Locator {
    return this.suggestionsColumn().locator('[data-search-suggestion]');
  }

  trendingHeading(): Locator {
    return this.page.getByRole('heading', {
      name: CACHE_STATE_COPY.trendingHeading,
      exact: true,
    });
  }

  async waitForSuggestions(): Promise<void> {
    await expect(this.suggestionsColumn()).toBeVisible({
      timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs,
    });
    await expect
      .poll(async () => this.suggestionItems().count(), {
        timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs,
      })
      .toBeGreaterThan(0);
  }

  async getSuggestionTexts(): Promise<string[]> {
    const count = await this.suggestionItems().count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = (await this.suggestionItems().nth(i).innerText())
        .trim()
        .replace(/\s+/g, ' ');
      if (t) texts.push(t);
    }
    return texts;
  }

  async identity(): Promise<SerpIdentity> {
    return captureSerpIdentity(this.page);
  }

  async applyBrandFilter(facet: string, option: string): Promise<void> {
    await this.filters.ensureVisible();
    await this.filters.selectOption(facet, option);
    await this.page.waitForURL(
      (url) => url.searchParams.has(CACHE_STATE_BEHAVIOR.filtersParam),
      { timeout: CACHE_STATE_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  getFiltersParam(): string | null {
    try {
      return new URL(this.page.url()).searchParams.get(
        CACHE_STATE_BEHAVIOR.filtersParam,
      );
    } catch {
      return null;
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
