import { type Page } from '@playwright/test';
import { SUGGESTIONS_COPY } from '../data/behavior';

/**
 * Module-specific trending section helpers (idle dropdown).
 *
 * Live a11y tree (WBS QA):
 * heading "Trending now" (level 4)
 *   └─ list > listitem > button "<term>"
 */
export class TrendingSection {
  constructor(private readonly page: Page) {}

  heading() {
    return this.page.getByRole('heading', {
      name: SUGGESTIONS_COPY.trendingHeading,
      exact: true,
    });
  }

  list() {
    return this.heading().locator('xpath=following-sibling::ul[1]');
  }

  items() {
    return this.list().getByRole('button');
  }
}
