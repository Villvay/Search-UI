import { expect, type Page } from '@playwright/test';
import { getEnvironmentConfig } from '../../../config/environments';
import { SearchBox } from '../components/SearchBox';
import { BasePage } from './BasePage';

/**
 * Search page object — Step 1 surface only.
 * Feature behaviors (on-type, suggestions, filters, results, etc.) will live
 * in independent modules under src/modules/ and must not bloat this class.
 */
export class SearchPage extends BasePage {
  readonly searchBox: SearchBox;

  constructor(page: Page) {
    super(page);
    this.searchBox = new SearchBox(page);
  }

  /**
   * Opens the storefront entry where the global search input is available.
   * Search results live under /search; the input itself is on the site header.
   *
   * Retries when Vercel Deployment Protection intermittently shows the
   * "Failed to verify your browser" checkpoint (common under parallel workers).
   * The checkpoint can appear after networkidle, so ensureVisible failures are
   * also retried when the checkpoint is present.
   */
  async open(): Promise<void> {
    const env = getEnvironmentConfig();
    // WebKit on macOS 14 is consistently blocked by Vercel Code 21; avoid long retries.
    const isWebKit =
      this.page.context().browser()?.browserType().name() === 'webkit';
    const maxAttempts = isWebKit ? 1 : 3;
    const checkpoint = () =>
      this.page.getByText('Failed to verify your browser', { exact: false });

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.goto(env.homePath);
      // Prefer search-input readiness over broad networkidle (SPAs stay chatty).

      const blockedEarly = await checkpoint()
        .isVisible()
        .catch(() => false);

      if (blockedEarly) {
        lastError = new Error(
          `Vercel Security Checkpoint blocked page load (attempt ${attempt}/${maxAttempts}). Set VERCEL_AUTOMATION_BYPASS_SECRET or retry.`,
        );
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
          lastError = new Error(
            `Vercel Security Checkpoint blocked page load (attempt ${attempt}/${maxAttempts}). Set VERCEL_AUTOMATION_BYPASS_SECRET or retry.`,
          );
        }
        if (attempt < maxAttempts) {
          continue;
        }
        throw lastError;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Unable to open search page');
  }

  async expectSearchInputVisible(): Promise<void> {
    const input = await this.searchBox.ensureVisible();
    await expect(input).toBeVisible();
  }

  /**
   * Opens the Search Results Page for a query via direct navigation.
   * Feature modules should use this instead of depending on on-enter/suggestions.
   * Retries on Vercel Security Checkpoint the same way as open().
   */
  async openSearchResults(query: string): Promise<void> {
    const env = getEnvironmentConfig();
    const isWebKit =
      this.page.context().browser()?.browserType().name() === 'webkit';
    const maxAttempts = isWebKit ? 1 : 3;
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
        lastError = new Error(
          `Vercel Security Checkpoint blocked SERP load (attempt ${attempt}/${maxAttempts}). Set VERCEL_AUTOMATION_BYPASS_SECRET or retry.`,
        );
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
          lastError = new Error(
            `Vercel Security Checkpoint blocked SERP load (attempt ${attempt}/${maxAttempts}). Set VERCEL_AUTOMATION_BYPASS_SECRET or retry.`,
          );
        }
        if (attempt < maxAttempts) {
          continue;
        }
        throw lastError;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Unable to open search results page');
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
