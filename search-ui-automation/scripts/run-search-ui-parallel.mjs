/**
 * Parallel Search UI module runner.
 *
 * Runs independent functional modules concurrently (module-level parallelism),
 * each in its own Playwright process with isolated output/JSON artifacts.
 *
 * Does NOT replace `npm run test:search-ui` (sequential).
 *
 * Env:
 *   UI_MODULE_WORKERS=2          max concurrent module processes (default 2)
 *   UI_PLAYWRIGHT_WORKERS=2      Playwright --workers inside each module (default 2)
 *   UI_MODULES=on-type,suggestions,on-enter,filters,sorting
 *
 * Recommended total browser pressure ≈ UI_MODULE_WORKERS × UI_PLAYWRIGHT_WORKERS.
 */
import { spawn, spawnSync } from 'child_process';
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
const parallelMetaPath = path.join(
  root,
  'reports',
  'ui-parallel-execution-meta.json',
);
const summaryMdPath = path.join(
  root,
  'reports',
  'ui-parallel-execution-summary.md',
);

/** Functional UI modules available to the parallel runner (not analytics). */
const MODULE_CATALOG = {
  'on-type': {
    id: 'on-type',
    label: 'ON-TYPE',
    path: 'src/modules/on-type/tests/on-type.spec.ts',
  },
  suggestions: {
    id: 'suggestions',
    label: 'SUGGESTIONS',
    path: 'src/modules/suggestions/tests/suggestions.spec.ts',
  },
  'trending-now': {
    id: 'trending-now',
    label: 'TRENDING NOW',
    path: 'src/modules/trending-now/tests/trending-now.spec.ts',
  },
  'recent-searches': {
    id: 'recent-searches',
    label: 'RECENT SEARCHES',
    path: 'src/modules/recent-searches/tests/recent-searches.spec.ts',
  },
  'runtime-errors': {
    id: 'runtime-errors',
    label: 'RUNTIME ERRORS',
    path: 'src/modules/runtime-errors/tests/runtime-errors.spec.ts',
  },
  'cache-state': {
    id: 'cache-state',
    label: 'CACHE & STATE',
    path: 'src/modules/cache-state/tests/cache-state.spec.ts',
  },
  'search-input-robustness': {
    id: 'search-input-robustness',
    label: 'SEARCH INPUT ROBUSTNESS',
    path: 'src/modules/search-input-robustness/tests/search-input-robustness.spec.ts',
  },
  'on-enter': {
    id: 'on-enter',
    label: 'ON-ENTER',
    path: 'src/modules/on-enter/tests/on-enter.spec.ts',
  },
  filters: {
    id: 'filters',
    label: 'FILTERS',
    path: 'src/modules/filters-facets/tests/filters-facets.spec.ts',
  },
  'filters-facets': {
    id: 'filters',
    label: 'FILTERS',
    path: 'src/modules/filters-facets/tests/filters-facets.spec.ts',
  },
  sorting: {
    id: 'sorting',
    label: 'SORTING',
    path: 'src/modules/sorting/tests/sorting.spec.ts',
  },
  'related-searches': {
    id: 'related-searches',
    label: 'RELATED SEARCHES',
    path: 'src/modules/related-searches/tests',
  },
  framework: {
    id: 'framework',
    label: 'FRAMEWORK',
    path: 'tests/framework-validation.spec.ts',
  },
};

const DEFAULT_MODULE_IDS = [
  'on-type',
  'suggestions',
  'on-enter',
  'filters',
  'sorting',
];

function resolveModuleWorkers() {
  const raw = (process.env.UI_MODULE_WORKERS || '2').trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    throw new Error(
      `Invalid UI_MODULE_WORKERS="${raw}". Allowed: 1–5 (default 2).`,
    );
  }
  return n;
}

function resolvePlaywrightWorkers() {
  const raw = (process.env.UI_PLAYWRIGHT_WORKERS || '2').trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 4) {
    throw new Error(
      `Invalid UI_PLAYWRIGHT_WORKERS="${raw}". Allowed: 1–4 (default 2).`,
    );
  }
  return n;
}

function resolveModules() {
  const raw = (process.env.UI_MODULES || '').trim();
  const keys = raw
    ? raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [...DEFAULT_MODULE_IDS];

  if (!keys.length) {
    throw new Error(
      `Invalid UI_MODULES="${raw}". Provide comma-separated module ids.`,
    );
  }

  const unknown = keys.filter((k) => !MODULE_CATALOG[k]);
  if (unknown.length) {
    const supported = [
      ...new Set(Object.values(MODULE_CATALOG).map((m) => m.id)),
    ].join(', ');
    throw new Error(
      `Invalid UI_MODULES entry: ${unknown.join(', ')}. Supported: ${supported}`,
    );
  }

  // Dedupe by canonical id while preserving order
  const seen = new Set();
  const modules = [];
  for (const key of keys) {
    const mod = MODULE_CATALOG[key];
    if (seen.has(mod.id)) continue;
    seen.add(mod.id);
    modules.push(mod);
  }
  return modules;
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

function runModule(module, extraArgs, playwrightWorkers) {
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
    ...extraArgs,
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

async function runPool(modules, concurrency, extraArgs, playwrightWorkers) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < modules.length) {
      const current = modules[index];
      index += 1;
      // eslint-disable-next-line no-await-in-loop
      const result = await runModule(current, extraArgs, playwrightWorkers);
      results.push(result);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, modules.length) },
    () => worker(),
  );
  await Promise.all(workers);
  // Preserve original module schedule order in reporting
  results.sort(
    (a, b) =>
      modules.findIndex((m) => m.id === a.module.id) -
      modules.findIndex((m) => m.id === b.module.id),
  );
  return results;
}

function fmtMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function writeParallelSummary(meta) {
  const lines = [];
  lines.push('# UI parallel execution summary');
  lines.push('');
  lines.push(`Generated: ${meta.generatedAt}`);
  lines.push('');
  lines.push('## Configuration');
  lines.push('');
  lines.push(`- Command: \`npm run test:search-ui:parallel\``);
  lines.push(`- UI_MODULE_WORKERS: ${meta.moduleWorkers}`);
  lines.push(`- UI_PLAYWRIGHT_WORKERS: ${meta.playwrightWorkers}`);
  lines.push(
    `- Approx concurrent browsers: ≤ ${meta.moduleWorkers * meta.playwrightWorkers}`,
  );
  lines.push(`- Modules: ${meta.modules.map((m) => m.label).join(', ')}`);
  lines.push(`- Extra args: ${meta.extraArgs.join(' ') || '(none)'}`);
  lines.push(`- Wall clock: ${fmtMs(meta.wallClockMs)}`);
  lines.push('');
  lines.push('## Module results');
  lines.push('');
  lines.push('| Module | Exit | Duration | Partial JSON |');
  lines.push('| --- | ---: | ---: | --- |');
  for (const r of meta.moduleResults) {
    lines.push(
      `| ${r.label} | ${r.status === 0 ? 'PASS' : 'FAIL'} | ${fmtMs(r.durationMs)} | \`${r.partialRel}\` |`,
    );
  }
  lines.push('');
  lines.push('## Suite totals (merged)');
  lines.push('');
  lines.push(`- Total: ${meta.totals.total ?? '—'}`);
  lines.push(`- Passed: ${meta.totals.passed}`);
  lines.push(`- Failed: ${meta.totals.failed}`);
  lines.push(`- Skipped: ${meta.totals.skipped}`);
  lines.push(`- Recovered: ${meta.totals.recovered}`);
  lines.push(`- Overall exit: ${meta.worstStatus}`);
  lines.push('');
  if (meta.sequentialWallMs != null) {
    lines.push('## Benchmark');
    lines.push('');
    lines.push(
      'Fair comparison uses the **same five functional modules** and Playwright args.',
    );
    lines.push(
      'Sequential baseline = `UI_MODULE_WORKERS=1` (modules one-at-a-time). Parallel = `UI_MODULE_WORKERS=2`.',
    );
    lines.push(
      '(`npm run test:search-ui` remains available unchanged; it also includes related-searches, framework, and analytics specs under module folders.)',
    );
    lines.push('');
    lines.push('| Configuration | Runtime |');
    lines.push('| --- | ---: |');
    lines.push(
      `| Sequential modules (UI_MODULE_WORKERS=1) | ${fmtMs(meta.sequentialWallMs)} |`,
    );
    lines.push(
      `| Parallel modules (UI_MODULE_WORKERS=${meta.moduleWorkers}) | ${fmtMs(meta.wallClockMs)} |`,
    );
    const delta = meta.sequentialWallMs - meta.wallClockMs;
    const pct =
      meta.sequentialWallMs > 0
        ? ((delta / meta.sequentialWallMs) * 100).toFixed(1)
        : '—';
    lines.push(
      `| Improvement | ${delta > 0 ? fmtMs(delta) + ' (' + pct + '%)' : '—'} |`,
    );
    lines.push('');
  }
  lines.push('## Reliability / contention');
  lines.push('');
  lines.push(
    '- Each module uses an isolated Playwright process, `--output`, and JSON partial file (no shared page/context).',
  );
  lines.push(
    '- A failing module does not cancel remaining modules; overall exit is non-zero if any module failed.',
  );
  lines.push(
    `- Observed max browser pressure ≈ ${meta.moduleWorkers} × ${meta.playwrightWorkers} = ${meta.moduleWorkers * meta.playwrightWorkers}.`,
  );
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  lines.push(
    '- Local: `UI_MODULE_WORKERS=2 UI_PLAYWRIGHT_WORKERS=2 npm run test:search-ui:parallel`',
  );
  lines.push(
    '- CI: start with the same `2×2`; only raise if CPU/RAM allow. Prefer this for functional UI gates.',
  );
  lines.push(
    '- Keep `npm run test:search-ui` for sequential/low-disk or when analytics specs under module folders must run together.',
  );
  lines.push(
    '- Safe as a **CI functional strategy** at 2×2; not a drop-in replacement for the full sequential suite without aligning included specs.',
  );
  lines.push('');

  fs.writeFileSync(summaryMdPath, `${lines.join('\n')}\n`);
  console.log(`Wrote ${path.relative(root, summaryMdPath)}`);
}

