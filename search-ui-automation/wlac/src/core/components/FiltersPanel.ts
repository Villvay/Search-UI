import { type Locator, type Page, expect } from '@playwright/test';

/**
 * SERP Filters aside on Würth LAC.
 *
 * Inspected on https://wurthlac.com/search?q=hinge (2026-10-29):
 * - Desktop aside heading "Filters"
 * - Mobile (390/375): button "Filters & sort" opens a dialog titled "Filters"
 * - Facet groups are buttons named Brand, Category, Product Type, …
 * - Options are checkboxes named with the facet value (e.g. "Blum, Inc.")
 * - URL uses `filters` JSON, same shape as Baer: filters={"Brand":"Blum, Inc."}
 * - No data-testid="accordion-filter" on this storefront
 */
export const FILTERS_PANEL = {
  panelHeading: 'Filters',
  mobileTriggerName: /Filters\s*&\s*sort|^Filters$/i,
  clearAllName: /^Clear all$/i,
  uiSettleTimeoutMs: 30_000,
} as const;

export class FiltersPanel {
  constructor(readonly page: Page) {}

  root(): Locator {
    const heading = this.page.getByRole('heading', {
      name: FILTERS_PANEL.panelHeading,
      exact: true,
    });
    const aside = this.page.locator('aside').filter({ has: heading });
    const dialog = this.page.getByRole('dialog').filter({ has: heading });
    return aside.or(dialog).locator('visible=true').first();
  }

  panelHeading(): Locator {
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
    return this.page
      .getByRole('button', {
        name: FILTERS_PANEL.mobileTriggerName,
      })
      .locator('visible=true')
      .first();
  }

  mobileDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  facetTrigger(facetName: string): Locator {
    return this.root().getByRole('button', {
      name: new RegExp(`^${escapeRegExp(facetName)}$`, 'i'),
    });
  }

  optionCheckbox(optionValue: string): Locator {
    return this.root()
      .getByRole('checkbox', {
        name: optionValue,
        exact: true,
      })
      .locator('visible=true')
      .first();
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
    await expect(this.root()).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
  }

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
    await expect(trigger).toHaveAttribute('aria-expanded', 'true', {
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
  }

  async getFacetNames(): Promise<string[]> {
    await this.ensureVisible();
    const fromTriggers = await this.root()
      .locator('button[aria-expanded]')
      .evaluateAll((buttons) =>
        buttons
          .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean),
      );
    if (fromTriggers.length > 0) {
      return [...new Set(fromTriggers)];
    }
    return this.root().evaluate((root) =>
      [...root.querySelectorAll('h3, button')]
        .map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((name) => name && !/^clear all$/i.test(name)),
    );
  }

  async getVisibleOptionLabels(facetName: string): Promise<string[]> {
    await this.expandFacet(facetName);
    const boxes = this.root().getByRole('checkbox');
    await expect(boxes.first()).toBeVisible({
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
    const count = await boxes.count();
    const labels: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const box = boxes.nth(i);
      const aria = (await box.getAttribute('aria-label'))?.trim();
      const parentText = await box.evaluate((el) =>
        (el.parentElement?.textContent || '').replace(/\s+/g, ' ').trim(),
      );
      const name = aria || parentText;
      if (name && !labels.includes(name)) labels.push(name);
    }
    return labels;
  }

  async selectOption(facetName: string, optionValue: string): Promise<void> {
    await this.expandFacet(facetName);
    const checkbox = this.optionCheckbox(optionValue);
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
    await this.page.waitForURL((url) => url.searchParams.has('filters'), {
      timeout: FILTERS_PANEL.uiSettleTimeoutMs,
    });
    await this.closeMobileDrawerIfOpen();
  }

  async deselectOption(facetName: string, optionValue: string): Promise<void> {
    await this.expandFacet(facetName);
    const checkbox = this.optionCheckbox(optionValue);
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
    const checkbox = this.optionCheckbox(optionValue);
    await expect
      .poll(
        async () => {
          const aria = await checkbox.getAttribute('aria-checked');
          if (aria === 'true') return true;
          return checkbox.isChecked().catch(() => false);
        },
        { timeout: FILTERS_PANEL.uiSettleTimeoutMs },
      )
      .toBeTruthy();
    return true;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
