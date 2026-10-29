/**
 * Builds analytics-specific reports from Playwright JSON:
 *   reports/analytics-query-results.json
 *   reports/analytics-failures.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  path.join(root, 'reports', 'analytics-playwright-results.json'),
  path.join(root, 'reports', 'playwright-results.json'),
];
const resultsPath = candidates.find((p) => fs.existsSync(p));
const jsonOut = path.join(root, 'reports', 'analytics-query-results.json');
const mdOut = path.join(root, 'reports', 'analytics-failures.md');

const ANALYTICS_MODULES = [
  'ON-TYPE ANALYTICS',
  'SUGGESTIONS ANALYTICS',
  'ON-ENTER ANALYTICS',
];

const VIEWPORT_ORDER = [
  'desktop-1440',
  'desktop-1440-chrome',
  'desktop-1440-firefox',
  'desktop-1440-safari',
  'desktop-1280',
  'tablet-1024',
  'tablet-768',
  'mobile-390',
  'mobile-375',
];

function cleanMessage(message) {
  if (!message) return null;
  return String(message)
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')[0]
    .trim()
    .slice(0, 400);
}

function moduleFromFile(file = '') {
  const normalized = file.replace(/\\/g, '/');
  if (normalized.includes('/on-type/') && normalized.includes('-analytics'))
    return 'ON-TYPE ANALYTICS';
  if (normalized.includes('/suggestions/') && normalized.includes('-analytics'))
    return 'SUGGESTIONS ANALYTICS';
  if (normalized.includes('/on-enter/') && normalized.includes('-analytics'))
    return 'ON-ENTER ANALYTICS';
  return 'OTHER';
}

function extractAnalyticsId(title = '') {
  const match = title.match(/^(AN-Q\d+)\b/i);
  return match ? match[1].toUpperCase() : '';
}

function classifyOutcome(results = []) {
  if (!results.length) {
    return { status: 'unknown', attempts: 0, durationMs: 0, error: null };
  }
  const attempts = results.length;
  const durationMs = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  const last = results[results.length - 1];
  const statuses = results.map((r) => r.status);

  if (last.status === 'passed') {
    const failedEarlier = results
      .slice(0, -1)
      .some((r) => r.status === 'failed' || r.status === 'timedOut');
    if (failedEarlier) {
      const firstFail = results.find((r) => r.status === 'failed' || r.status === 'timedOut');
      return {
        status: 'recovered',
        attempts,
        durationMs,
        error: cleanMessage(firstFail?.error?.message) || null,
      };
    }
    return { status: 'passed', attempts, durationMs, error: null };
  }

  if (last.status === 'skipped') {
    return {
      status: 'skipped',
      attempts,
      durationMs,
      error: cleanMessage(last.error?.message) || 'Skipped',
    };
  }

  if (last.status === 'failed' || last.status === 'timedOut' || last.status === 'interrupted') {
    return {
      status: 'failed',
      attempts,
      durationMs,
      error: cleanMessage(last.error?.message) || last.status,
    };
  }

  return {
    status: last.status || 'unknown',
    attempts,
    durationMs,
    error: cleanMessage(last.error?.message),
  };
}

function annotationMap(annotations = []) {
  const map = {};
  for (const a of annotations || []) {
    if (a?.type) map[a.type] = a.description ?? '';
  }
  return map;
}

function walkSuites(suites, fileHint, acc) {
  for (const suite of suites || []) {
    const file = suite.file || fileHint;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const title = spec.title || test.title || '';
        const fileNorm = (file || '').replace(/\\/g, '/');
        const queryId = extractAnalyticsId(title);
        if (!queryId && !fileNorm.includes('-analytics')) continue;

        const outcome = classifyOutcome(test.results || []);
        const ann = annotationMap([
          ...(spec.annotations || []),
          ...(test.annotations || []),
        ]);

        acc.push({
          queryId,
          query: ann.analyticsQuery || '',
          module: (ann.analyticsModule || moduleFromFile(file)).toLowerCase(),
          moduleLabel: moduleFromFile(file),
          viewport: test.projectName || test.projectId || 'unknown',
          status: outcome.status,
          attempts: outcome.attempts,
          durationMs: outcome.durationMs,
          suggestionCount: ann.suggestionCount ? Number(ann.suggestionCount) : null,
          suggestionsAvailable:
            ann.suggestionsAvailable === 'true'
              ? true
              : ann.suggestionsAvailable === 'false'
                ? false
                : null,
          url: ann.landedUrl || null,
          failureReason: outcome.status === 'failed' ? outcome.error : null,
          title,
        });
      }
    }
    if (suite.suites?.length) walkSuites(suite.suites, file, acc);
  }
}

function emptyBucket() {
  return { passed: 0, failed: 0, skipped: 0, recovered: 0, total: 0 };
}

function bump(bucket, status) {
  bucket.total += 1;
  if (status === 'passed') bucket.passed += 1;
  else if (status === 'failed') bucket.failed += 1;
  else if (status === 'skipped') bucket.skipped += 1;
  else if (status === 'recovered') bucket.recovered += 1;
}

function pct(n, d) {
  if (!d) return '0%';
  return `${((n / d) * 100).toFixed(1)}%`;
}

if (!resultsPath) {
  console.error('Missing Playwright JSON for analytics report.');
  process.exit(1);
}

console.log(`Reading ${path.relative(root, resultsPath)}`);
const raw = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const rows = [];
walkSuites(raw.suites || [], '', rows);

const overall = emptyBucket();
const byModule = Object.fromEntries(ANALYTICS_MODULES.map((m) => [m, emptyBucket()]));
const byViewportModule = {};

for (const r of rows) {
  bump(overall, r.status);
  const mod = r.moduleLabel;
  if (!byModule[mod]) byModule[mod] = emptyBucket();
  bump(byModule[mod], r.status);

  const key = `${r.viewport}|${mod}`;
  if (!byViewportModule[key]) {
    byViewportModule[key] = { viewport: r.viewport, module: mod, ...emptyBucket() };
  }
  bump(byViewportModule[key], r.status);
}

const executed = overall.passed + overall.failed + overall.recovered;
const uniqueQueries = new Set(rows.map((r) => r.queryId).filter(Boolean)).size;

const report = {
  generatedAt: new Date().toISOString(),
  source: path.relative(root, resultsPath),
  datasetSize: 50,
  uniqueQueriesInRun: uniqueQueries,
  overall: {
    ...overall,
    executed,
    passRate: pct(overall.passed + overall.recovered, executed),
  },
  byModule,
  byViewportModule: Object.values(byViewportModule).sort((a, b) => {
    const vp =
      VIEWPORT_ORDER.indexOf(a.viewport) - VIEWPORT_ORDER.indexOf(b.viewport);
    if (vp !== 0) return vp;
    return ANALYTICS_MODULES.indexOf(a.module) - ANALYTICS_MODULES.indexOf(b.module);
  }),
  results: rows.sort((a, b) => {
    const mod =
      ANALYTICS_MODULES.indexOf(a.moduleLabel) -
      ANALYTICS_MODULES.indexOf(b.moduleLabel);
    if (mod !== 0) return mod;
    const vp =
      VIEWPORT_ORDER.indexOf(a.viewport) - VIEWPORT_ORDER.indexOf(b.viewport);
    if (vp !== 0) return vp;
    return a.queryId.localeCompare(b.queryId);
  }),
};

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));

const failures = rows.filter((r) => r.status === 'failed');
const md = [];
md.push('# Analytics Query Failures');
md.push('');
if (!failures.length) {
  md.push('No analytics query failures.');
} else {
  md.push('| Query ID | Module | Viewport | Query | Failure |');
  md.push('| --- | --- | --- | --- | --- |');
  for (const f of failures) {
    md.push(
      `| ${f.queryId} | ${f.module} | ${f.viewport} | ${String(f.query).replace(/\|/g, '\\|')} | ${String(f.failureReason || '').replace(/\|/g, '\\|')} |`,
    );
  }
}
md.push('');
fs.writeFileSync(mdOut, md.join('\n'));

console.log(`Wrote ${path.relative(root, jsonOut)}`);
console.log(`Wrote ${path.relative(root, mdOut)}`);
console.log(
  `Analytics: total=${overall.total} passed=${overall.passed} failed=${overall.failed} recovered=${overall.recovered} passRate=${report.overall.passRate}`,
);
