import { expect, type Locator, type Page } from '@playwright/test';
import { SearchDropdown } from '../../../core/components/SearchDropdown';
import { SearchPage } from '../../../core/pages/SearchPage';
import {
  TRENDING_NOW_BEHAVIOR,
  TRENDING_NOW_COPY,
} from '../data/behavior';

/**
 * Trending Now feature page — idle empty-focus dropdown only.
 * Does not import suggestions / on-type / on-enter modules.
 */
export class TrendingNowPage {
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

  async focusEmptySearch(): Promise<void> {
    await this.searchPage.searchBox.clear();
    await this.searchPage.searchBox.focus();
  }

  /**
   * Focus empty search and wait until Trending Now heading + items appear.
   * Optionally correlates with `/trending` network response when present.
   */
  async openTrendingNow(): Promise<void> {
    const trendingResponse = this.page
      .waitForResponse(
        (response) => {
          try {
            return (
              response.ok() &&
              response.url().includes(TRENDING_NOW_BEHAVIOR.trendingApiPathFragment)
            );
          } catch {
            return false;
          }
        },
        { timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs },
      )
      .catch(() => null);

    await this.focusEmptySearch();
    await trendingResponse;

    await expect(this.heading()).toBeVisible({
      timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs,
    });
    await expect
      .poll(async () => this.getItemCount(), {
        timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs,
      })
      .toBeGreaterThanOrEqual(TRENDING_NOW_BEHAVIOR.minItemCountWhenPresent);
  }

  /** Scoped to the Trending Now heading — avoids suggestions/products/recent. */
  heading(): Locator {
    return this.page.getByRole('heading', {
      name: TRENDING_NOW_COPY.trendingHeading,
      exact: true,
    });
  }

  list(): Locator {
    return this.heading().locator('xpath=following-sibling::ul[1]');
  }

  items(): Locator {
    return this.list().getByRole('button');
  }

  itemByText(text: string): Locator {
    return this.items().filter({ hasText: new RegExp(`^${escapeRegExp(text)}$`) });
  }

  async getItemCount(): Promise<number> {
    return this.items().count();
  }

  async getItemTexts(): Promise<string[]> {
    const count = await this.getItemCount();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const raw = (await this.items().nth(i).innerText()).trim();
      if (raw) texts.push(raw);
    }
    return texts;
  }

  async selectTrendingQuery(text: string): Promise<void> {
    const item = this.itemByText(text).first();
    await expect(item).toBeVisible({
      timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs,
    });
    await item.click();
  }

  async selectTrendingByIndex(index: number): Promise<string> {
    const item = this.items().nth(index);
    await expect(item).toBeVisible({
      timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs,
    });
    const text = (await item.innerText()).trim();
    await item.click();
    return text;
  }

  async waitForSearchLanding(query: string): Promise<void> {
    await this.page.waitForURL(
      (url) => {
        if (url.pathname !== TRENDING_NOW_BEHAVIOR.searchPath) {
          return false;
        }
        const q =
          url.searchParams.get(TRENDING_NOW_BEHAVIOR.queryParam) ?? '';
        return q === query;
      },
      { timeout: TRENDING_NOW_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  getSearchQueryFromUrl(): string | null {
    try {
      return new URL(this.page.url()).searchParams.get(
        TRENDING_NOW_BEHAVIOR.queryParam,
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

  /** Return to clean home + empty search (between multi-query scenarios). */
  async resetToCleanSearch(): Promise<void> {
    await this.open();
    await this.searchPage.clearSearchText();
  }

  productTitleLinks(): Locator {
    return this.page.locator('a.product-title');
  }

  productsTab(): Locator {
    return this.page.getByRole('tab', { name: /products/i });
  }

  searchResultsHeading(query: string): Locator {
    return this.page.getByRole('heading', {
      name: new RegExp(
        `${escapeRegExp(TRENDING_NOW_COPY.searchResultsHeadingPrefix)}\\s+"${escapeRegExp(query)}"`,
        'i',
      ),
    });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
