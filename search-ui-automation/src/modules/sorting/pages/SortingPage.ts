import { type Page, expect } from '@playwright/test';
import { SortingControl } from '../../../core/components/SortingControl';
import { SearchPage } from '../../../core/pages/SearchPage';
import { SORTING_BEHAVIOR, SORTING_COPY } from '../data/behavior';

/**
 * Sorting feature page — SERP only.
 * Does not import filters-facets / on-type / suggestions / on-enter modules.
 */
export class SortingPage {
  readonly searchPage: SearchPage;
  readonly sorting: SortingControl;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.sorting = new SortingControl(page);
  }

  async openSearchResults(query: string): Promise<void> {
    await this.searchPage.openSearchResults(query);
    await expect(
      this.page.getByRole('heading', {
        name: new RegExp(
          `${SORTING_COPY.searchResultsHeadingPrefix}\\s+"${escapeRegExp(query)}"`,
          'i',
        ),
      }),
    ).toBeVisible({ timeout: SORTING_BEHAVIOR.uiSettleTimeoutMs });
  }

  productTitleLinks() {
    return this.page.locator('a.product-title');
  }

  async getProductTitles(limit = 10): Promise<string[]> {
    const links = this.productTitleLinks();
    await links
      .first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .catch(() => undefined);
    const count = await links.count();
    const titles: string[] = [];
    for (let i = 0; i < count && titles.length < limit; i += 1) {
      const text = (await links.nth(i).innerText()).trim().replace(/\s+/g, ' ');
      if (text) titles.push(text);
    }
    return titles;
  }

  getSortParamRaw(): string | null {
    try {
      const url = new URL(this.page.url());
      for (const key of ['sort', 'sortBy', 'orderBy', 'order']) {
        const value = url.searchParams.get(key);
        if (value != null) return `${key}=${value}`;
      }
      return null;
    } catch {
      return null;
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
