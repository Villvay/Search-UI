/**
 * Aggregates Playwright JSON results into:
 *   reports/search-ui-summary.json
 *   reports/search-ui-summary.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  path.join(root, 'reports', 'search-ui-playwright-results.json'),
  path.join(root, 'reports', 'playwright-results.json'),
];
const resultsPath = candidates.find((p) => fs.existsSync(p));
const jsonOut = path.join(root, 'reports', 'search-ui-summary.json');
const mdOut = path.join(root, 'reports', 'search-ui-summary.md');

const MODULE_ORDER = [
  'FRAMEWORK',
  'ON-TYPE',
  'SUGGESTIONS',
  'ON-ENTER',
  'RELATED SEARCHES',
  'ON-TYPE ANALYTICS',
  'SUGGESTIONS ANALYTICS',
  'ON-ENTER ANALYTICS',
];

const FUNCTIONAL_MODULES = [
  'FRAMEWORK',
  'ON-TYPE',
  'SUGGESTIONS',
  'ON-ENTER',
  'RELATED SEARCHES',
];

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

function moduleFromFile(file = '') {
  const normalized = file.replace(/\\/g, '/');
  if (normalized.includes('/modules/on-type/') && normalized.includes('-analytics'))
    return 'ON-TYPE ANALYTICS';
  if (normalized.includes('/modules/suggestions/') && normalized.includes('-analytics'))
    return 'SUGGESTIONS ANALYTICS';
  if (normalized.includes('/modules/on-enter/') && normalized.includes('-analytics'))
    return 'ON-ENTER ANALYTICS';
  if (normalized.includes('/modules/on-type/')) return 'ON-TYPE';
  if (normalized.includes('/modules/suggestions/')) return 'SUGGESTIONS';
  if (normalized.includes('/modules/on-enter/')) return 'ON-ENTER';
  if (normalized.includes('/modules/related-searches/')) return 'RELATED SEARCHES';
  if (normalized.includes('framework-validation')) return 'FRAMEWORK';
  return 'OTHER';
}

function extractTestId(title = '') {
  const analytics = title.match(/^(AN-Q\d+)\b/i);
  if (analytics) return analytics[1].toUpperCase();
  const match = title.match(
    /^((?:ON-TYPE|SUG|ENTER|REL|FW)-\d+)\b/i,
  );
  if (match) return match[1].toUpperCase().replace('ON-TYPE', 'ON-TYPE');
  const m2 = title.match(/^([A-Z]+-\d+)\b/i);
  return m2 ? m2[1].toUpperCase() : '';
}

function classifyOutcome(results = []) {
  if (!results.length) {
    return { status: 'unknown', attempts: 0, durationMs: 0, error: null, skipReason: null };
  }

  const attempts = results.length;
  const durationMs = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  const last = results[results.length - 1];
  const statuses = results.map((r) => r.status);

  if (last.status === 'skipped' || statuses.every((s) => s === 'skipped')) {
    const skip =
      results.find((r) => r.error?.message)?.error?.message ||
      results.find((r) => r.status === 'skipped')?.error?.message ||
      null;
    return {
      status: 'skipped',
      attempts,
      durationMs,
      error: null,
      skipReason: cleanMessage(skip) || 'Skipped',
    };
  }

  if (last.status === 'passed') {
    const failedEarlier = results
      .slice(0, -1)
      .some((r) => r.status === 'failed' || r.status === 'timedOut' || r.status === 'interrupted');
    if (failedEarlier) {
      const firstFail = results.find(
        (r) => r.status === 'failed' || r.status === 'timedOut' || r.status === 'interrupted',
      );
      return {
        status: 'recovered',
        attempts,
        durationMs,
        error: cleanMessage(firstFail?.error?.message) || null,
        skipReason: null,
      };
    }
    return {
      status: 'passed',
      attempts,
      durationMs,
      error: null,
      skipReason: null,
    };
  }

  if (last.status === 'failed' || last.status === 'timedOut' || last.status === 'interrupted') {
    return {
      status: 'failed',
      attempts,
      durationMs,
      error: cleanMessage(last.error?.message) || last.status,
      skipReason: null,
    };
  }

  return {
    status: last.status || 'unknown',
    attempts,
    durationMs,
    error: cleanMessage(last.error?.message),
    skipReason: null,
  };
}

function cleanMessage(message) {
  if (!message) return null;
  return String(message)
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')[0]
    .trim()
    .slice(0, 400);
}

function walkSuites(suites, fileHint, acc) {
  for (const suite of suites || []) {
    const file = suite.file || fileHint;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const outcome = classifyOutcome(test.results || []);
        const title = spec.title || test.title || '';
        const skipFromAnnotation = [...(spec.annotations || []), ...(test.annotations || [])]
          .filter((a) => a?.type === 'skip' || a?.type === 'fix')
          .map((a) => a.description)
          .find(Boolean);
        if (outcome.status === 'skipped' && skipFromAnnotation) {
          outcome.skipReason = cleanMessage(skipFromAnnotation) || outcome.skipReason;
        }
        acc.push({
          testId: extractTestId(title),
          title,
          module: moduleFromFile(file),
          viewport: test.projectName || test.projectId || 'unknown',
          file: file || '',
          status: outcome.status,
          attempts: outcome.attempts,
          durationMs: outcome.durationMs,
          error: outcome.error,
          skipReason: outcome.skipReason,
        });
      }
    }
    if (suite.suites?.length) {
      walkSuites(suite.suites, file, acc);
    }
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

function formatDuration(ms) {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

if (!resultsPath) {
  console.error(
    'Missing Playwright JSON results. Looked for:\n' +
      candidates.map((p) => `  - ${path.relative(root, p)}`).join('\n'),
  );
  console.error('Run npm run test:search-ui first.');
  process.exit(1);
}

console.log(`Reading ${path.relative(root, resultsPath)}`);

const raw = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const cases = [];
walkSuites(raw.suites || [], '', cases);

const overall = emptyBucket();
const byModule = Object.fromEntries(MODULE_ORDER.map((m) => [m, emptyBucket()]));
const byViewport = Object.fromEntries(VIEWPORT_ORDER.map((v) => [v, emptyBucket()]));

for (const c of cases) {
  bump(overall, c.status);
  if (!byModule[c.module]) byModule[c.module] = emptyBucket();
  bump(byModule[c.module], c.status);
  if (!byViewport[c.viewport]) byViewport[c.viewport] = emptyBucket();
  bump(byViewport[c.viewport], c.status);
}

const executed = overall.passed + overall.failed + overall.recovered;
const passRate = pct(overall.passed + overall.recovered, executed);

const generatedAt = new Date().toISOString();

function sumBuckets(names) {
  const out = emptyBucket();
  for (const name of names) {
    const b = byModule[name] || emptyBucket();
    out.passed += b.passed;
    out.failed += b.failed;
    out.skipped += b.skipped;
    out.recovered += b.recovered;
    out.total += b.total;
  }
  return out;
}

const functionalOverall = sumBuckets(FUNCTIONAL_MODULES);
const analyticsOverall = sumBuckets(ANALYTICS_MODULES);
const functionalExecuted =
  functionalOverall.passed + functionalOverall.failed + functionalOverall.recovered;
const analyticsExecuted =
  analyticsOverall.passed + analyticsOverall.failed + analyticsOverall.recovered;

const summary = {
  generatedAt,
  source: path.relative(root, resultsPath),
  overall: {
    ...overall,
    /** Pass rate among executed (non-skipped) tests; recovered counts as pass. */
    passRate,
    executed,
  },
  functionalCoverage: {
    ...functionalOverall,
    passRate: pct(
      functionalOverall.passed + functionalOverall.recovered,
      functionalExecuted,
    ),
    executed: functionalExecuted,
  },
  analyticsCoverage: {
    datasetSize: 50,
    ...analyticsOverall,
    passRate: pct(
      analyticsOverall.passed + analyticsOverall.recovered,
      analyticsExecuted,
    ),
    executed: analyticsExecuted,
  },
  byModule,
  byViewport,
  tests: cases.sort((a, b) => {
    const mod = MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module);
    if (mod !== 0) return mod;
    const vp = VIEWPORT_ORDER.indexOf(a.viewport) - VIEWPORT_ORDER.indexOf(b.viewport);
    if (vp !== 0) return vp;
    return (a.testId || a.title).localeCompare(b.testId || b.title);
  }),
};

fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
fs.writeFileSync(jsonOut, JSON.stringify(summary, null, 2));

const failures = cases.filter((c) => c.status === 'failed');
const recovered = cases.filter((c) => c.status === 'recovered');
const skipped = cases.filter((c) => c.status === 'skipped');

const md = [];
md.push('# Search UI Automation Test Report');
md.push('');
md.push(`Generated: ${generatedAt}`);
md.push('');
md.push('## Overall Summary');
md.push('');
md.push('| Metric | Result |');
md.push('| --- | ---: |');
md.push(`| Total tests | ${overall.total} |`);
md.push(`| Passed | ${overall.passed} |`);
md.push(`| Failed | ${overall.failed} |`);
md.push(`| Skipped | ${overall.skipped} |`);
md.push(`| Flaky/retried (recovered) | ${overall.recovered} |`);
md.push(`| Pass rate (executed) | ${passRate} |`);
md.push('');
md.push('## Functional Coverage');
md.push('');
md.push('| Metric | Result |');
md.push('| --- | ---: |');
md.push(`| Total | ${functionalOverall.total} |`);
md.push(`| Passed | ${functionalOverall.passed} |`);
md.push(`| Failed | ${functionalOverall.failed} |`);
md.push(`| Skipped | ${functionalOverall.skipped} |`);
md.push(`| Recovered | ${functionalOverall.recovered} |`);
md.push(`| Pass rate | ${summary.functionalCoverage.passRate} |`);
md.push('');
md.push('## Analytics Query Coverage');
md.push('');
md.push('| Metric | Result |');
md.push('| --- | ---: |');
md.push(`| Analytics queries (dataset) | 50 |`);
md.push(`| Queries executed (tests) | ${analyticsOverall.total} |`);
md.push(`| Passed | ${analyticsOverall.passed} |`);
md.push(`| Failed | ${analyticsOverall.failed} |`);
md.push(`| Skipped | ${analyticsOverall.skipped} |`);
md.push(`| Recovered after retry | ${analyticsOverall.recovered} |`);
md.push(`| Pass rate | ${summary.analyticsCoverage.passRate} |`);
md.push('');
md.push('### Analytics results by module');
md.push('');
md.push('| Module | Queries | Passed | Failed | Skipped | Recovered |');
md.push('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const name of ANALYTICS_MODULES) {
  const b = byModule[name] || emptyBucket();
  if (b.total === 0) continue;
  md.push(
    `| ${name.replace(' ANALYTICS', '')} | ${b.total} | ${b.passed} | ${b.failed} | ${b.skipped} | ${b.recovered} |`,
  );
}
md.push('');
md.push('## Results by Module');
md.push('');
md.push('| Module | Passed | Failed | Skipped | Recovered | Total |');
md.push('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const name of MODULE_ORDER) {
  const b = byModule[name] || emptyBucket();
  if (b.total === 0) continue;
  md.push(
    `| ${name} | ${b.passed} | ${b.failed} | ${b.skipped} | ${b.recovered} | ${b.total} |`,
  );
}
md.push('');
md.push('## Results by Viewport');
md.push('');
md.push('| Viewport | Passed | Failed | Skipped | Recovered | Total |');
md.push('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const name of VIEWPORT_ORDER) {
  const b = byViewport[name] || emptyBucket();
  md.push(
    `| ${name} | ${b.passed} | ${b.failed} | ${b.skipped} | ${b.recovered} | ${b.total} |`,
  );
}
md.push('');
md.push('## Test Case Results');
md.push('');
md.push('| Test ID | Module | Test | Viewport | Status | Duration | Notes |');
md.push('| --- | --- | --- | --- | --- | ---: | --- |');

