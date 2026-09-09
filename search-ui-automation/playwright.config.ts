import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import {
  getEnvironmentConfig,
  getVercelBypassHeaders,
} from './config/environments';
import {
  DESKTOP_1440_EXTRA_BROWSERS,
  VIEWPORTS,
  getViewportById,
  isSafariIncluded,
} from './config/viewports';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const environment = getEnvironmentConfig();
const bypassHeaders = getVercelBypassHeaders();
const desktop1440 = getViewportById('desktop-1440');
const includeSafari = isSafariIncluded();

/** Other viewports stay Chromium-only (original project names preserved). */
const otherViewportProjects = VIEWPORTS.filter((v) => v.id !== 'desktop-1440').map(
  (viewport) => ({
    name: viewport.id,
    use: {
      ...devices['Desktop Chrome'],
      browserName: 'chromium' as const,
      viewport: { width: viewport.width, height: viewport.height },
    },
  }),
);

/**
 * Canonical desktop 1440 Chromium project.
 * (Previously duplicated as desktop-1440-chrome — removed.)
 */
const desktop1440Chromium = {
  name: 'desktop-1440',
  use: {
    ...devices['Desktop Chrome'],
    browserName: 'chromium' as const,
    viewport: { width: desktop1440.width, height: desktop1440.height },
  },
};

/** desktop-1440 × Firefox (+ Safari when INCLUDE_SAFARI=1). */
const desktop1440ExtraBrowserProjects = DESKTOP_1440_EXTRA_BROWSERS.filter(
  (browser) => !browser.requiresIncludeSafari || includeSafari,
).map((browser) => ({
  name: browser.projectName,
  use: {
    ...devices[browser.deviceKey],
    browserName: browser.browserName,
    viewport: { width: desktop1440.width, height: desktop1440.height },
  },
}));

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/**/*.spec.ts', 'src/modules/**/tests/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.SEARCH_UI_JSON
    ? [
        ['list'],
        [
          'json',
          {
            outputFile: process.env.SEARCH_UI_JSON,
          },
        ],
      ]
    : [
        ['list'],
        [
          'html',
          {
            outputFolder: 'reports/html',
            open: 'never',
          },
        ],
        [
          'json',
          {
            outputFile: 'reports/playwright-results.json',
          },
        ],
      ],
  outputDir: 'test-results',
  use: {
    baseURL: environment.baseURL,
    // Full-suite / analytics JSON runs keep screenshots/traces off to save disk.
    // FORCE_FAILURE_SCREENSHOTS=1 keeps only-on-failure PNGs during JSON shard runs.
    trace: process.env.SEARCH_UI_JSON ? 'off' : 'on-first-retry',
    screenshot:
      process.env.SEARCH_UI_JSON && !process.env.FORCE_FAILURE_SCREENSHOTS
        ? 'off'
        : 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    extraHTTPHeaders: bypassHeaders,
  },
  projects: [
    desktop1440Chromium,
    ...desktop1440ExtraBrowserProjects,
    ...otherViewportProjects,
  ],
});
