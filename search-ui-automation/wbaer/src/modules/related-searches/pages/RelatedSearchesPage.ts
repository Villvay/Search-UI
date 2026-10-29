import { expect, type Page } from '@playwright/test';
import { SearchPage } from '../../../core/pages/SearchPage';
import { RelatedSearches } from '../components/RelatedSearches';
import { RELATED_SEARCHES_BEHAVIOR } from '../data/behavior';

/**
 * Related Searches feature page — dropdown surface only.
 * Does not import on-type / suggestions / on-enter modules.
 */
export class RelatedSearchesPage {
  readonly searchPage: SearchPage;
  readonly relatedSearches: RelatedSearches;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.relatedSearches = new RelatedSearches(page);
  }

  /** Opens storefront home where the header search dropdown is available. */
  async open(): Promise<void> {
    await this.searchPage.open();
  }

  input() {
    return this.searchPage.searchBox.input();
  }

  async focusSearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async typeQuerySequentially(query: string, delayMs = 40): Promise<void> {
    await this.searchPage.searchBox.typeSequentially(query, delayMs);
  }

  async clearQuery(): Promise<void> {
    await this.searchPage.searchBox.clear();
  }

  /**
   * Focuses search, types a query, waits for suggestions API + Related Search items.
   */
  async openRelatedSearches(query: string): Promise<void> {
    await this.focusSearch();

    const responsePromise = this.page
      .waitForResponse(
        (response) => {
          try {
            const url = new URL(response.url());
            if (!url.href.includes('/suggestions')) {
              return false;
            }
            const q = url.searchParams.get('query') ?? '';
            return response.ok() && q.toLowerCase() === query.toLowerCase();
          } catch {
            return false;
          }
        },
        { timeout: RELATED_SEARCHES_BEHAVIOR.uiSettleTimeoutMs },
      )
      .catch(() => null);

    await this.typeQuerySequentially(query);
    await responsePromise;
    await this.relatedSearches.waitForRelatedSearches();
  }

  /**
   * Types a query expected to yield an empty Related Searches state.
   */
  async openEmptyRelatedSearches(query: string): Promise<void> {
    await this.focusSearch();

    const responsePromise = this.page
      .waitForResponse(
        (response) => {
          try {
            const url = new URL(response.url());
            if (!url.href.includes('/suggestions')) {
              return false;
            }
            const q = url.searchParams.get('query') ?? '';
            return response.ok() && q.toLowerCase() === query.toLowerCase();
          } catch {
            return false;
          }
        },
        { timeout: RELATED_SEARCHES_BEHAVIOR.uiSettleTimeoutMs },
      )
      .catch(() => null);

    await this.typeQuerySequentially(query);
    await responsePromise;
    await expect(this.relatedSearches.noSuggestionsMessage()).toBeVisible({
      timeout: RELATED_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
    });
  }

  /** Opens SERP directly — used only to prove Related Searches are not on SERP. */
  async openSerp(query: string): Promise<void> {
    await this.searchPage.openSearchResults(query);
  }

  async selectRelatedSearch(target: {
    text?: string;
    attr?: string;
  }): Promise<void> {
    await this.relatedSearches.clickItem(target);
  }

  async waitForSearchLanding(query: string): Promise<void> {
    await this.page.waitForURL(
      (url) => {
        if (url.pathname !== RELATED_SEARCHES_BEHAVIOR.searchPath) {
          return false;
        }
        const q =
          url.searchParams.get(RELATED_SEARCHES_BEHAVIOR.queryParam) ?? '';
        return q.toLowerCase() === query.toLowerCase();
      },
      { timeout: RELATED_SEARCHES_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  getSearchQueryFromUrl(): string | null {
    try {
      return new URL(this.page.url()).searchParams.get(
        RELATED_SEARCHES_BEHAVIOR.queryParam,
      );
    } catch {
      return null;
    }
  }
}
