/**
 * Full Search UI suite:
 *   clean → run each module (all viewports) sequentially → merge JSON → summary
 *   + generate Playwright HTML via a final merge-friendly pass when possible
 *
 * Modules run one-at-a-time and test-results are cleared between modules to
 * reduce disk pressure (this environment has repeatedly hit ENOSPC).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivedJson = path.join(
  root,
  'reports',
  'search-ui-playwright-results.json',
);
const latestJson = path.join(root, 'reports', 'playwright-results.json');
const tempJson = path.join(root, 'reports', 'playwright-results.partial.json');

const SUITES = [
  'src/modules/on-type/tests',
  'src/modules/suggestions/tests',
  'src/modules/on-enter/tests',
  'src/modules/related-searches/tests',
  'src/modules/filters-facets/tests',
  'src/modules/sorting/tests',
  'tests/framework-validation.spec.ts',
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
if (clean.status !== 0) {
  process.exit(clean.status ?? 1);
}

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.mkdirSync(path.join(root, 'reports', 'html'), { recursive: true });

const merged = {
  config: null,
  suites: [],
  errors: [],
  stats: null,
};

let worstStatus = 0;
const extraArgs = process.argv.slice(2);

for (const suite of SUITES) {
  cleanTestResultsOnly();
  if (fs.existsSync(tempJson)) {
    fs.rmSync(tempJson, { force: true });
  }

  const result = run(
    'npx',
    ['playwright', 'test', suite, ...extraArgs],
    {
      ...process.env,
      // JSON-only path for suite shards; disables screenshots/traces in config.
      SEARCH_UI_JSON: 'reports/playwright-results.partial.json',
      // Skip HTML during shard runs (avoids overwrite + disk). Final HTML below.
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
  if (!merged.config) {
    merged.config = partial.config;
  }
  if (Array.isArray(partial.suites)) {
    merged.suites.push(...partial.suites);
  }
  if (Array.isArray(partial.errors)) {
    merged.errors.push(...partial.errors);
  }
}

fs.writeFileSync(archivedJson, JSON.stringify(merged, null, 2));
fs.copyFileSync(archivedJson, latestJson);
if (fs.existsSync(tempJson)) {
  fs.rmSync(tempJson, { force: true });
}
console.log(`\nArchived full-suite JSON: ${path.relative(root, archivedJson)}`);

const summary = run('node', ['scripts/generate-search-ui-report.mjs']);
if (summary.status !== 0) {
  process.exit(summary.status ?? 1);
}

// Build a lightweight HTML report from the consolidated summary (Playwright HTML
// cannot be merged across sequential module runs without blob artifacts, which
// exceed available disk on this machine).
const htmlBuild = run('node', ['scripts/generate-search-ui-html.mjs']);
if (htmlBuild.status !== 0) {
  console.warn('Consolidated HTML generation failed; Markdown/JSON summary remain available.');
}

process.exit(worstStatus || 0);
