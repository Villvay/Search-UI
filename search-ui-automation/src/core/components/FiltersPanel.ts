import { type Locator, type Page, expect } from '@playwright/test';

/** Selector / copy constants for the SERP Filters accordion (QA-inspected). */
export const FILTERS_PANEL = {
  accordionTestId: 'accordion-filter',
  productGridTestId: 'container-productGrid',
  mobileDrawerContentTestId: 'drawer-mobileDrawerContent',
  triggerPrefix: 'trigger-',
  contentPrefix: 'content-',
  itemPrefix: 'item-',
  checkboxPrefix: 'checkbox-',
  panelHeading: 'Filters',
  mobileTriggerName: /Filters\s*&\s*sort/i,
  clearAllName: /^Clear all$/i,
  uiSettleTimeoutMs: 30_000,
} as const;

/**
 * SERP Filters / Facets accordion panel.
 * Shared core component — feature specs should not inline these selectors.
 *
 * On mobile, QA keeps a product-grid accordion in the DOM plus a drawer copy.
 * Interactions must target the visible accordion only.
 */
export class FiltersPanel {
  constructor(readonly page: Page) {}

  /**
   * Visible accordion only (drawer when open, otherwise product-grid aside).
   * Avoids strict-mode failures when both nodes exist in the DOM.
   */
  root(): Locator {
    return this.page
      .locator(
        [
          `[data-testid="${FILTERS_PANEL.mobileDrawerContentTestId}"] [data-testid="${FILTERS_PANEL.accordionTestId}"]`,
          `[data-testid="${FILTERS_PANEL.productGridTestId}"] [data-testid="${FILTERS_PANEL.accordionTestId}"]`,
          `[data-testid="${FILTERS_PANEL.accordionTestId}"]`,
        ].join(', '),
      )
      .locator('visible=true')
      .first();
  }

  panelHeading(): Locator {
    // Prefer heading inside the active accordion panel when available.
    return this.root()
      .getByRole('heading', {
        name: FILTERS_PANEL.panelHeading,
        exact: true,
      })
      .or(
        this.page.getByRole('heading', {
          name: FILTERS_PANEL.panelHeading,
          exact: true,
        }),
      )
      .first();
  }

  mobileTrigger(): Locator {
    return this.page.getByRole('button', {
      name: FILTERS_PANEL.mobileTriggerName,
    });
  }

  mobileDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  facetTrigger(facetName: string): Locator {
    return this.root().getByTestId(
      `${FILTERS_PANEL.triggerPrefix}${facetName}`,
    );
  }

  facetContent(facetName: string): Locator {
    return this.root().getByTestId(
      `${FILTERS_PANEL.contentPrefix}${facetName}`,
    );
  }

  facetItem(facetName: string): Locator {
    return this.root().getByTestId(`${FILTERS_PANEL.itemPrefix}${facetName}`);
  }

  optionCheckbox(facetName: string, optionValue: string): Locator {
    return this.root().getByTestId(
      `${FILTERS_PANEL.checkboxPrefix}${facetName}-${optionValue}`,
    );
  }

  clearAllButton(): Locator {
    return this.root()
      .getByRole('button', { name: FILTERS_PANEL.clearAllName })
      .or(this.page.getByRole('button', { name: FILTERS_PANEL.clearAllName }))
      .first();
  }

  async isAccordionVisible(): Promise<boolean> {
    return this.root().isVisible().catch(() => false);
  }

  async openMobileDrawerIfNeeded(): Promise<void> {
    if (await this.isAccordionVisible()) {
      return;
    }
    const trigger = this.mobileTrigger();
    await expect(trigger).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
    await trigger.click();
    await expect(this.mobileDialog()).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
    await expect(this.root()).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
  }

  /** Closes the mobile Filters & sort drawer so SERP metrics are readable. */
  async closeMobileDrawerIfOpen(): Promise<void> {
    const dialog = this.mobileDialog();
    if (!(await dialog.isVisible().catch(() => false))) {
      return;
    }
    const close = dialog.getByRole('button', { name: /^Close$/i }).first();
    if (await close.isVisible().catch(() => false)) {
      await close.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await expect(dialog).toBeHidden({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
  }

  async ensureVisible(): Promise<void> {
    await this.openMobileDrawerIfNeeded();
    await expect(this.root()).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
  }

  async expandFacet(facetName: string): Promise<void> {
    await this.ensureVisible();
    const trigger = this.facetTrigger(facetName);
    await expect(trigger).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
    const expanded = await trigger.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await trigger.click();
    }
    await expect(this.facetContent(facetName)).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
  }

  async getFacetNames(): Promise<string[]> {
    await this.ensureVisible();
    return this.root().evaluate((root) =>
      [...root.querySelectorAll('h3')]
        .map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    );
  }

  async getVisibleOptionLabels(facetName: string): Promise<string[]> {
    await this.expandFacet(facetName);
    const content = this.facetContent(facetName);
    return content.evaluate((root) =>
      [...root.querySelectorAll('label')]
        .map((l) => (l.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    );
  }

  async selectOption(facetName: string, optionValue: string): Promise<void> {
    await this.expandFacet(facetName);
    const checkbox = this.optionCheckbox(facetName, optionValue);
    await expect(checkbox).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
    const state = await checkbox.getAttribute('aria-checked');
    if (state !== 'true') {
      await checkbox.click();
    }
    await expect(checkbox).toHaveAttribute('aria-checked', 'true', {
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
    await this.page
      .waitForURL((url) => url.searchParams.has('filters'), {
        timeout: FILTERS_PANEL.uiSettleTimeoutMs,
      })
      .catch(() => undefined);
    // Mobile drawer can obscure the Products tab / result grid.
    await this.closeMobileDrawerIfOpen();
  }

  async deselectOption(facetName: string, optionValue: string): Promise<void> {
    await this.expandFacet(facetName);
    const checkbox = this.optionCheckbox(facetName, optionValue);
    await expect(checkbox).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
    const state = await checkbox.getAttribute('aria-checked');
    if (state === 'true') {
      await checkbox.click();
    }
    await expect(checkbox).toHaveAttribute('aria-checked', 'false', {
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
    // Wait for URL to drop this value (or all filters) before closing drawer.
    await expect
      .poll(
        () => {
          try {
            const raw = new URL(this.page.url()).searchParams.get('filters');
            if (!raw) return true;
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const value = parsed[facetName];
            if (value === undefined) return true;
            if (Array.isArray(value)) return !value.includes(optionValue);
            return value !== optionValue;
          } catch {
            return false;
          }
        },
        { timeout: FILTERS_PANEL.uiSettleTimeoutMs },
      )
      .toBeTruthy();
    await this.closeMobileDrawerIfOpen();
  }

  async isOptionSelected(
    facetName: string,
    optionValue: string,
  ): Promise<boolean> {
    await this.expandFacet(facetName);
    const checkbox = this.optionCheckbox(facetName, optionValue);
    return (await checkbox.getAttribute('aria-checked')) === 'true';
  }

  async clearAll(): Promise<void> {
    await this.ensureVisible();
    const btn = this.clearAllButton();
    await expect(btn).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
    await btn.click();
    await this.page
      .waitForURL((url) => !url.searchParams.has('filters'), {
        timeout: FILTERS_PANEL.uiSettleTimeoutMs,
      })
      .catch(() => undefined);
    await this.closeMobileDrawerIfOpen();
  }
}
