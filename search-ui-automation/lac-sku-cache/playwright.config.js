const { defineConfig, devices } = require('@playwright/test');

/**
 * Single-session Würth LAC SKU cache run.
 * A normal Chrome user agent is required: the QA automation UA triggers
 * the Vercel checkpoint on this preview.
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 50 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [{ name: 'desktop-1440' }],
});
