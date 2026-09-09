import { type Page, expect } from '@playwright/test';
import { FiltersPanel } from '../../../core/components/FiltersPanel';
import { SearchPage } from '../../../core/pages/SearchPage';
import { FILTERS_FACETS_BEHAVIOR, FILTERS_FACETS_COPY } from '../data/behavior';

export type FiltersState = Record<string, string | string[]>;

/**
 * Filters & Facets feature page — SERP only.
 * Does not import on-type / suggestions / on-enter / related-searches.
 */
export class FiltersFacetsPage {
  readonly searchPage: SearchPage;
  readonly filters: FiltersPanel;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
    this.filters = new FiltersPanel(page);
  }

  /** Opens SERP for a query via direct navigation (independent of on-enter). */
  async openSearchResults(query: string): Promise<void> {
    await this.searchPage.openSearchResults(query);
    await expect(
      this.page.getByRole('heading', {
        name: new RegExp(
          `${FILTERS_FACETS_COPY.searchResultsHeadingPrefix}\\s+"${escapeRegExp(query)}"`,
          'i',
        ),
      }),
    ).toBeVisible({ timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs });
  }

  input() {
    return this.searchPage.searchBox.input();
  }

  productTitleLinks() {
    // Prefer main, fall back to page-wide product titles on SERP.
    return this.page.locator('a.product-title');
  }

  noResultsHeading() {
    return this.page.getByRole('main').getByRole('heading', {
      name: FILTERS_FACETS_COPY.noResultsHeading,
      exact: true,
    });
  }

  productsTab() {
    return this.page.getByRole('tab', { name: /^Products/i });
  }

  selectedFilterChip(label: string) {
    return this.page.getByRole('button', { name: label, exact: true });
  }

  /**
   * Reads the Products tab count (e.g. "Products 253" → 253).
   * Short timeout so callers can poll without burning the full settle window.
   */
  async getProductsTabCount(): Promise<number | null> {
    const tab = this.productsTab();
    const visible = await tab.isVisible().catch(() => false);
    if (!visible) return null;
    const text = (await tab.innerText()).replace(/,/g, ' ').replace(/\s+/g, ' ');
    const match = text.match(/Products\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  async getProductTitles(limit = 10): Promise<string[]> {
    const links = this.productTitleLinks();
    // Keep short so expect.poll can retry within uiSettleTimeoutMs.
    await links
      .first()
      .waitFor({ state: 'visible', timeout: 2_000 })
      .catch(() => undefined);
    const count = await links.count();
    const titles: string[] = [];
    for (let i = 0; i < count && titles.length < limit; i += 1) {
      const text = (await links.nth(i).innerText())
        .trim()
        .replace(/\s+/g, ' ');
      if (text) titles.push(text);
    }
    return titles;
  }

  async getProductCount(): Promise<number> {
    return this.productTitleLinks().count();
  }

  /** Wait for SERP product grid / tab metrics to reflect a filter change. */
  async waitForResultsUpdate(previousTabCount?: number | null): Promise<void> {
    await this.page
      .waitForURL(
        (url) => url.searchParams.has(FILTERS_FACETS_BEHAVIOR.filtersParam),
        {
          timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs,
        },
      )
      .catch(() => undefined);

    // Ensure mobile drawer is not covering the Products tab.
    await this.filters.closeMobileDrawerIfOpen();

    await expect
      .poll(
        async () => {
          const hasFilters = this.getFiltersParamRaw() !== null;
          if (!hasFilters) return false;

          const count = await this.getProductsTabCount();
          if (previousTabCount != null && previousTabCount > 0) {
            // Prefer proving the Products count changed; fall back to URL+count.
            if (count != null && count !== previousTabCount) return true;
            // Drawer/layout races: URL already filtered and count readable.
            return count != null && count > 0;
          }
          return count != null ? count > 0 : hasFilters;
        },
        { timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs },
      )
      .toBeTruthy();
  }

  getFiltersParamRaw(): string | null {
    try {
      return new URL(this.page.url()).searchParams.get(
        FILTERS_FACETS_BEHAVIOR.filtersParam,
      );
    } catch {
      return null;
    }
  }

  getFiltersState(): FiltersState {
    const raw = this.getFiltersParamRaw();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as FiltersState;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  async waitForFiltersState(
    predicate: (state: FiltersState) => boolean,
  ): Promise<void> {
    await expect
      .poll(() => predicate(this.getFiltersState()), {
        timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs,
      })
      .toBeTruthy();
  }

  async waitForFiltersCleared(): Promise<void> {
    await this.waitForFiltersState((state) => Object.keys(state).length === 0);
    await expect
      .poll(() => this.getFiltersParamRaw() === null, {
        timeout: FILTERS_FACETS_BEHAVIOR.uiSettleTimeoutMs,
      })
      .toBeTruthy();
  }

  facetValues(state: FiltersState, facet: string): string[] {
    const value = state[facet];
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
