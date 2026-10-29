import { expect, type Locator, type Page } from '@playwright/test';
import { SEARCH_SELECTORS } from '../../../config/selectors';

/**
 * Header search input on Würth LAC.
 * Inspected: placeholder "What are you looking for?", name="query".
 */
export class SearchBox {
  constructor(private readonly page: Page) {}

  input(): Locator {
    const byName = this.page.getByRole(SEARCH_SELECTORS.inputRole, {
      name: SEARCH_SELECTORS.inputAccessibleName,
    });
    const byPlaceholder = this.page.getByPlaceholder(
      SEARCH_SELECTORS.inputPlaceholder,
    );
    const byAttr = this.page.locator(
      `input[name="${SEARCH_SELECTORS.inputNameAttr}"]`,
    );
    return byName.or(byPlaceholder).or(byAttr).locator('visible=true').first();
  }

  async ensureVisible(): Promise<Locator> {
    const input = this.input();

    if (await input.isVisible().catch(() => false)) {
      return input;
    }

    const toggle = this.page.getByRole('button', {
      name: SEARCH_SELECTORS.openSearchButtonName,
      exact: true,
    }).locator('visible=true').first();

    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
    }

    await input.waitFor({ state: 'visible' });
    return input;
  }

  async getValue(): Promise<string> {
    const input = await this.ensureVisible();
    return input.inputValue();
  }

  /**
   * Focus the header search field.
   * Firefox can hang on locator.click() at "performing click action" even when
   * the input is visible and stable. Fall back to focus() so the idle overlay
   * still has a chance to open; do not treat a missed overlay as success.
   */
  async focus(): Promise<void> {
    const input = await this.ensureVisible();
    await this.clickOrFocus(input);
  }

  async type(text: string): Promise<void> {
    const input = await this.ensureVisible();
    await input.fill(text);
  }

  async typeSequentially(text: string, delayMs = 40): Promise<void> {
    const input = await this.ensureVisible();
    await this.clickOrFocus(input);
    await this.page.keyboard.type(text, { delay: delayMs });
  }

  private async clickOrFocus(input: Locator): Promise<void> {
    try {
      await input.click({ timeout: 8_000 });
    } catch {
      await input.focus();
    }
    await expect(input).toBeFocused();
  }

  async clear(): Promise<void> {
    const input = await this.ensureVisible();
    const clearBtn = this.page.getByRole('button', {
      name: SEARCH_SELECTORS.clearSearchButtonName,
      exact: true,
    });
    if (await clearBtn.first().isVisible().catch(() => false)) {
      await clearBtn.first().click();
      return;
    }
    await input.fill('');
  }

  async pressEnter(): Promise<void> {
    const input = await this.ensureVisible();
    await input.press('Enter');
  }
}
