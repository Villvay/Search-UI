import { test as base } from '@playwright/test';
import { SearchPage } from '../pages/SearchPage';

type SearchFixtures = {
  searchPage: SearchPage;
};

/**
 * Shared Playwright fixtures. Feature modules should extend this (or base)
 * rather than coupling to each other.
 */
export const test = base.extend<SearchFixtures>({
  searchPage: async ({ page }, use) => {
    await use(new SearchPage(page));
  },
});

export { expect } from '@playwright/test';
