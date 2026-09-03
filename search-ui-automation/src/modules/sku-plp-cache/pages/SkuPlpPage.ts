import { type Page } from '@playwright/test';
import { SearchPage } from '../../../core/pages/SearchPage';
import { SKU_PLP_BEHAVIOR, SKU_PLP_COPY } from '../data/behavior';
import { skusMatch } from '../data/skuLoader';

export type SkuLandingKind = 'search' | 'product' | 'unknown';

export type SkuLandingSnapshot = {
  url: string;
  landing: SkuLandingKind;
  queryParam: string | null;
  displayedSku: string | null;
  allDisplayedSkus: string[];
  heading: string | null;
  hasNoResults: boolean;
  hasSearchResultsHeading: boolean;
  productTitleCount: number;
};

/**
 * SKU search → product/SERP landing. Reuses core SearchPage/SearchBox only.
 */
export class SkuPlpPage {
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

  itemNumberSpans() {
    return this.page
      .locator('span.whitespace-nowrap')
      .filter({ hasText: SKU_PLP_COPY.itemNumberPrefix });
  }

  searchResultsHeading(query: string) {
    return this.page.getByRole('heading', {
      name: new RegExp(
        `${SKU_PLP_COPY.searchResultsHeadingPrefix}\\s+"${escapeRegExp(query)}"`,
        'i',
      ),
    });
  }

  noResultsHeading() {
    return this.page.getByRole('main').getByRole('heading', {
      name: SKU_PLP_COPY.noResultsHeading,
      exact: true,
    });
  }

  productTitleLinks() {
    return this.page.getByRole('main').locator('a.product-title');
  }

  /**
   * Clear → fill SKU → Enter. Does not reload the page (required for cache detection).
   */
  async searchSku(sku: string): Promise<void> {
    await this.searchPage.searchBox.ensureVisible();
    await this.searchPage.searchBox.focus();
    await this.searchPage.searchBox.clear();
    await this.searchPage.searchBox.type(sku);
    await this.searchPage.searchBox.pressEnter();
  }

  /**
   * Wait until navigation settles. Does **not** wait for the displayed SKU to
   * match — that would hide the stale-page bug.
   *
   * Item # from the previous product page is ignored as a stop condition so a
   * leftover SPA node cannot mask a later stale redirect.
   */
  async waitForLandingToSettle(sku: string, urlBefore: string): Promise<void> {
    await this.page.waitForURL(
      (url) =>
        isSearchUrlForSku(url, sku) ||
        (isProductUrl(url) && url.href !== urlBefore),
      { timeout: SKU_PLP_BEHAVIOR.uiSettleTimeoutMs },
    );

    if (isSearchUrlForSku(new URL(this.page.url()), sku)) {
      await Promise.race([
        this.page.waitForURL(isProductUrl, {
          timeout: SKU_PLP_BEHAVIOR.skuRedirectTimeoutMs,
        }),
        this.searchResultsHeading(sku).waitFor({
          state: 'visible',
          timeout: SKU_PLP_BEHAVIOR.skuRedirectTimeoutMs,
        }),
        this.noResultsHeading().waitFor({
          state: 'visible',
          timeout: SKU_PLP_BEHAVIOR.skuRedirectTimeoutMs,
        }),
      ]).catch(() => undefined);
    }

    await this.waitForUrlStable();

    if (isProductUrl(new URL(this.page.url()))) {
      await this.itemNumberSpans()
        .first()
        .waitFor({
          state: 'visible',
          timeout: SKU_PLP_BEHAVIOR.uiSettleTimeoutMs,
        })
        .catch(() => undefined);
    }
  }

  async waitForUrlStable(): Promise<void> {
    const started = Date.now();
    let last = this.page.url();
    let lastChange = Date.now();

    while (Date.now() - started < SKU_PLP_BEHAVIOR.urlStableMaxMs) {
      await this.page.waitForTimeout(100);
      const current = this.page.url();
      if (current !== last) {
        last = current;
        lastChange = Date.now();
        continue;
      }
      if (Date.now() - lastChange >= SKU_PLP_BEHAVIOR.urlStableMs) {
        return;
      }
    }
  }

  async snapshotLanding(searchedSku: string): Promise<SkuLandingSnapshot> {
    const url = this.page.url();
    const parsed = new URL(url);
    const allDisplayedSkus = await this.readDisplayedItemSkus();
    const heading = await this.page
      .locator('h1')
      .first()
      .innerText()
      .then((t) => t.trim().replace(/\s+/g, ' '))
      .catch(() => null);

    const hasNoResults = await this.noResultsHeading()
      .isVisible()
      .catch(() => false);
    const hasSearchResultsHeading = await this.searchResultsHeading(searchedSku)
      .isVisible()
      .catch(() => false);
    const productTitleCount = await this.productTitleLinks().count();

    return {
      url,
      landing: classifyLanding(parsed),
      queryParam: parsed.searchParams.get(SKU_PLP_BEHAVIOR.queryParam),
      displayedSku: allDisplayedSkus[0] ?? null,
      allDisplayedSkus,
      heading,
      hasNoResults,
      hasSearchResultsHeading,
      productTitleCount,
    };
  }

  async readDisplayedItemSkus(): Promise<string[]> {
    const spans = this.itemNumberSpans();
    const count = await spans.count();
    const seen = new Set<string>();
    const skus: string[] = [];

    for (let i = 0; i < count && skus.length < 12; i += 1) {
      const visible = await spans.nth(i).isVisible().catch(() => false);
      if (!visible) continue;
      const text = (await spans.nth(i).innerText()).replace(/\s+/g, ' ').trim();
      const sku = parseItemNumber(text);
      if (!sku) continue;
      const key = sku.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      skus.push(sku);
    }

    if (skus.length === 0) {
      const fallback = this.page.getByText(SKU_PLP_COPY.itemNumberPrefix).first();
      if (await fallback.isVisible().catch(() => false)) {
        const sku = parseItemNumber(
          (await fallback.innerText()).replace(/\s+/g, ' ').trim(),
        );
        if (sku) skus.push(sku);
      }
    }

    return skus;
  }
}

export function parseItemNumber(text: string): string | null {
  const match = text.match(/Item\s*#\s*([A-Za-z0-9/_-]+)/i);
  return match?.[1]?.trim() || null;
}

export function classifyLanding(url: URL): SkuLandingKind {
  if (url.pathname === SKU_PLP_BEHAVIOR.searchPath) return 'search';
  if (url.pathname.startsWith(SKU_PLP_BEHAVIOR.productPathPrefix)) {
    return 'product';
  }
  return 'unknown';
}

export function isProductUrl(url: URL): boolean {
  return url.pathname.startsWith(SKU_PLP_BEHAVIOR.productPathPrefix);
}

export function isSearchUrlForSku(url: URL, sku: string): boolean {
  if (url.pathname !== SKU_PLP_BEHAVIOR.searchPath) return false;
  if (!url.searchParams.has(SKU_PLP_BEHAVIOR.queryParam)) return false;
  const q = url.searchParams.get(SKU_PLP_BEHAVIOR.queryParam) ?? '';
  return skusMatch(q, sku);
}

export function productPathKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith(SKU_PLP_BEHAVIOR.productPathPrefix)) {
      return null;
    }
    return parsed.pathname.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