for (const c of summary.tests) {
  const statusLabel =
    c.status === 'recovered'
      ? 'RECOVERED AFTER RETRY'
      : c.status === 'passed'
        ? 'PASS'
        : c.status === 'failed'
          ? 'FAIL'
          : c.status === 'skipped'
            ? 'SKIPPED'
            : c.status.toUpperCase();
  const notes =
    c.status === 'failed'
      ? (c.error || '').replace(/\|/g, '\\|')
      : c.status === 'skipped'
        ? (c.skipReason || '').replace(/\|/g, '\\|')
        : c.status === 'recovered'
          ? `Passed on retry (attempt ${c.attempts}); earlier: ${(c.error || 'failure').replace(/\|/g, '\\|')}`
          : '';
  md.push(
    `| ${c.testId || '-'} | ${c.module} | ${c.title.replace(/\|/g, '\\|')} | ${c.viewport} | ${statusLabel} | ${formatDuration(c.durationMs)} | ${notes} |`,
  );
}

if (failures.length) {
  md.push('');
  md.push('## Failures');
  md.push('');
  for (const f of failures) {
    md.push(`### ${f.testId || f.title} (${f.viewport})`);
    md.push('');
    md.push(`- Module: ${f.module}`);
    md.push(`- Attempts: ${f.attempts}`);
    md.push(`- Error: ${f.error || 'n/a'}`);
    md.push('');
  }
}

if (recovered.length) {
  md.push('');
  md.push('## Recovered after retry');
  md.push('');
  for (const r of recovered) {
    md.push(
      `- **${r.testId || r.title}** / ${r.viewport} — earlier failure: ${r.error || 'n/a'}`,
    );
  }
  md.push('');
}

if (skipped.length) {
  md.push('');
  md.push('## Skipped');
  md.push('');
  // Deduplicate skip reasons for readability
  const byReason = new Map();
  for (const s of skipped) {
    const key = s.skipReason || 'Skipped';
    if (!byReason.has(key)) byReason.set(key, []);
    byReason.get(key).push(`${s.testId || s.title} (${s.viewport})`);
  }
  for (const [reason, items] of byReason) {
    md.push(`### ${reason}`);
    md.push('');
    md.push(`Count: ${items.length}`);
    md.push('');
  }
}

md.push('');
md.push('## Report artifacts');
md.push('');
md.push('- Playwright HTML: `reports/html` (`npm run test:report`)');
md.push('- Playwright JSON: `reports/playwright-results.json`');
md.push('- Summary JSON: `reports/search-ui-summary.json`');
md.push('- Summary Markdown: `reports/search-ui-summary.md`');
md.push('- Analytics JSON: `reports/analytics-query-results.json`');
md.push('- Analytics failures: `reports/analytics-failures.md`');
md.push('');

fs.writeFileSync(mdOut, md.join('\n'));

console.log(`Wrote ${path.relative(root, jsonOut)}`);
console.log(`Wrote ${path.relative(root, mdOut)}`);
console.log(
  `Totals: total=${overall.total} passed=${overall.passed} failed=${overall.failed} skipped=${overall.skipped} recovered=${overall.recovered} passRate=${passRate}`,
);
