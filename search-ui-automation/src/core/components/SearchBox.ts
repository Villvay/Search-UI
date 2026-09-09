import { type Locator, type Page } from '@playwright/test';
import { SEARCH_SELECTORS } from '../../../config/selectors';

/**
 * Reusable interactions for the header search input.
 * Intentionally limited to input locate / read / type / clear for Step 1.
 */
export class SearchBox {
  constructor(private readonly page: Page) {}

  /**
   * Primary locator: accessible role + name from placeholder.
   * .first() guards against duplicate desktop/mobile DOM instances.
   */
  input(): Locator {
    return this.page
      .getByRole(SEARCH_SELECTORS.inputRole, {
        name: SEARCH_SELECTORS.inputAccessibleName,
      })
      .first();
  }

  async ensureVisible(): Promise<Locator> {
    const input = this.input();

    if (await input.isVisible()) {
      return input;
    }

    const toggle = this.page.getByRole('button', {
      name: SEARCH_SELECTORS.openSearchButtonName,
      exact: true,
    });

    if ((await toggle.count()) > 0 && (await toggle.first().isVisible())) {
      await toggle.first().click();
    }

    await input.waitFor({ state: 'visible' });
    return input;
  }

  async getValue(): Promise<string> {
    const input = await this.ensureVisible();
    return input.inputValue();
  }

  async focus(): Promise<void> {
    const input = await this.ensureVisible();
    await input.click();
  }

  async type(text: string): Promise<void> {
    const input = await this.ensureVisible();
    await input.fill(text);
  }

  /**
   * Types into the focused search input character-by-character.
   * Useful for on-type / debounce scenarios (does not submit).
   */
  async typeSequentially(text: string, delayMs = 40): Promise<void> {
    const input = await this.ensureVisible();
    await input.click();
    await this.page.keyboard.type(text, { delay: delayMs });
  }

  async clear(): Promise<void> {
    const input = await this.ensureVisible();
    await input.fill('');
  }

  /** Presses Enter on the search input (does not assert navigation). */
  async pressEnter(): Promise<void> {
    const input = await this.ensureVisible();
    await input.press('Enter');
  }
}
