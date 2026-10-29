import { expect } from '@playwright/test';
import { RECENT_SEARCHES_BEHAVIOR } from '../data/behavior';
import { type RecentSearchesPage } from '../pages/RecentSearchesPage';

export async function expectRecentSectionVisible(
  recent: RecentSearchesPage,
): Promise<void> {
  await expect(recent.section.heading().locator('visible=true').first()).toBeVisible({
    timeout: RECENT_SEARCHES_BEHAVIOR.uiSettleTimeoutMs,
  });
}

export async function expectRecentSectionAbsent(
  recent: RecentSearchesPage,
): Promise<void> {
  await expect(recent.section.heading()).toHaveCount(0);
}

export async function expectRecentContains(
  recent: RecentSearchesPage,
  queries: readonly string[],
): Promise<void> {
  const texts = (await recent.section.getQueryTexts()).map((t) => t.toLowerCase());
  for (const query of queries) {
    expect(texts.some((t) => t.includes(query.toLowerCase()))).toBeTruthy();
  }
}
