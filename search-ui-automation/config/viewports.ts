/**
 * Reusable viewport definitions for responsive Search UI testing.
 *
 * Playwright projects in playwright.config.ts map to these entries.
 * Desktop-1440 expands across Chromium (canonical), Firefox, and opt-in Safari.
 */

export type ViewportCategory = 'desktop' | 'tablet' | 'mobile';

export type BrowserId = 'chrome' | 'firefox' | 'safari';

export type ViewportDefinition = {
  id: string;
  category: ViewportCategory;
  width: number;
  height: number;
};

export const VIEWPORTS: readonly ViewportDefinition[] = [
  { id: 'desktop-1440', category: 'desktop', width: 1440, height: 900 },
  { id: 'desktop-1280', category: 'desktop', width: 1280, height: 800 },
  { id: 'tablet-1024', category: 'tablet', width: 1024, height: 768 },
  { id: 'tablet-768', category: 'tablet', width: 768, height: 1024 },
  { id: 'mobile-390', category: 'mobile', width: 390, height: 844 },
  { id: 'mobile-375', category: 'mobile', width: 375, height: 812 },
] as const;

/**
 * Extra desktop-1440 browser projects (Firefox always; Safari when INCLUDE_SAFARI=1).
 * Canonical Chromium @ 1440×900 is project `desktop-1440` (not duplicated here).
 */
export const DESKTOP_1440_EXTRA_BROWSERS: readonly {
  id: BrowserId;
  projectName: string;
  deviceKey: 'Desktop Firefox' | 'Desktop Safari';
  browserName: 'firefox' | 'webkit';
  /** When true, project is only registered if INCLUDE_SAFARI=1. */
  requiresIncludeSafari?: boolean;
}[] = [
  {
    id: 'firefox',
    projectName: 'desktop-1440-firefox',
    deviceKey: 'Desktop Firefox',
    browserName: 'firefox',
  },
  {
    id: 'safari',
    projectName: 'desktop-1440-safari',
    deviceKey: 'Desktop Safari',
    browserName: 'webkit',
    requiresIncludeSafari: true,
  },
] as const;

/** @deprecated Use DESKTOP_1440_EXTRA_BROWSERS — chrome is no longer duplicated. */
export const DESKTOP_1440_BROWSERS = DESKTOP_1440_EXTRA_BROWSERS;

export const DESKTOP_1440_BROWSER_PROJECTS = DESKTOP_1440_EXTRA_BROWSERS.map(
  (b) => b.projectName,
);

export function isSafariIncluded(): boolean {
  const raw = (process.env.INCLUDE_SAFARI || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function getViewportsByCategory(
  category: ViewportCategory,
): ViewportDefinition[] {
  return VIEWPORTS.filter((viewport) => viewport.category === category);
}

export function getViewportById(id: string): ViewportDefinition {
  const match = VIEWPORTS.find((viewport) => viewport.id === id);
  if (!match) {
    throw new Error(`Unknown viewport id: ${id}`);
  }
  return match;
}
