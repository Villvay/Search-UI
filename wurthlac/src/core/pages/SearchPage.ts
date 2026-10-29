import { expect, type Page } from '@playwright/test';
import {
  describeVercelBypassConfig,
  getEnvironmentConfig,
} from '../../../config/environments';
import { SearchBox } from '../components/SearchBox';
import { BasePage } from './BasePage';

export class SearchPage extends BasePage {
  readonly searchBox: SearchBox;

  constructor(page: Page) {
    super(page);
    this.searchBox = new SearchBox(page);
  }

  private async checkpointBlockedError(
    kind: 'page load' | 'SERP load',
    attempt: number,
    maxAttempts: number,
  ): Promise<Error> {
    const ua = await this.page.evaluate(() => navigator.userAgent).catch(() => 'unknown');
    return new Error(
      `Security checkpoint blocked ${kind} (attempt ${attempt}/${maxAttempts}). ` +
        `navigator.userAgent=${ua}. ${describeVercelBypassConfig()}.`,
    );
  }

  async open(): Promise<void> {
    const env = getEnvironmentConfig();
    const maxAttempts = 3;
    const checkpoint = () =>
      this.page.getByText('Failed to verify your browser', { exact: false });

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.goto(env.homePath);

      const blockedEarly = await checkpoint()
        .isVisible()
        .catch(() => false);

      if (blockedEarly) {
        lastError = await this.checkpointBlockedError('page load', attempt, maxAttempts);
        continue;
      }

      try {
        await this.searchBox.ensureVisible();
        return;
      } catch (error) {
        lastError = error;
        const blockedLate = await checkpoint()
          .isVisible()
          .catch(() => false);
        if (blockedLate) {
          lastError = await this.checkpointBlockedError('page load', attempt, maxAttempts);
        }
        if (attempt < maxAttempts) {
          continue;
        }
        throw lastError;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Unable to open Würth LAC search page');
  }

  async expectSearchInputVisible(): Promise<void> {
    const input = await this.searchBox.ensureVisible();
    await expect(input).toBeVisible();
  }

  async openSearchResults(query: string): Promise<void> {
    const env = getEnvironmentConfig();
    const maxAttempts = 3;
    const checkpoint = () =>
      this.page.getByText('Failed to verify your browser', { exact: false });
    const path = `${env.searchPath}?q=${encodeURIComponent(query)}`;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.goto(path);

      const blockedEarly = await checkpoint()
        .isVisible()
        .catch(() => false);

      if (blockedEarly) {
        lastError = await this.checkpointBlockedError('SERP load', attempt, maxAttempts);
        continue;
      }

      try {
        await this.page.waitForURL(
          (url) =>
            url.pathname === env.searchPath &&
            (url.searchParams.get('q') ?? '') === query,
          { timeout: 20_000 },
        );
        await this.searchBox.ensureVisible();
        return;
      } catch (error) {
        lastError = error;
        const blockedLate = await checkpoint()
          .isVisible()
          .catch(() => false);
        if (blockedLate) {
          lastError = await this.checkpointBlockedError('SERP load', attempt, maxAttempts);
        }
        if (attempt < maxAttempts) {
          continue;
        }
        throw lastError;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Unable to open Würth LAC search results page');
  }

  async enterSearchText(text: string): Promise<void> {
    await this.searchBox.type(text);
  }

  async readSearchText(): Promise<string> {
    return this.searchBox.getValue();
  }

  async clearSearchText(): Promise<void> {
    await this.searchBox.clear();
  }
}