// --- main ---
const moduleWorkers = resolveModuleWorkers();
const playwrightWorkers = resolvePlaywrightWorkers();
const modules = resolveModules();
const extraArgs = process.argv.slice(2);

console.log('Search UI PARALLEL module execution');
console.log(`  UI_MODULE_WORKERS=${moduleWorkers}`);
console.log(`  UI_PLAYWRIGHT_WORKERS=${playwrightWorkers}`);
console.log(
  `  Approx max browsers ≈ ${moduleWorkers} × ${playwrightWorkers} = ${moduleWorkers * playwrightWorkers}`,
);
console.log(
  `  Modules: ${modules.map((m) => m.label).join(', ')}`,
);
console.log(`  Extra args: ${extraArgs.join(' ') || '(none)'}`);

const clean = runSync('node', ['scripts/clean-test-artifacts.mjs']);
if (clean.status !== 0) process.exit(clean.status ?? 1);

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.mkdirSync(path.join(root, 'reports', 'html'), { recursive: true });
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });

// Remove stale per-module partials
for (const file of fs.readdirSync(path.join(root, 'reports'))) {
  if (file.startsWith('playwright-results.partial.')) {
    fs.rmSync(path.join(root, 'reports', file), { force: true });
  }
}

const wallStart = Date.now();
const moduleResults = await runPool(
  modules,
  moduleWorkers,
  extraArgs,
  playwrightWorkers,
);
const wallClockMs = Date.now() - wallStart;

const merged = {
  config: null,
  suites: [],
  errors: [],
  stats: null,
};

let worstStatus = 0;
for (const result of moduleResults) {
  if (result.status > worstStatus) worstStatus = result.status;
  if (!fs.existsSync(result.partialJson)) {
    console.error(`Missing partial JSON for ${result.module.label}`);
    worstStatus = worstStatus || 1;
    continue;
  }
  const partial = JSON.parse(fs.readFileSync(result.partialJson, 'utf8'));
  if (!merged.config) merged.config = partial.config;
  if (Array.isArray(partial.suites)) merged.suites.push(...partial.suites);
  if (Array.isArray(partial.errors)) merged.errors.push(...partial.errors);
}

fs.writeFileSync(archivedJson, JSON.stringify(merged, null, 2));
fs.copyFileSync(archivedJson, latestJson);
console.log(`\nArchived full-suite JSON: ${path.relative(root, archivedJson)}`);

const summary = runSync('node', ['scripts/generate-search-ui-report.mjs']);
if (summary.status !== 0) {
  console.warn('Summary generation failed');
  worstStatus = worstStatus || summary.status || 1;
}

const htmlBuild = runSync('node', ['scripts/generate-search-ui-html.mjs']);
if (htmlBuild.status !== 0) {
  console.warn(
    'Consolidated HTML generation failed; Markdown/JSON summary remain available.',
  );
}

// Pull totals from generated summary if present
let totals = { passed: 0, failed: 0, skipped: 0, recovered: 0, total: 0 };
const summaryJsonPath = path.join(root, 'reports', 'search-ui-summary.json');
if (fs.existsSync(summaryJsonPath)) {
  try {
    const s = JSON.parse(fs.readFileSync(summaryJsonPath, 'utf8'));
    const o = s.overall || s.totals || {};
    totals = {
      passed: o.passed ?? 0,
      failed: o.failed ?? 0,
      skipped: o.skipped ?? 0,
      recovered: o.recovered ?? 0,
      total: o.total ?? 0,
    };
  } catch {
    // ignore
  }
}

const sequentialHintPath = path.join(
  root,
  'reports',
  'ui-sequential-benchmark.json',
);
let sequentialWallMs = null;
if (fs.existsSync(sequentialHintPath)) {
  try {
    sequentialWallMs = JSON.parse(
      fs.readFileSync(sequentialHintPath, 'utf8'),
    ).wallClockMs;
  } catch {
    sequentialWallMs = null;
  }
}

const meta = {
  generatedAt: new Date().toISOString(),
  mode: 'parallel',
  moduleWorkers,
  playwrightWorkers,
  wallClockMs,
  sequentialWallMs,
  worstStatus,
  extraArgs,
  modules: modules.map((m) => ({ id: m.id, label: m.label, path: m.path })),
  moduleResults: moduleResults.map((r) => ({
    id: r.module.id,
    label: r.module.label,
    status: r.status,
    durationMs: r.durationMs,
    partialRel: path.relative(root, r.partialJson),
  })),
  totals,
};

fs.writeFileSync(parallelMetaPath, JSON.stringify(meta, null, 2));
writeParallelSummary(meta);

console.log(
  `\nParallel done: wall=${fmtMs(wallClockMs)} exit=${worstStatus} ` +
    `passed=${totals.passed} failed=${totals.failed} skipped=${totals.skipped}`,
);

process.exit(worstStatus || 0);
