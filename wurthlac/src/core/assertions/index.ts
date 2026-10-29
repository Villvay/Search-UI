import { type Locator, expect } from '@playwright/test';

export async function expectLocatorVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
}

export async function expectInputValue(
  locator: Locator,
  value: string,
): Promise<void> {
  await expect(locator).toHaveValue(value);
}
