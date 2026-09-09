import { expect, type Locator, type Page } from '@playwright/test';
import { SearchPage } from '../../../core/pages/SearchPage';
import {
  SEARCH_INPUT_ROBUSTNESS_BEHAVIOR,
  SEARCH_INPUT_ROBUSTNESS_COPY,
} from '../data/behavior';
import {
  captureSerpSnapshot,
  headingMatchesQuery,
  type SerpSnapshot,
} from '../utils/inputSafetyHelpers';

/**
 * Search input robustness page — core SearchPage only; no other feature modules.
 */
export class SearchInputRobustnessPage {
  readonly searchPage: SearchPage;

  constructor(readonly page: Page) {
    this.searchPage = new SearchPage(page);
  }

  input(): Locator {
    return this.searchPage.searchBox.input();
  }

  async openHome(): Promise<void> {
    await this.searchPage.open();
  }

  async focusSearch(): Promise<void> {
    await this.searchPage.searchBox.focus();
  }

  async fillQuery(query: string): Promise<void> {
    await this.searchPage.searchBox.clear();
    await this.searchPage.searchBox.type(query);
  }

  async clearSearchUi(): Promise<void> {
    const clearBtn = this.page.getByRole('button', {
      name: SEARCH_INPUT_ROBUSTNESS_COPY.clearSearch,
      exact: true,
    });
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
    } else {
      await this.searchPage.searchBox.clear();
    }
  }

  async pressEnter(): Promise<void> {
    await this.searchPage.searchBox.pressEnter();
  }

  /** Fill + Enter and wait until URL q matches (decoded via URLSearchParams). */
  async searchExpectingSerp(query: string): Promise<SerpSnapshot> {
    await this.focusSearch();
    await this.fillQuery(query);
    await Promise.all([
      this.page.waitForURL(
        (url) =>
          url.pathname === SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.searchPath &&
          (url.searchParams.get(
            SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.queryParam,
          ) ?? '') === query,
        { timeout: SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.uiSettleTimeoutMs },
      ),
      this.pressEnter(),
    ]);
    await this.waitForSerpSettled(query);
    return this.snapshot();
  }

  async waitForSerpSettled(query: string): Promise<void> {
    await expect
      .poll(
        async () => {
          const id = await captureSerpSnapshot(this.page);
          return (
            id.q === query &&
            id.inputValue === query &&
            headingMatchesQuery(id.heading, query)
          );
        },
        { timeout: SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.uiSettleTimeoutMs },
      )
      .toBeTruthy();
  }

  async snapshot(): Promise<SerpSnapshot> {
    return captureSerpSnapshot(this.page);
  }

  trendingHeading(): Locator {
    return this.page.getByRole('heading', {
      name: SEARCH_INPUT_ROBUSTNESS_COPY.trendingHeading,
      exact: true,
    });
  }

  noResultsHeading(): Locator {
    return this.page.getByRole('heading', {
      name: SEARCH_INPUT_ROBUSTNESS_COPY.noResultsHeading,
      exact: true,
    });
  }

  async inputMaxLengthAttr(): Promise<string | null> {
    return this.input().getAttribute('maxlength');
  }

  isOnSearchPath(url = this.page.url()): boolean {
    try {
      return new URL(url).pathname === SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.searchPath;
    } catch {
      return false;
    }
  }

  isOnHomePath(url = this.page.url()): boolean {
    try {
      const p = new URL(url).pathname;
      return p === '/' || p === '';
    } catch {
      return false;
    }
  }
}
