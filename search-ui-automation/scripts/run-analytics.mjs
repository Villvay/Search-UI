/**
 * Analytics suite runner: sequential modules, conservative disk use, merged JSON + reports.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivedJson = path.join(root, 'reports', 'analytics-playwright-results.json');
const tempJson = path.join(root, 'reports', 'playwright-results.partial.json');

const SUITES = [
  'src/modules/on-type/tests/on-type-analytics.spec.ts',
  'src/modules/suggestions/tests/suggestions-analytics.spec.ts',
  'src/modules/on-enter/tests/on-enter-analytics.spec.ts',
];

function run(command, args, env = process.env) {
  console.log(`\n> ${command} ${args.join(' ')}\n`);
  return spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });
}

function cleanTestResultsOnly() {
  const dir = path.join(root, 'test-results');
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  fs.mkdirSync(dir, { recursive: true });
}

const clean = run('node', ['scripts/clean-test-artifacts.mjs']);
if (clean.status !== 0) process.exit(clean.status ?? 1);

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });

const merged = { config: null, suites: [], errors: [], stats: null };
let worstStatus = 0;
const extraArgs = process.argv.slice(2);
const workers = process.env.ANALYTICS_WORKERS || '1';
const retries =
  process.env.ANALYTICS_RETRIES !== undefined
    ? ['--retries', process.env.ANALYTICS_RETRIES]
    : ['--retries', '0'];

for (const suite of SUITES) {
  cleanTestResultsOnly();
  if (fs.existsSync(tempJson)) fs.rmSync(tempJson, { force: true });

  const result = run(
    'npx',
    [
      'playwright',
      'test',
      suite,
      '--workers',
      workers,
      ...retries,
      ...extraArgs,
    ],
    {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH:
        process.env.PLAYWRIGHT_BROWSERS_PATH ||
        path.join(process.env.HOME || '', 'Library/Caches/ms-playwright'),
      SEARCH_UI_JSON: 'reports/playwright-results.partial.json',
      PLAYWRIGHT_HTML_OPEN: 'never',
    },
  );

  if (typeof result.status === 'number' && result.status > worstStatus) {
    worstStatus = result.status;
  }

  if (!fs.existsSync(tempJson)) {
    console.error(`Missing partial JSON for ${suite}`);
    worstStatus = worstStatus || 1;
    continue;
  }

  const partial = JSON.parse(fs.readFileSync(tempJson, 'utf8'));
  if (!merged.config) merged.config = partial.config;
  if (Array.isArray(partial.suites)) merged.suites.push(...partial.suites);
  if (Array.isArray(partial.errors)) merged.errors.push(...partial.errors);
}

fs.writeFileSync(archivedJson, JSON.stringify(merged, null, 2));
fs.copyFileSync(archivedJson, path.join(root, 'reports', 'playwright-results.json'));
if (fs.existsSync(tempJson)) fs.rmSync(tempJson, { force: true });
console.log(`\nArchived analytics JSON: ${path.relative(root, archivedJson)}`);

const analyticsReport = run('node', ['scripts/generate-analytics-report.mjs']);
if (analyticsReport.status !== 0) process.exit(analyticsReport.status ?? 1);

const summary = run('node', ['scripts/generate-search-ui-report.mjs']);
if (summary.status !== 0) {
  console.warn('Summary generation failed; analytics JSON/MD remain available.');
} else {
  const htmlBuild = run('node', ['scripts/generate-search-ui-html.mjs']);
  if (htmlBuild.status !== 0) {
    console.warn('HTML dashboard generation failed.');
  }
}

process.exit(worstStatus || 0);
