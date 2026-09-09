/**
 * Analytics suite runner: merged JSON + reports.
 *
 * Default: one Playwright invocation for all analytics modules (modules can
 * run in parallel up to ANALYTICS_WORKERS). Set ANALYTICS_SEQUENTIAL=1 to
 * run modules one-at-a-time and clear test-results between each (low disk).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivedJson = path.join(root, 'reports', 'analytics-playwright-results.json');
const tempJson = path.join(root, 'reports', 'playwright-results.partial.json');
const latestJson = path.join(root, 'reports', 'playwright-results.json');

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

function resolveWorkers() {
  const raw = (process.env.ANALYTICS_WORKERS || '1').trim();
  const n = Number.parseInt(raw, 10);
  if (![1, 2, 3, 4].includes(n)) {
    throw new Error(
      `Invalid ANALYTICS_WORKERS="${raw}". Allowed: 1, 2, 3, 4 (default 1).`,
    );
  }
  return String(n);
}

const clean = run('node', ['scripts/clean-test-artifacts.mjs']);
if (clean.status !== 0) process.exit(clean.status ?? 1);

const rawArgs = process.argv.slice(2);
const smokeRequested = rawArgs.includes('--smoke');
const extraArgs = rawArgs.filter((a) => a !== '--smoke');

if (smokeRequested) {
  process.env.ANALYTICS_PROFILE = process.env.ANALYTICS_PROFILE || 'smoke';
  if (!process.env.ANALYTICS_WORKERS) {
    process.env.ANALYTICS_WORKERS = '3';
  }
}

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });

const workers = resolveWorkers();
const retries =
  process.env.ANALYTICS_RETRIES !== undefined
    ? ['--retries', process.env.ANALYTICS_RETRIES]
    : ['--retries', '0'];
const sequential =
  (process.env.ANALYTICS_SEQUENTIAL || '').trim() === '1' ||
  (process.env.ANALYTICS_SEQUENTIAL || '').trim().toLowerCase() === 'true';

if (smokeRequested) {
  console.log(
    `Analytics smoke profile: ${loadSmokeCountHint()} queries × 3 modules (ANALYTICS_WORKERS=${workers})`,
  );
}

function loadSmokeCountHint() {
  try {
    const ids = JSON.parse(
      fs.readFileSync(
        path.join(root, 'src/test-data/analytics/smoke-query-ids.json'),
        'utf8',
      ),
    ).ids;
    return Array.isArray(ids) ? ids.length : '?';
  } catch {
    return '?';
  }
}

const playwrightEnv = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH:
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(process.env.HOME || '', 'Library/Caches/ms-playwright'),
  SEARCH_UI_JSON: 'reports/playwright-results.partial.json',
  PLAYWRIGHT_HTML_OPEN: 'never',
};

let worstStatus = 0;
const merged = { config: null, suites: [], errors: [], stats: null };

function ingestPartial() {
  if (!fs.existsSync(tempJson)) {
    console.error('Missing partial Playwright JSON for analytics run');
    worstStatus = worstStatus || 1;
    return;
  }
  const partial = JSON.parse(fs.readFileSync(tempJson, 'utf8'));
  if (!merged.config) merged.config = partial.config;
  if (Array.isArray(partial.suites)) merged.suites.push(...partial.suites);
  if (Array.isArray(partial.errors)) merged.errors.push(...partial.errors);
}

if (sequential) {
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
      playwrightEnv,
    );

    if (typeof result.status === 'number' && result.status > worstStatus) {
      worstStatus = result.status;
    }
    ingestPartial();
  }
} else {
  cleanTestResultsOnly();
  if (fs.existsSync(tempJson)) fs.rmSync(tempJson, { force: true });

  const result = run(
    'npx',
    [
      'playwright',
      'test',
      ...SUITES,
      '--workers',
      workers,
      ...retries,
      ...extraArgs,
    ],
    playwrightEnv,
  );

  if (typeof result.status === 'number' && result.status > worstStatus) {
    worstStatus = result.status;
  }
  ingestPartial();
}

fs.writeFileSync(archivedJson, JSON.stringify(merged, null, 2));
fs.copyFileSync(archivedJson, latestJson);
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
