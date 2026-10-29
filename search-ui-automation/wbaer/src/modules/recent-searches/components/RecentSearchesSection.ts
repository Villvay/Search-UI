import { type Locator, type Page } from '@playwright/test';
import {
  RECENT_SEARCHES_BEHAVIOR,
  RECENT_SEARCHES_COPY,
} from '../data/behavior';

/**
 * Scoped Your Recent Searches section inside the idle search dropdown.
 * Avoids Trending Now / suggestions / product rows.
 */
export class RecentSearchesSection {
  constructor(private readonly page: Page) {}

  heading(): Locator {
    return this.page
      .getByRole('heading', {
        name: RECENT_SEARCHES_COPY.sectionHeading,
        exact: true,
      })
      .locator('visible=true');
  }

  /** Ordered list immediately under the section heading. */
  list(): Locator {
    return this.heading().first().locator('xpath=following-sibling::ol[1]');
  }

  rows(): Locator {
    return this.list().locator(':scope > li');
  }

  /** Query select buttons only (first button in each row). */
  queryButtons(): Locator {
    return this.rows().locator(':scope > button').first();
  }

  queryButton(query: string): Locator {
    return this.list().getByRole('button', { name: query, exact: true });
  }

  removeButton(query: string): Locator {
    return this.list()
      .getByRole('button', {
        name: RECENT_SEARCHES_COPY.removeButtonName(query),
        exact: true,
      });
  }

  rowForQuery(query: string): Locator {
    return this.rows().filter({
      has: this.page.getByRole('button', { name: query, exact: true }),
    });
  }

  async getQueryTexts(): Promise<string[]> {
    const count = await this.rows().count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (
        await this.rows().nth(i).locator(':scope > button').first().innerText()
      ).trim();
      if (text) texts.push(text);
    }
    return texts;
  }

  async getItemCount(): Promise<number> {
    return this.rows().count();
  }
}

export async function readRecentSearchesStorage(
  page: Page,
): Promise<string[] | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : null;
    } catch {
      return null;
    }
  }, RECENT_SEARCHES_BEHAVIOR.storageKey);
}

/** Clears only the recent-searches key — leaves other app storage intact. */
export async function clearRecentSearchesStorage(page: Page): Promise<void> {
  await page.evaluate((key) => {
    localStorage.removeItem(key);
  }, RECENT_SEARCHES_BEHAVIOR.storageKey);
}

/**
 * Seeds newest-first history matching the app contract.
 * Caller should reload (or remount) before opening the dropdown.
 */
export async function seedRecentSearchesStorage(
  page: Page,
  newestFirstQueries: string[],
): Promise<void> {
  const capped = newestFirstQueries.slice(
    0,
    RECENT_SEARCHES_BEHAVIOR.maxDisplayed,
  );
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: RECENT_SEARCHES_BEHAVIOR.storageKey, value: capped },
  );
}
