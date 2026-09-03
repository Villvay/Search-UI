/**
 * Full Search UI functional suite with failure screenshots archived.
 *
 * Unlike run-search-ui.mjs (JSON-only, screenshots off), this keeps
 * screenshot: only-on-failure and copies failure PNGs to
 * reports/failure-screenshots/<module>/ between modules to save disk.
 *
 * Default projects: all 6 Chromium viewports (Safari still opt-in).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivedJson = path.join(root, 'reports', 'search-ui-playwright-results.json');
const latestJson = path.join(root, 'reports', 'playwright-results.json');
const tempJson = path.join(root, 'reports', 'playwright-results.partial.json');
const failureRoot = path.join(root, 'reports', 'failure-screenshots');
const manifestPath = path.join(failureRoot, 'manifest.json');

const SUITES = [
  { id: 'on-type', path: 'src/modules/on-type/tests/on-type.spec.ts' },
  { id: 'suggestions', path: 'src/modules/suggestions/tests/suggestions.spec.ts' },
  { id: 'on-enter', path: 'src/modules/on-enter/tests/on-enter.spec.ts' },
  { id: 'related-searches', path: 'src/modules/related-searches/tests' },
  { id: 'filters-facets', path: 'src/modules/filters-facets/tests' },
  { id: 'sorting', path: 'src/modules/sorting/tests' },
  { id: 'framework', path: 'tests/framework-validation.spec.ts' },
];

const PROJECTS = [
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

function cleanTestResultsOnly() {
  const dir = path.join(root, 'test-results');
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  fs.mkdirSync(dir, { recursive: true });
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function archiveFailureScreenshots(moduleId) {
  const destDir = path.join(failureRoot, moduleId);
  fs.mkdirSync(destDir, { recursive: true });
  const resultsDir = path.join(root, 'test-results');
  const pngs = walkFiles(resultsDir).filter((f) =>
    /test-failed.*\.png$/i.test(f) || /error-context\.md$/i.test(f),
  );
  const archived = [];
  for (const file of pngs) {
    const rel = path.relative(resultsDir, file);
    const safe = rel.replace(/[\\/]/g, '__');
    const dest = path.join(destDir, safe);
    fs.copyFileSync(file, dest);
    archived.push({
      module: moduleId,
      source: rel,
      archived: path.relative(root, dest),
      kind: file.endsWith('.png') ? 'screenshot' : 'error-context',
    });
  }
  return archived;
}

const clean = run('node', ['scripts/clean-test-artifacts.mjs']);
if (clean.status !== 0) {
  process.exit(clean.status ?? 1);
}

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.mkdirSync(path.join(root, 'reports', 'html'), { recursive: true });
fs.mkdirSync(failureRoot, { recursive: true });

const merged = {
  config: null,
  suites: [],
  errors: [],
  stats: null,
};

let worstStatus = 0;
const allFailures = [];
const startedAt = new Date().toISOString();
const projectArgs = PROJECTS.flatMap((p) => ['--project', p]);

for (const suite of SUITES) {
  cleanTestResultsOnly();
  if (fs.existsSync(tempJson)) fs.rmSync(tempJson, { force: true });

  const result = run(
    'npx',
    [
      'playwright',
      'test',
      suite.path,
      ...projectArgs,
      '--retries=1',
    ],
    {
      ...process.env,
      SEARCH_UI_JSON: 'reports/playwright-results.partial.json',
      FORCE_FAILURE_SCREENSHOTS: '1',
      PLAYWRIGHT_HTML_OPEN: 'never',
    },
  );

  if (typeof result.status === 'number' && result.status > worstStatus) {
    worstStatus = result.status;
  }

  const archived = archiveFailureScreenshots(suite.id);
  allFailures.push(...archived);
  console.log(
    `[${suite.id}] archived ${archived.filter((a) => a.kind === 'screenshot').length} failure screenshot(s)`,
  );

  if (!fs.existsSync(tempJson)) {
    console.error(`Missing partial JSON for ${suite.id}`);
    worstStatus = worstStatus || 1;
    continue;
  }

  const partial = JSON.parse(fs.readFileSync(tempJson, 'utf8'));
  if (!merged.config) merged.config = partial.config;
  if (Array.isArray(partial.suites)) merged.suites.push(...partial.suites);
  if (Array.isArray(partial.errors)) merged.errors.push(...partial.errors);
}

fs.writeFileSync(archivedJson, JSON.stringify(merged, null, 2));
fs.copyFileSync(archivedJson, latestJson);
if (fs.existsSync(tempJson)) fs.rmSync(tempJson, { force: true });

const manifest = {
  startedAt,
  finishedAt: new Date().toISOString(),
  projects: PROJECTS,
  suites: SUITES.map((s) => s.id),
  failures: allFailures,
  screenshotCount: allFailures.filter((f) => f.kind === 'screenshot').length,
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nFailure screenshot manifest: ${path.relative(root, manifestPath)}`);
console.log(`Archived full-suite JSON: ${path.relative(root, archivedJson)}`);

const summary = run('node', ['scripts/generate-search-ui-report.mjs']);
if (summary.status !== 0) process.exit(summary.status ?? 1);

const htmlBuild = run('node', ['scripts/generate-search-ui-html.mjs']);
if (htmlBuild.status !== 0) {
  console.warn('Consolidated HTML generation failed; Markdown/JSON summary remain available.');
}

process.exit(worstStatus || 0);
