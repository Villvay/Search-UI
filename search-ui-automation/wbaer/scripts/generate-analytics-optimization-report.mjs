/**
 * Builds reports/analytics-optimization-summary.md from
 * reports/analytics-batch-results.json (+ optional baseline file).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'reports', 'analytics-batch-results.json');
const baselinePath = path.join(
  root,
  'reports',
  'analytics-optimization-baseline.json',
);
const outMd = path.join(root, 'reports', 'analytics-optimization-summary.md');

function fmtMs(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(0);
  return `${m}m ${rem}s`;
}

function pct(n, d) {
  if (!d) return '—';
  return `${((n / d) * 100).toFixed(1)}%`;
}

if (!fs.existsSync(input)) {
  console.error('Missing', input);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const t = data.totals || {};
const viewports = data.viewports || [];
const baseline = fs.existsSync(baselinePath)
  ? JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  : null;

const datasetRows = t.queriesPerViewport || 0;
const unique = t.uniqueNormalizedQueries || 0;
const dups = t.duplicateRows || Math.max(0, datasetRows - unique);
// actualExecutions is summed across modules × viewports
const actual = t.actualExecutions || 0;
const skippedDup = t.deduplicatedExecutions || t.skipped || 0;

const lines = [];
lines.push('# Analytics optimization summary');
lines.push('');
lines.push(`Generated: ${data.generatedAt}`);
lines.push('');
lines.push('## Dataset');
lines.push('');
lines.push(`- Dataset key: \`${data.dataset}\``);
if (data.datasetLimit) lines.push(`- ANALYTICS_LIMIT: ${data.datasetLimit}`);
lines.push(`- Total rows (per viewport): ${datasetRows}`);
lines.push(`- Unique normalized queries: ${unique}`);
lines.push(`- Duplicate rows: ${dups}`);
lines.push(
  `- Deduplication percentage (rows): ${pct(dups, datasetRows)}`,
);
lines.push('');
lines.push('## Execution');
lines.push('');
lines.push(`- Modules: \`${data.modules || 'on-type,suggestions,on-enter'}\``);
lines.push(`- Workers: ${data.workers}`);
lines.push(`- Viewports: ${viewports.map((v) => v.viewport).join(', ') || '—'}`);
lines.push(`- Wall clock: ${fmtMs(data.wallClockMs)}`);
lines.push(
  `- Actual executions (all modules × viewports): ${actual}`,
);
lines.push(
  `- Deduplicated executions avoided: ${skippedDup}`,
);
lines.push(`- Result rows reported: ${t.resultRows ?? 0}`);
lines.push(
  `- Passed / failed / skipped: ${t.passed ?? 0} / ${t.failed ?? 0} / ${t.skipped ?? 0}`,
);
lines.push('');
lines.push('## Deduplication');
lines.push('');
lines.push('| Metric | Value |');
lines.push('| --- | ---: |');
lines.push(`| Dataset rows | ${datasetRows} |`);
lines.push(`| Unique normalized queries | ${unique} |`);
lines.push(`| Duplicate rows | ${dups} |`);
lines.push(`| Actual executions (aggregate) | ${actual} |`);
lines.push(`| Duplicate executions avoided | ${skippedDup} |`);
lines.push(
  `| Dedup savings (rows) | ${pct(dups, datasetRows)} |`,
);
lines.push('');
lines.push('## Recovery');
lines.push('');
lines.push('| Metric | After | Before (baseline) |');
lines.push('| --- | ---: | ---: |');
lines.push(
  `| Soft failures | ${t.softFailures ?? 0} | ${baseline?.softFailures ?? '—'} |`,
);
lines.push(
  `| Hard failures | ${t.hardFailures ?? 0} | ${baseline?.hardFailures ?? '—'} |`,
);
lines.push(
  `| Page recoveries | ${t.pageRecoveries ?? t.pageRecovers ?? 0} | ${baseline?.pageRecoveries ?? baseline?.pageRecovers ?? '—'} |`,
);
lines.push(
  `| Home navigations | ${t.homeNavigations ?? 0} | ${baseline?.homeNavigations ?? '—'} |`,
);
lines.push(
  `| Reload recoveries | ${t.reloadRecoveries ?? 0} | ${baseline?.reloadRecoveries ?? '—'} |`,
);
lines.push('');
if (baseline?.pageRecoveries != null || baseline?.pageRecovers != null) {
  const before = baseline.pageRecoveries ?? baseline.pageRecovers;
  const after = t.pageRecoveries ?? t.pageRecovers ?? 0;
  lines.push(
    `Measured page recoveries: **before ${before} → after ${after}**.`,
  );
  lines.push('');
}
lines.push('## Runtime');
lines.push('');
lines.push('| Configuration | Runtime |');
lines.push('| --- | ---: |');
lines.push(
  `| Before optimization | ${baseline?.wallClockMs != null ? fmtMs(baseline.wallClockMs) : '— (see calibration / prior run)'} |`,
);
lines.push(`| After optimization | ${fmtMs(data.wallClockMs)} |`);
if (baseline?.wallClockMs) {
  const delta = baseline.wallClockMs - data.wallClockMs;
  const improve = pct(delta, baseline.wallClockMs);
  lines.push(
    `| Improvement | ${delta > 0 ? fmtMs(delta) + ' (' + improve + ')' : '—' } |`,
  );
} else {
  lines.push('| Improvement | — |');
}
lines.push('');
lines.push('## Viewport matrix');
lines.push('');
lines.push(
  '| Browser | Viewport | Rows | Unique | Actual exec | Skipped dup | Soft fail | Page recoveries | Duration |',
);
lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const v of viewports) {
  const life = v.lifecycle || {};
  lines.push(
    `| ${v.browser} | ${v.viewport} | ${life.datasetRows ?? v.queryCount} | ${life.uniqueNormalizedQueries ?? '—'} | ${life.actualExecutions ?? '—'} | ${life.deduplicatedExecutions ?? '—'} | ${life.softFailures ?? 0} | ${life.pageRecoveries ?? life.pageRecovers ?? 0} | ${fmtMs(v.durationMs)} |`,
  );
}
lines.push('');
lines.push('## Reliability');
lines.push('');
lines.push(
  '- Deduplication is scoped per browser + viewport + module (responsive coverage retained).',
);
lines.push(
  '- Soft ON-ENTER failures clear the search input and continue on the current SERP; home navigation is reserved for unusable pages.',
);
lines.push(
  '- Skipped duplicates inherit the canonical result and are not counted as failures.',
);
lines.push(
  '- Functional ON-TYPE / SUGGESTIONS / ON-ENTER specs are unchanged; relevance matching and title sample size are unchanged.',
);
lines.push('');
lines.push('## Recommendation');
lines.push('');
lines.push(
  'Use `ANALYTICS_MODULES=on-type,suggestions` for fast smoke; full modules for nightly. Keep `ANALYTICS_WORKERS=2` for multi-viewport runs.',
);
lines.push('');

fs.writeFileSync(outMd, `${lines.join('\n')}\n`);
console.log('Wrote', path.relative(root, outMd));
