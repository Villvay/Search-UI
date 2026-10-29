/**
 * Würth LAC search dropdown.
 *
 * Inspected on https://wurthlac.com (2026-10-29):
 * - Idle: “Our search bar just got smarter” plus “Your recent searches” when history exists.
 * - Active query: [data-search-column="results"] with Products / Catalogs / Resources tabs,
 *   “Categories for …”, “Products for …”. No [data-search-column="suggestions"]
 *   and no [data-search-suggestion] chips.
 */
import { type Locator, type Page } from '@playwright/test';

export const DROPDOWN_SELECTORS = {
  resultsColumn: '[data-search-column="results"]',
  suggestionsColumn: '[data-search-column="suggestions"]',
} as const;

export class SearchDropdown {
  constructor(private readonly page: Page) {}

  panel(): Locator {
    return this.page
      .locator('div.relative.z-50')
      .filter({
        has: this.page.locator(
          `${DROPDOWN_SELECTORS.resultsColumn}, h4, h2`,
        ),
      })
      .locator('visible=true')
      .first();
  }

  resultsColumn(): Locator {
    return this.page
      .locator(DROPDOWN_SELECTORS.resultsColumn)
      .locator('visible=true')
      .first();
  }

  suggestionsColumn(): Locator {
    return this.page
      .locator(DROPDOWN_SELECTORS.suggestionsColumn)
      .locator('visible=true')
      .first();
  }

  productsHeading(query?: string): Locator {
    if (query) {
      return this.page.getByRole('heading', {
        name: `Products for "${query}"`,
        exact: true,
      });
    }
    return this.page.getByRole('heading', { name: /^Products for "/i });
  }

  categoriesHeading(query?: string): Locator {
    if (query) {
      return this.page.getByRole('heading', {
        name: `Categories for "${query}"`,
        exact: true,
      });
    }
    return this.page.getByRole('heading', { name: /^Categories for "/i });
  }

  resultTabs(): Locator {
    return this.resultsColumn().getByRole('tab');
  }

  productLinks(): Locator {
    return this.resultsColumn().locator('a[href^="/product/"]');
  }

  categoryLinks(): Locator {
    return this.resultsColumn().locator('a[href^="/category/"]');
  }

  moreLink(): Locator {
    return this.resultsColumn().locator('a[href^="/search"]').filter({
      hasText: /^More$/i,
    });
  }

  recentHeading(): Locator {
    return this.page.getByRole('heading', {
      name: 'Your recent searches',
      exact: true,
    });
  }

  smarterBanner(): Locator {
    return this.page.getByText('Our search bar just got smarter', {
      exact: false,
    });
  }

  trendingHeading(): Locator {
    return this.page.getByRole('heading', {
      name: 'Trending now',
      exact: true,
    });
  }

  async isVisible(): Promise<boolean> {
    if (await this.resultsColumn().isVisible().catch(() => false)) {
      return true;
    }
    if (await this.recentHeading().isVisible().catch(() => false)) {
      return true;
    }
    if (await this.smarterBanner().first().isVisible().catch(() => false)) {
      return true;
    }
    if (await this.trendingHeading().isVisible().catch(() => false)) {
      return true;
    }
    return this.panel().isVisible().catch(() => false);
  }

  async isResultsColumnVisible(): Promise<boolean> {
    return this.resultsColumn().isVisible().catch(() => false);
  }

  async waitForResults(timeoutMs = 15_000): Promise<void> {
    await this.resultsColumn().waitFor({ state: 'visible', timeout: timeoutMs });
  }

  async getProductTexts(): Promise<string[]> {
    if (!(await this.isResultsColumnVisible())) {
      return [];
    }
    const count = await this.productLinks().count();
    const texts: string[] = [];
    for (let i = 0; i < Math.min(count, 12); i += 1) {
      const text = (await this.productLinks().nth(i).innerText())
        .trim()
        .replace(/\s+/g, ' ');
      if (text) texts.push(text);
    }
    return texts;
  }

  async clickFirstProduct(): Promise<void> {
    await this.productLinks().first().click();
  }

  async clickFirstCategory(): Promise<void> {
    await this.categoryLinks().first().click();
  }
}
