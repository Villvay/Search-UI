/**
 * Search UI test-cycle orchestrator (smoke / regression).
 *
 * - Selects existing modules/tests from config/search-ui-cycles.mjs
 * - Runs modules with isolation (failure in one does not stop others)
 * - Reuses Playwright JSON → generate-search-ui-report / HTML
 * - Classifies known defects (e.g. CACHE-005) without weakening assertions
 * - Writes cycle-specific artifacts and console summaries
 *
 * Usage:
 *   node scripts/run-search-ui-cycle.mjs --cycle=smoke
 *   node scripts/run-search-ui-cycle.mjs --cycle=smoke --responsive
 *   node scripts/run-search-ui-cycle.mjs --cycle=regression
 *   node scripts/run-search-ui-cycle.mjs --cycle=regression --responsive
 */
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CYCLE_BROWSER,
  CYCLE_EXCLUSIONS,
  KNOWN_DEFECTS,
  RELIABILITY_NOTES,
  isKnownDefectTestId,
  resolveCycle,
  resolveCycleModules,
} from '../config/search-ui-cycles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = {
    cycle: 'smoke',
    responsive: false,
    extra: [],
  };
  for (const arg of argv) {
    if (arg.startsWith('--cycle=')) out.cycle = arg.slice('--cycle='.length);
    else if (arg === '--responsive') out.responsive = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else out.extra.push(arg);
  }
  if (process.env.SMOKE_RESPONSIVE === '1' && out.cycle === 'smoke') {
    out.responsive = true;
  }
  return out;
}

function resolveModuleWorkers(cycle) {
  const raw = (process.env.UI_MODULE_WORKERS || String(cycle.defaultModuleWorkers)).trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    throw new Error(`Invalid UI_MODULE_WORKERS="${raw}". Allowed: 1–5.`);
  }
  return n;
}

function resolvePlaywrightWorkers(cycle) {
  const raw = (
    process.env.UI_PLAYWRIGHT_WORKERS || String(cycle.defaultPlaywrightWorkers)
  ).trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 4) {
    throw new Error(`Invalid UI_PLAYWRIGHT_WORKERS="${raw}". Allowed: 1–4.`);
  }
  return n;
}

function runSync(command, args, env = process.env) {
  console.log(`\n> ${command} ${args.join(' ')}\n`);
  return spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });
}

function fmtMs(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function pad(label, width) {
  return String(label).padEnd(width);
}

function runModule(module, playwrightArgs, playwrightWorkers) {
  const partialJson = path.join(
    root,
    'reports',
    `playwright-results.partial.${module.id}.json`,
  );
  const outputDir = path.join(root, 'test-results', `module-${module.id}`);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  if (fs.existsSync(partialJson)) fs.rmSync(partialJson, { force: true });

  const args = [
    'playwright',
    'test',
    module.path,
    '--workers',
    String(playwrightWorkers),
    '--output',
    outputDir,
    ...playwrightArgs,
  ];

  const started = Date.now();
  console.log(
    `\n[module-start] ${module.label} (${module.id}) workers=${playwrightWorkers}`,
  );

  return new Promise((resolve) => {
    const child = spawn('npx', args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        SEARCH_UI_JSON: path.relative(root, partialJson),
        PLAYWRIGHT_HTML_OPEN: 'never',
      },
    });

    child.on('error', (err) => {
      console.error(`[module-error] ${module.label}:`, err.message);
      resolve({
        module,
        status: 1,
        durationMs: Date.now() - started,
        partialJson,
        error: err.message,
      });
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - started;
      console.log(
        `[module-done] ${module.label} exit=${code ?? 1} durationMs=${durationMs}`,
      );
      resolve({
        module,
        status: typeof code === 'number' ? code : 1,
        durationMs,
        partialJson,
      });
    });
  });
}

