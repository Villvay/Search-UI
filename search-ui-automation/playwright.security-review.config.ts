import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import {
  getEnvironmentConfig,
  resolveHeadlessPreference,
} from './config/environments';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const environment = getEnvironmentConfig();
const headless = resolveHeadlessPreference();

export default defineConfig({
  testDir: '.',
  testMatch: ['src/modules/security-review/tests/**/*.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 0,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html-security-review', open: 'never' }],
    ['json', { outputFile: 'reports/playwright-results.security-review.json' }],
  ],
  outputDir: 'test-results/security-review',
  use: {
    baseURL: environment.baseURL,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    headless,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        ...(process.env.PW_CHANNEL
          ? { channel: process.env.PW_CHANNEL as 'chrome' | 'msedge' | 'chromium' }
          : {}),
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
