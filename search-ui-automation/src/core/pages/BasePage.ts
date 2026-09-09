import { expect, type Page, type Response } from '@playwright/test';
import { withVercelBypassQuery } from '../../../config/environments';

/**
 * Minimal shared page helpers. Search-specific logic belongs in SearchPage / components.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(
    path = '/',
    options?: Parameters<Page['goto']>[1],
  ): Promise<Response | null> {
    return this.page.goto(withVercelBypassQuery(path), {
      waitUntil: 'domcontentloaded',
      ...options,
    });
  }

  async waitForNetworkIdle(timeoutMs = 8_000): Promise<void> {
    try {
      await this.page.waitForLoadState('networkidle', { timeout: timeoutMs });
    } catch {
      // Soft wait — SPAs may keep long-lived connections open.
    }
  }

  url(): URL {
    return new URL(this.page.url());
  }

  async expectPathname(pathname: string): Promise<void> {
    await expect(this.page).toHaveURL((url) => url.pathname === pathname);
  }
}
