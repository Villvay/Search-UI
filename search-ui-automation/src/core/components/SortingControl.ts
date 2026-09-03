import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Sorting control selectors for QA SERP.
 *
 * Inspection (2026-09-02): QA does **not** expose a dedicated sorting control
 * on desktop, tablet, or mobile. Mobile **Filters & sort** opens a filters-only
 * drawer (no Sort section / options).
 *
 * Locators below target real sorting UI if/when it ships; `isPresent()` is the
 * gate used by the Sorting module.
 */
export const SORTING_CONTROL = {
  uiSettleTimeoutMs: 15_000,
  /** Mobile combined trigger — label includes "sort" but drawer is filters-only today. */
  mobileFiltersAndSortName: /Filters\s*&\s*sort/i,
  /** Dedicated sorting control candidates (role / name based). */
  controlName: /^(sort|sort by|order by)$/i,
  optionRoles: ['option', 'menuitem', 'menuitemradio', 'radio'] as const,
} as const;

export class SortingControl {
  constructor(readonly page: Page) {}

  /**
   * Dedicated sorting control: combobox / listbox / select / button named Sort.
   * Does **not** treat the mobile "Filters & sort" filters trigger as sorting.
   */
  control(): Locator {
    return this.page
      .getByRole('combobox', { name: SORTING_CONTROL.controlName })
      .or(this.page.getByRole('listbox', { name: SORTING_CONTROL.controlName }))
      .or(this.page.getByLabel(SORTING_CONTROL.controlName))
      .or(this.page.getByRole('button', { name: SORTING_CONTROL.controlName }))
      .or(this.page.locator('select[name*="sort" i], select[id*="sort" i]'))
      .or(this.page.getByTestId(/sort/i))
      .locator('visible=true')
      .first();
  }

  mobileFiltersAndSortTrigger(): Locator {
    return this.page.getByRole('button', {
      name: SORTING_CONTROL.mobileFiltersAndSortName,
    });
  }

  mobileDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  async isPresent(): Promise<boolean> {
    return this.control().isVisible().catch(() => false);
  }

  async openIfNeeded(): Promise<void> {
    const control = this.control();
    await expect(control).toBeVisible({
      timeout: SORTING_CONTROL.uiSettleTimeoutMs,
    });
    const expanded = await control.getAttribute('aria-expanded');
    const tag = await control.evaluate((el) => el.tagName);
    if (tag === 'SELECT') return;
    if (expanded === 'false' || expanded === null) {
      await control.click();
    }
  }

  async getAvailableOptions(): Promise<string[]> {
    await this.openIfNeeded();
    const control = this.control();
    const tag = await control.evaluate((el) => el.tagName);
    if (tag === 'SELECT') {
      return control.locator('option').evaluateAll((opts) =>
        opts
          .map((o) => (o.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean),
      );
    }

    const labels: string[] = [];
    for (const role of SORTING_CONTROL.optionRoles) {
      const opts = this.page.getByRole(role);
      const count = await opts.count();
      for (let i = 0; i < count; i += 1) {
        const text = (await opts.nth(i).innerText())
          .replace(/\s+/g, ' ')
          .trim();
        if (text && !labels.includes(text)) labels.push(text);
      }
    }
    return labels;
  }

  async getSelectedLabel(): Promise<string | null> {
    if (!(await this.isPresent())) return null;
    const control = this.control();
    const tag = await control.evaluate((el) => el.tagName);
    if (tag === 'SELECT') {
      return control.locator('option:checked').innerText().then((t) =>
        t.replace(/\s+/g, ' ').trim(),
      );
    }
    const text = (await control.innerText()).replace(/\s+/g, ' ').trim();
    return text || (await control.getAttribute('aria-label'));
  }

  async selectOption(label: string): Promise<void> {
    await this.openIfNeeded();
    const control = this.control();
    const tag = await control.evaluate((el) => el.tagName);
    if (tag === 'SELECT') {
      await control.selectOption({ label });
      return;
    }
    await this.page.getByRole('option', { name: label }).or(
      this.page.getByRole('menuitem', { name: label }),
    ).or(
      this.page.getByRole('menuitemradio', { name: label }),
    ).or(
      this.page.getByRole('radio', { name: label }),
    ).first().click();
  }

  /**
   * Mobile drawer note: opens "Filters & sort" and reports whether any Sort UI
   * exists inside the dialog (expected: none on current QA).
   */
  async inspectMobileDrawerForSortUi(): Promise<{
    triggerVisible: boolean;
    dialogOpened: boolean;
    hasSortHeading: boolean;
    hasSortOptions: boolean;
  }> {
    const trigger = this.mobileFiltersAndSortTrigger();
    const triggerVisible = await trigger.isVisible().catch(() => false);
    if (!triggerVisible) {
      return {
        triggerVisible: false,
        dialogOpened: false,
        hasSortHeading: false,
        hasSortOptions: false,
      };
    }
    await trigger.click();
    const dialog = this.mobileDialog();
    await expect(dialog).toBeVisible({
      timeout: SORTING_CONTROL.uiSettleTimeoutMs,
    });
    const hasSortHeading = await dialog
      .getByRole('heading', { name: /^Sort(\s+by)?$/i })
      .or(dialog.getByText(/^Sort(\s+by)?$/i))
      .first()
      .isVisible()
      .catch(() => false);
    const hasSortOptions =
      (await dialog.locator('[data-testid*="sort" i]').count()) > 0 ||
      (await dialog.getByRole('radio').count()) > 0;
    const close = dialog.getByRole('button', { name: /^Close$/i }).first();
    if (await close.isVisible().catch(() => false)) {
      await close.click();
      await expect(dialog).toBeHidden({
        timeout: SORTING_CONTROL.uiSettleTimeoutMs,
      });
    } else {
      await this.page.keyboard.press('Escape');
    }
    return {
      triggerVisible: true,
      dialogOpened: true,
      hasSortHeading,
      hasSortOptions,
    };
  }
}
