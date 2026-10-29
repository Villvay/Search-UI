import { type Locator, type Page } from '@playwright/test';
import { RECENT_SEARCHES_COPY } from '../data/behavior';

export class RecentSearchesSection {
  constructor(private readonly page: Page) {}

  heading(): Locator {
    return this.page.getByRole('heading', {
      name: RECENT_SEARCHES_COPY.sectionHeading,
      exact: true,
    });
  }

  list(): Locator {
    return this.heading().locator('xpath=following-sibling::*[1]');
  }

  queryButtons(): Locator {
    return this.page
      .locator('visible=true')
      .locator('button, a')
      .filter({ hasNotText: /Remove recent search/i });
  }

  queryButton(query: string): Locator {
    return this.page
      .getByRole('button', { name: query, exact: true })
      .locator('visible=true')
      .first();
  }

  removeButton(query: string): Locator {
    return this.page.getByRole('button', {
      name: RECENT_SEARCHES_COPY.removeButtonName(query),
      exact: true,
    }).locator('visible=true').first();
  }

  async getQueryTexts(): Promise<string[]> {
    const heading = this.heading().locator('visible=true').first();
    if (!(await heading.isVisible().catch(() => false))) return [];
    return heading.evaluate((h) => {
      const root = h.parentElement;
      if (!root) return [];
      return [...root.querySelectorAll('button, a')]
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((t) => t && !/^Remove recent search/i.test(t));
    });
  }

  async getItemCount(): Promise<number> {
    return (await this.getQueryTexts()).length;
  }
}
