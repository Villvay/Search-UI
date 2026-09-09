/**
 * Removes Playwright-generated artifacts only (not source/config/data).
 * Preserves:
 *   - versioned dashboards under reports/html/runs/
 *   - cycle-specific reports (search-ui-smoke-*, search-ui-regression-*)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
  'test-results',
  // Latest dashboard only — never wipe reports/html/runs/ or cycle dashboards
  'reports/html/index.html',
  'reports/html/data',
  'reports/html/trace',
  'reports/playwright-results.json',
  'reports/playwright-results.partial.json',
  'reports/search-ui-playwright-results.json',
  'reports/search-ui-summary.json',
  'reports/search-ui-summary.md',
  'reports/analytics-playwright-results.json',
  'reports/analytics-query-results.json',
  'reports/analytics-failures.md',
  'blob-report',
  'playwright-report',
];

function rm(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
  console.log(`cleaned: ${path.relative(root, targetPath)}`);
}

for (const rel of TARGETS) {
  rm(path.join(root, rel));
}

// Per-module parallel runner partials
const reportsDir = path.join(root, 'reports');
if (fs.existsSync(reportsDir)) {
  for (const name of fs.readdirSync(reportsDir)) {
    if (name.startsWith('playwright-results.partial.')) {
      rm(path.join(reportsDir, name));
    }
  }
}

// Per-module output dirs from parallel runner
const testResults = path.join(root, 'test-results');
if (fs.existsSync(testResults)) {
  for (const name of fs.readdirSync(testResults)) {
    if (name.startsWith('module-')) {
      rm(path.join(testResults, name));
    }
  }
}

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.mkdirSync(path.join(root, 'reports', 'html'), { recursive: true });
fs.mkdirSync(path.join(root, 'reports', 'html', 'runs'), { recursive: true });
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });

console.log(
  'Test artifacts cleaned (versioned + cycle dashboards/reports preserved).',
);