async function runPool(modules, concurrency, playwrightArgs, playwrightWorkers) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < modules.length) {
      const current = modules[index];
      index += 1;
      // eslint-disable-next-line no-await-in-loop
      const result = await runModule(current, playwrightArgs, playwrightWorkers);
      results.push(result);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, modules.length) }, () => worker()),
  );

  results.sort(
    (a, b) =>
      modules.findIndex((m) => m.id === a.module.id) -
      modules.findIndex((m) => m.id === b.module.id),
  );
  return results;
}

function classifyCycleStatus(testCase) {
  if (testCase.status === 'skipped') return 'SKIPPED';
  if (testCase.status === 'passed' || testCase.status === 'recovered') return 'PASS';
  if (testCase.status === 'failed') {
    const known = isKnownDefectTestId(testCase.testId);
    if (known) return 'KNOWN DEFECT';
    return 'FAIL';
  }
  return String(testCase.status || 'UNKNOWN').toUpperCase();
}

function annotateSummaryForCycle(summary, cycle, meta) {
  const tests = (summary.tests || []).map((t) => {
    const cycleStatus = classifyCycleStatus(t);
    const known = isKnownDefectTestId(t.testId);
    return {
      ...t,
      cycleStatus,
      knownDefect: cycleStatus === 'KNOWN DEFECT',
      knownDefectReason: known?.reason || '',
      scenario: t.scenario || t.title || '',
    };
  });

  // Detect accidental duplicate execution (same testId + viewport + module).
  const seenKeys = new Map();
  const duplicates = [];
  for (const t of tests) {
    const key = `${t.testId || t.title}|${t.viewport}|${t.module}`;
    if (seenKeys.has(key)) duplicates.push(key);
    else seenKeys.set(key, true);
  }

  let knownDefects = 0;
  let unexpectedFailed = 0;
  let passed = 0;
  let skipped = 0;
  let recovered = 0;

  for (const t of tests) {
    if (t.cycleStatus === 'KNOWN DEFECT') knownDefects += 1;
    else if (t.status === 'failed') unexpectedFailed += 1;
    else if (t.status === 'skipped') skipped += 1;
    else if (t.status === 'recovered') {
      recovered += 1;
      passed += 1;
    } else if (t.status === 'passed') passed += 1;
  }

  const byModuleCycle = {};
  for (const t of tests) {
    const mod = t.module || 'OTHER';
    if (!byModuleCycle[mod]) {
      byModuleCycle[mod] = {
        passed: 0,
        failed: 0,
        skipped: 0,
        knownDefects: 0,
        total: 0,
        cycleResult: 'PASS',
      };
    }
    const b = byModuleCycle[mod];
    b.total += 1;
    if (t.cycleStatus === 'KNOWN DEFECT') b.knownDefects += 1;
    else if (t.status === 'failed') b.failed += 1;
    else if (t.status === 'skipped') b.skipped += 1;
    else b.passed += 1;
  }

  for (const b of Object.values(byModuleCycle)) {
    if (b.failed > 0) b.cycleResult = 'FAIL';
    else if (b.knownDefects > 0) b.cycleResult = 'KNOWN DEFECT';
    else if (b.passed === 0 && b.skipped > 0) b.cycleResult = 'SKIPPED';
    else b.cycleResult = 'PASS';
  }

  const cycleResult =
    unexpectedFailed > 0 || duplicates.length > 0
      ? 'FAILED'
      : knownDefects > 0
        ? 'PASS (KNOWN DEFECTS)'
        : 'PASS';

  return {
    ...summary,
    cycle: {
      id: cycle.id,
      displayName: cycle.displayName,
      title: cycle.title,
      purpose: cycle.purpose,
      responsive: meta.responsive,
      environment: meta.environment,
      browser: meta.browser || cycle.browser || CYCLE_BROWSER,
      projects: meta.projects,
      grep: meta.grep,
      moduleIds: meta.moduleIds,
      exclusions: CYCLE_EXCLUSIONS,
      knownDefectsCatalog: KNOWN_DEFECTS,
      reliabilityNotes: RELIABILITY_NOTES,
      startedAt: meta.startedAt,
      finishedAt: meta.finishedAt,
      wallClockMs: meta.wallClockMs,
      moduleWorkers: meta.moduleWorkers,
      playwrightWorkers: meta.playwrightWorkers,
      retries: meta.retries,
      moduleResults: meta.moduleResults,
      duplicateExecutions: duplicates,
      counts: {
        passed,
        failed: unexpectedFailed,
        skipped,
        knownDefects,
        recovered,
        total: tests.length,
        unexpectedFailures: unexpectedFailed,
      },
      result: cycleResult,
      exitCode: unexpectedFailed > 0 || duplicates.length > 0 ? 1 : 0,
    },
    byModuleCycle,
    tests,
  };
}

