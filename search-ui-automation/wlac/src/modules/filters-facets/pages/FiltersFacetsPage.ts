import { expect, type Locator, type Page } from '@playwright/test';
import { FiltersPanel } from '../../../core/components/FiltersPanel';
import { SearchPage } from '../../../core/pages/SearchPage';
import { FILTERS_FACETS_BEHAVIOR } from '../data/behavior';

export class FiltersFacetsPage {
  readonly searchPage: SearchPage;
  readonly filters: FiltersPanel;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.filters = new FiltersPanel(page);
  }

  async openSearchResults(query: string): Promise<void> {
    await this.searchPage.openSearchResults(query);
  }

  input(): Locator {
    return this.searchPage.searchBox.input();
  }

  productsTab(): Locator {
    return this.page.getByRole('tab', { name: /Products/i }).first();
  }

  productTitleLinks(): Locator {
    return this.page.locator('a.product-title').locator('visible=true');
  }

  noResultsHeading(): Locator {
    return this.page.getByRole('heading', { name: 'No Results', exact: true });
  }

  async getProductsTabCount(): Promise<number | null> {
    const tab = this.productsTab();
    if (!(await tab.isVisible().catch(() => false))) return null;
    const text = (await tab.innerText()).replace(/\s+/g, ' ');
    const match = text.match(/(\d[\d,]*)/);
    return match ? Number(match[1].replace(/,/g, '')) : null;
  }

  async getProductCount(): Promise<number> {
    return this.productTitleLinks().count();
  }

  getFiltersParamRaw(): string | null {
    return new URL(this.page.url()).searchParams.get(
      FILTERS_FACETS_BEHAVIOR.filtersParam,
    );
  }

  getFiltersState(): Record<string, unknown> | null {
    const raw = this.getFiltersParamRaw();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async waitForFiltersState(): Promise<void> {
    await this.page.waitForURL(
      (url) => url.searchParams.has(FILTERS_FACETS_BEHAVIOR.filtersParam),
      { timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  async waitForFiltersCleared(): Promise<void> {
    await this.page.waitForURL(
      (url) => !url.searchParams.has(FILTERS_FACETS_BEHAVIOR.filtersParam),
      { timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs },
    );
  }

  async waitForResultsUpdate(previousTabCount?: number | null): Promise<void> {
    await this.filters.closeMobileDrawerIfOpen();
    await expect
      .poll(
        async () => {
          if (this.getFiltersParamRaw() === null) return false;
          const count = await this.getProductsTabCount();
          if (previousTabCount != null && count != null) {
            return count !== previousTabCount;
          }
          return count != null;
        },
        { timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs },
      )
      .toBeTruthy();
  }
}
