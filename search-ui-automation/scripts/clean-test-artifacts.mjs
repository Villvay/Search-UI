/**
 * Removes Playwright-generated artifacts only (not source/config/data).
 * Preserves versioned dashboards under reports/html/runs/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
  'test-results',
  // Latest dashboard only — never wipe reports/html/runs/
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

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.mkdirSync(path.join(root, 'reports', 'html'), { recursive: true });
fs.mkdirSync(path.join(root, 'reports', 'html', 'runs'), { recursive: true });
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });

console.log('Test artifacts cleaned (versioned dashboards preserved).');