function buildConsoleSummary(annotated) {
  const c = annotated.cycle;
  const width = 24;
  const lines = [];
  lines.push('========================================');
  lines.push('SEARCH UI TEST CYCLE');
  lines.push('========================================');
  lines.push('');
  lines.push(`Cycle: ${String(c.id || '').toUpperCase()}`);
  lines.push(`Environment: ${c.environment}`);
  lines.push(`Browser: ${c.browser || CYCLE_BROWSER}`);
  lines.push(
    c.responsive
      ? `Viewports: ${c.projects.join(', ')}`
      : `Viewports: ${c.projects.join(', ')}`,
  );
  lines.push(`Start time: ${c.startedAt || '—'}`);
  if (c.grep) lines.push(`Selection: ${c.grep}`);
  lines.push(
    `Workers: modules=${c.moduleWorkers} playwright=${c.playwrightWorkers} retries=${c.retries}`,
  );
  lines.push('');

  if (c.id === 'smoke') {
    for (const modId of c.moduleIds) {
      const catalog = resolveCycleModules({ moduleIds: [modId] })[0];
      const bucket = annotated.byModuleCycle[catalog.reportModule];
      const status = bucket?.cycleResult || '—';
      lines.push(`${pad(catalog.shortLabel, width)}${status}`);
    }
  } else {
    lines.push('Modules:');
    for (const modId of c.moduleIds) {
      const catalog = resolveCycleModules({ moduleIds: [modId] })[0];
      const bucket = annotated.byModuleCycle[catalog.reportModule];
      const status = bucket?.cycleResult || '—';
      lines.push(`  ${pad(catalog.label, width)}${status}`);
    }
  }

  const failures = (annotated.tests || []).filter(
    (t) => t.cycleStatus === 'FAIL',
  );
  if (failures.length) {
    lines.push('');
    lines.push('Unexpected failures:');
    for (const f of failures) {
      lines.push(
        `  - ${f.testId || f.title} [${f.viewport}] ${f.module}: ${(f.error || '').slice(0, 160)}`,
      );
    }
  }

  const known = (annotated.tests || []).filter(
    (t) => t.cycleStatus === 'KNOWN DEFECT',
  );
  if (known.length) {
    lines.push('');
    lines.push('Known defects:');
    for (const k of known) {
      lines.push(
        `  - ${k.testId} [${k.viewport}]: ${k.knownDefectReason || 'documented defect'}`,
      );
    }
  }

  if (c.duplicateExecutions?.length) {
    lines.push('');
    lines.push('Duplicate executions detected:');
    for (const d of c.duplicateExecutions) {
      lines.push(`  - ${d}`);
    }
  }

  lines.push('');
  lines.push('----------------------------------------');
  lines.push('Tests');
  lines.push('----------------------------------------');
  lines.push(`Total:               ${c.counts.total}`);
  lines.push(`Passed:              ${c.counts.passed}`);
  lines.push(`Failed:              ${c.counts.failed}`);
  lines.push(`Skipped:             ${c.counts.skipped}`);
  lines.push(`Known Defects:       ${c.counts.knownDefects}`);
  lines.push(`Unexpected failures: ${c.counts.unexpectedFailures}`);
  lines.push('');
  lines.push(`Duration: ${fmtMs(c.wallClockMs)}`);
  lines.push('');
  lines.push(`Final result: ${c.result === 'FAILED' ? 'FAIL' : 'PASS'}`);
  if (c.result === 'PASS (KNOWN DEFECTS)') {
    lines.push('(Known defects present; cycle exit remains 0)');
  }
  lines.push('========================================');
  return lines.join('\n');
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// --- main ---
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Usage: node scripts/run-search-ui-cycle.mjs --cycle=smoke|regression [--responsive]

Env:
  ENV / BASE_URL / VERCEL_AUTOMATION_BYPASS_SECRET
  UI_MODULE_WORKERS (default from cycle config)
  UI_PLAYWRIGHT_WORKERS (default from cycle config)
  SMOKE_RESPONSIVE=1  (forces smoke responsive)
`);
  process.exit(0);
}

const cycle = resolveCycle(args.cycle);
const modules = resolveCycleModules(cycle);
const moduleWorkers = resolveModuleWorkers(cycle);
const playwrightWorkers = resolvePlaywrightWorkers(cycle);
const projects = args.responsive
  ? [...cycle.responsiveProjects]
  : [...cycle.defaultProjects];
if (!projects.length) {
  throw new Error('Cycle projects list is empty — refusing to run all Playwright projects');
}
// Dedupe projects while preserving order
const projectSeen = new Set();
const uniqueProjects = projects.filter((p) => {
  if (projectSeen.has(p)) return false;
  projectSeen.add(p);
  return true;
});
const grep = args.responsive ? cycle.responsiveGrep : cycle.grep;
const retries = Number.parseInt(
  process.env.PLAYWRIGHT_RETRIES ?? String(cycle.defaultRetries ?? 0),
  10,
);

const environment =
  process.env.ENV ||
  (process.env.BASE_URL ? 'custom' : 'qa');

console.log(cycle.title);
console.log(`  Cycle: ${cycle.displayName}`);
console.log(`  Environment: ${environment}`);
console.log(`  Browser: ${cycle.browser || CYCLE_BROWSER}`);
console.log(`  Projects: ${uniqueProjects.join(', ')}`);
console.log(`  Grep: ${grep || '(all tests in modules)'}`);
console.log(`  Modules: ${modules.map((m) => m.id).join(', ')}`);
console.log(`  UI_MODULE_WORKERS=${moduleWorkers}`);
console.log(`  UI_PLAYWRIGHT_WORKERS=${playwrightWorkers}`);
console.log(`  Retries=${retries}`);
console.log(
  `  Exclusions: ${Object.keys(CYCLE_EXCLUSIONS).join(', ')} (${Object.values(CYCLE_EXCLUSIONS)
    .map((e) => e.reason)
    .join('; ')})`,
);

const clean = runSync('node', ['scripts/clean-test-artifacts.mjs']);
if (clean.status !== 0) process.exit(clean.status ?? 1);

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.mkdirSync(path.join(root, 'reports', 'html'), { recursive: true });
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });

for (const file of fs.readdirSync(path.join(root, 'reports'))) {
  if (file.startsWith('playwright-results.partial.')) {
    fs.rmSync(path.join(root, 'reports', file), { force: true });
  }
}

const playwrightArgs = [];
for (const project of uniqueProjects) {
  playwrightArgs.push('--project', project);
}
if (grep) {
  playwrightArgs.push('--grep', grep);
}
playwrightArgs.push('--retries', String(Number.isFinite(retries) ? retries : 0));
playwrightArgs.push(...args.extra);

const startedAt = new Date().toISOString();
const wallStart = Date.now();
const moduleResults = await runPool(
  modules,
  moduleWorkers,
  playwrightArgs,
  playwrightWorkers,
);
const wallClockMs = Date.now() - wallStart;
const finishedAt = new Date().toISOString();

const archivedJson = path.join(root, 'reports', 'search-ui-playwright-results.json');
const latestJson = path.join(root, 'reports', 'playwright-results.json');

const merged = {
  config: null,
  suites: [],
  errors: [],
  stats: null,
};

let playwrightWorst = 0;
for (const result of moduleResults) {
  if (result.status > playwrightWorst) playwrightWorst = result.status;
  if (!fs.existsSync(result.partialJson)) {
    console.error(`Missing partial JSON for ${result.module.label}`);
    playwrightWorst = playwrightWorst || 1;
    continue;
  }
  const partial = JSON.parse(fs.readFileSync(result.partialJson, 'utf8'));
  if (!merged.config) merged.config = partial.config;
  if (Array.isArray(partial.suites)) merged.suites.push(...partial.suites);
  if (Array.isArray(partial.errors)) merged.errors.push(...partial.errors);
}

fs.writeFileSync(archivedJson, JSON.stringify(merged, null, 2));
fs.copyFileSync(archivedJson, latestJson);

const summaryGen = runSync('node', ['scripts/generate-search-ui-report.mjs']);
if (summaryGen.status !== 0) {
  console.warn('Summary generation failed');
  playwrightWorst = playwrightWorst || summaryGen.status || 1;
}

const summaryPath = path.join(root, 'reports', 'search-ui-summary.json');
if (!fs.existsSync(summaryPath)) {
  console.error('Missing reports/search-ui-summary.json');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const annotated = annotateSummaryForCycle(summary, cycle, {
  responsive: args.responsive,
  environment: String(environment).toUpperCase(),
  browser: cycle.browser || CYCLE_BROWSER,
  projects: uniqueProjects,
  grep,
  moduleIds: cycle.moduleIds,
  startedAt,
  finishedAt,
  wallClockMs,
  moduleWorkers,
  playwrightWorkers,
  retries: Number.isFinite(retries) ? retries : 0,
  moduleResults: moduleResults.map((r) => ({
    id: r.module.id,
    label: r.module.label,
    shortLabel: r.module.shortLabel,
    reportModule: r.module.reportModule,
    status: r.status,
    durationMs: r.durationMs,
  })),
});

if (
  cycle.id === 'smoke' &&
  !args.responsive &&
  cycle.expectedSmokeTestCount &&
  annotated.cycle.counts.total !== cycle.expectedSmokeTestCount
) {
  console.warn(
    `\n[warn] Smoke test count ${annotated.cycle.counts.total} != expected ${cycle.expectedSmokeTestCount}. Check @smoke tags / module paths.`,
  );
}

const cycleReportAbs = path.join(root, cycle.reportJson);
fs.writeFileSync(cycleReportAbs, JSON.stringify(annotated, null, 2));
// Keep canonical summary in sync for HTML generator defaults
fs.writeFileSync(summaryPath, JSON.stringify(annotated, null, 2));

const htmlGen = runSync('node', [
  'scripts/generate-search-ui-html.mjs',
  `--summary=${cycle.reportJson}`,
  `--out=${cycle.dashboardHtml}`,
]);
if (htmlGen.status !== 0) {
  // Fallback: default path
  runSync('node', ['scripts/generate-search-ui-html.mjs']);
  const defaultHtml = path.join(root, 'reports', 'html', 'index.html');
  if (fs.existsSync(defaultHtml)) {
    copyFile(defaultHtml, path.join(root, cycle.dashboardHtml));
  }
}

const textSummary = buildConsoleSummary(annotated);
const summaryTxtAbs = path.join(root, cycle.summaryTxt);
fs.writeFileSync(summaryTxtAbs, `${textSummary}\n`);
console.log(`\n${textSummary}\n`);
console.log(`Cycle report: ${cycle.reportJson}`);
console.log(`Cycle dashboard: ${cycle.dashboardHtml}`);
console.log(`Cycle summary: ${cycle.summaryTxt}`);

const exitCode = cycle.failOnUnexpectedFailuresOnly
  ? annotated.cycle.exitCode
  : playwrightWorst || annotated.cycle.exitCode;

process.exit(exitCode);
