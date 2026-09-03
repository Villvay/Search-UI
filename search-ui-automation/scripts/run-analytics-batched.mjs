/**
 * Viewport-batched analytics runner.
 *
 * Execution model:
 *   for each Playwright project (browser+viewport):
 *     1 page → all queries × ON-TYPE → SUGGESTIONS → ON-ENTER
 *   Workers shard by viewport/project (not by query).
 *
 * Default dataset: ANALYTICS_DATASET=top50-sku-nonsku (new PDF file).
 * Existing per-query analytics (`npm run test:analytics`) is unchanged.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const batchDir = path.join(root, 'reports', 'analytics-batch');
const mergedJson = path.join(root, 'reports', 'analytics-batch-results.json');
const spec =
  'src/modules/analytics-batch/tests/analytics-batched.spec.ts';

const DEFAULT_PROJECTS = [
  'desktop-1440',
  'desktop-1280',
  'tablet-1024',
  'tablet-768',
  'mobile-390',
  'mobile-375',
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

function parseProjects(argv) {
  const projects = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project' && argv[i + 1]) {
      projects.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--project=')) {
      const value = arg.slice('--project='.length).trim();
      if (value) projects.push(value);
    }
  }
  return projects;
}

function stripProjectArgs(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') {
      i += 1; // skip value
      continue;
    }
    if (arg.startsWith('--project=')) continue;
    out.push(arg);
  }
  return out;
}

const rawArgs = process.argv.slice(2);
const smokeRequested = rawArgs.includes('--smoke');
const extraArgs = rawArgs.filter((a) => a !== '--smoke');
const cliProjects = parseProjects(extraArgs);
const projectArgs =
  cliProjects.length > 0
    ? cliProjects.flatMap((p) => ['--project', p])
    : DEFAULT_PROJECTS.flatMap((p) => ['--project', p]);
const passthroughArgs = stripProjectArgs(extraArgs);

if (!process.env.ANALYTICS_DATASET) {
  process.env.ANALYTICS_DATASET = 'top50-sku-nonsku';
}
if (smokeRequested && !process.env.ANALYTICS_PROFILE) {
  process.env.ANALYTICS_PROFILE = 'smoke';
}

const workers = resolveWorkers();
const retries =
  process.env.ANALYTICS_RETRIES !== undefined
    ? ['--retries', process.env.ANALYTICS_RETRIES]
    : ['--retries', '0'];

console.log('Analytics BATCHED execution');
console.log(`  ANALYTICS_DATASET=${process.env.ANALYTICS_DATASET}`);
console.log(`  ANALYTICS_PROFILE=${process.env.ANALYTICS_PROFILE || 'full'}`);
console.log(`  ANALYTICS_LIMIT=${process.env.ANALYTICS_LIMIT || '(all)'}`);
console.log(
  `  ANALYTICS_MODULES=${process.env.ANALYTICS_MODULES || 'on-type,suggestions,on-enter'}`,
);
console.log(`  ANALYTICS_WORKERS=${workers}`);
console.log(
  `  Projects: ${cliProjects.length ? cliProjects.join(', ') : DEFAULT_PROJECTS.join(', ')}`,
);
console.log(
  '  Model: Browser/Viewport → unique queries (deduped) × modules → next viewport',
);

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.rmSync(batchDir, { recursive: true, force: true });
fs.mkdirSync(batchDir, { recursive: true });

const clean = run('node', ['scripts/clean-test-artifacts.mjs']);
if (clean.status !== 0) process.exit(clean.status ?? 1);
fs.mkdirSync(batchDir, { recursive: true });

const wallStart = Date.now();
const result = run(
  'npx',
  [
    'playwright',
    'test',
    spec,
    '--workers',
    workers,
    ...retries,
    ...projectArgs,
    ...passthroughArgs,
  ],
  {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH:
      process.env.PLAYWRIGHT_BROWSERS_PATH ||
      path.join(process.env.HOME || '', 'Library/Caches/ms-playwright'),
    SEARCH_UI_JSON: 'reports/playwright-results.partial.json',
    FORCE_FAILURE_SCREENSHOTS: process.env.FORCE_FAILURE_SCREENSHOTS || '',
    PLAYWRIGHT_HTML_OPEN: 'never',
  },
);

const wallMs = Date.now() - wallStart;

// Merge per-viewport batch JSON files
const reports = fs
  .readdirSync(batchDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(batchDir, f), 'utf8')));

const merged = {
  mode: 'batched',
  dataset: process.env.ANALYTICS_DATASET,
  datasetLimit: process.env.ANALYTICS_LIMIT || null,
  modules: process.env.ANALYTICS_MODULES || 'on-type,suggestions,on-enter',
  generatedAt: new Date().toISOString(),
  wallClockMs: wallMs,
  workers: Number(workers),
  viewports: reports,
  totals: {
    queriesPerViewport: reports[0]?.queryCount ?? 0,
    uniqueNormalizedQueries:
      reports[0]?.lifecycle?.uniqueNormalizedQueries ?? 0,
    duplicateRows: reports[0]?.lifecycle?.duplicateRows ?? 0,
    actualExecutions: reports.reduce(
      (n, r) => n + (r.lifecycle?.actualExecutions || 0),
      0,
    ),
    deduplicatedExecutions: reports.reduce(
      (n, r) => n + (r.lifecycle?.deduplicatedExecutions || 0),
      0,
    ),
    resultRows: reports.reduce((n, r) => n + (r.results?.length || 0), 0),
    passed: reports.reduce(
      (n, r) => n + r.results.filter((x) => x.status === 'passed').length,
      0,
    ),
    failed: reports.reduce(
      (n, r) => n + r.results.filter((x) => x.status === 'failed').length,
      0,
    ),
    skipped: reports.reduce(
      (n, r) => n + r.results.filter((x) => x.status === 'skipped').length,
      0,
    ),
    browserLaunches: reports.reduce(
      (n, r) => n + (r.lifecycle?.browserLaunches || 0),
      0,
    ),
    contextLaunches: reports.reduce(
      (n, r) => n + (r.lifecycle?.contextLaunches || 0),
      0,
    ),
    pageLaunches: reports.reduce(
      (n, r) => n + (r.lifecycle?.pageLaunches || 0),
      0,
    ),
    pageRecovers: reports.reduce(
      (n, r) =>
        n +
        (r.lifecycle?.pageRecoveries || r.lifecycle?.pageRecovers || 0),
      0,
    ),
    pageRecoveries: reports.reduce(
      (n, r) =>
        n +
        (r.lifecycle?.pageRecoveries || r.lifecycle?.pageRecovers || 0),
      0,
    ),
    softFailures: reports.reduce(
      (n, r) => n + (r.lifecycle?.softFailures || 0),
      0,
    ),
    hardFailures: reports.reduce(
      (n, r) => n + (r.lifecycle?.hardFailures || 0),
      0,
    ),
    homeNavigations: reports.reduce(
      (n, r) => n + (r.lifecycle?.homeNavigations || 0),
      0,
    ),
    reloadRecoveries: reports.reduce(
      (n, r) => n + (r.lifecycle?.reloadRecoveries || 0),
      0,
    ),
  },
};

fs.writeFileSync(mergedJson, JSON.stringify(merged, null, 2));
console.log(`\nWrote ${path.relative(root, mergedJson)}`);
console.log(
  `Totals: passed=${merged.totals.passed} failed=${merged.totals.failed} skipped=${merged.totals.skipped} actualExecutions=${merged.totals.actualExecutions} pageRecoveries=${merged.totals.pageRecoveries} wallMs=${wallMs}`,
);

const summary = run('node', ['scripts/generate-analytics-batch-report.mjs']);
if (summary.status !== 0) {
  console.warn('Batch report generation failed');
}
const opt = run('node', ['scripts/generate-analytics-optimization-report.mjs']);
if (opt.status !== 0) {
  console.warn('Optimization report generation failed');
}

process.exit(result.status ?? 0);
