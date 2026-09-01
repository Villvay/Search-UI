/**
 * Reusable viewport definitions for responsive Search UI testing.
 *
 * Playwright projects in playwright.config.ts map to these entries.
 * Desktop-1440 also expands across Chrome, Firefox, and Safari (WebKit).
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

/** Browsers used for the desktop-1440 multi-browser matrix. */
export const DESKTOP_1440_BROWSERS: readonly {
  id: BrowserId;
  projectName: string;
  deviceKey: 'Desktop Chrome' | 'Desktop Firefox' | 'Desktop Safari';
  browserName: 'chromium' | 'firefox' | 'webkit';
}[] = [
  {
    id: 'chrome',
    projectName: 'desktop-1440-chrome',
    deviceKey: 'Desktop Chrome',
    browserName: 'chromium',
  },
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
  },
] as const;

export const DESKTOP_1440_BROWSER_PROJECTS = DESKTOP_1440_BROWSERS.map(
  (b) => b.projectName,
);

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
