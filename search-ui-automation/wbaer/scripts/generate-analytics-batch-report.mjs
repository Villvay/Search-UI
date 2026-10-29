/**
 * Builds reports/analytics-batch-execution-summary.md from
 * reports/analytics-batch-results.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'reports', 'analytics-batch-results.json');
const outMd = path.join(root, 'reports', 'analytics-batch-execution-summary.md');
const datasetFile = path.join(
  root,
  'src',
  'test-data',
  'analytics',
  'queries-top50-sku-nonsku-2026-08-31.json',
);

if (!fs.existsSync(input)) {
  console.error('Missing', input);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const viewports = data.viewports || [];
const failures = viewports.flatMap((v) =>
  (v.results || []).filter((r) => r.status === 'failed'),
);

function fmtMs(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(0);
  return `${m}m ${rem}s`;
}

function datasetStats() {
  try {
    const raw = JSON.parse(fs.readFileSync(datasetFile, 'utf8'));
    const queries = raw.queries || [];
    const texts = queries.map((q) => q.query);
    const uniqueExact = new Set(texts);
    const uniqueCi = new Set(texts.map((t) => t.toLowerCase()));
    const categories = [
      ...new Set(queries.map((q) => q.category || 'unknown')),
    ].sort();
    const lists = [...new Set(queries.map((q) => q.list || 'unknown'))];
    return {
      file: path.relative(root, datasetFile),
      total: queries.length,
      uniqueExact: uniqueExact.size,
      uniqueCi: uniqueCi.size,
      exactDupOccurrences: texts.length - uniqueExact.size,
      categories,
      lists,
    };
  } catch {
    return null;
  }
}

const ds = datasetStats();
const lines = [];
lines.push('# Analytics batch execution summary');
lines.push('');
lines.push(`Generated: ${data.generatedAt}`);
lines.push('');
lines.push('## Dataset');
lines.push('');
if (ds) {
  lines.push(`- File: \`${ds.file}\``);
  lines.push(`- Dataset key: \`${data.dataset}\``);
  lines.push(`- Total queries (source): ${ds.total}`);
  lines.push(`- Unique queries (exact): ${ds.uniqueExact}`);
  lines.push(`- Unique queries (case-insensitive): ${ds.uniqueCi}`);
  lines.push(`- Exact duplicate occurrences: ${ds.exactDupOccurrences}`);
  lines.push(`- Categories: ${ds.categories.join(', ')}`);
  lines.push(`- Lists: ${ds.lists.join(', ')}`);
} else {
  lines.push(`- File / key: \`${data.dataset}\``);
}
lines.push(
  `- Queries executed per viewport (this run): ${data.totals.queriesPerViewport}`,
);
if (data.datasetLimit) {
  lines.push(`- ANALYTICS_LIMIT: ${data.datasetLimit}`);
}
lines.push(
  `- Result rows (queries × modules × viewports): ${data.totals.resultRows}`,
);
lines.push(`- Workers: ${data.workers}`);
lines.push(`- Modules: \`${data.modules || 'on-type,suggestions,on-enter'}\``);
lines.push(`- Wall clock: ${fmtMs(data.wallClockMs)}`);
if (data.totals.uniqueNormalizedQueries != null) {
  lines.push(
    `- Unique normalized queries: ${data.totals.uniqueNormalizedQueries}`,
  );
  lines.push(`- Duplicate rows: ${data.totals.duplicateRows ?? '—'}`);
  lines.push(`- Actual executions: ${data.totals.actualExecutions ?? '—'}`);
  lines.push(
    `- Deduplicated executions: ${data.totals.deduplicatedExecutions ?? '—'}`,
  );
}
lines.push('');
lines.push('## Execution matrix');
lines.push('');
lines.push(
  '| Browser | Viewport | Queries | Passed | Failed | Skipped | Duration |',
);
lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
for (const v of viewports) {
  const passed = v.results.filter((r) => r.status === 'passed').length;
  const failed = v.results.filter((r) => r.status === 'failed').length;
  const skipped = v.results.filter((r) => r.status === 'skipped').length;
  lines.push(
    `| ${v.browser} | ${v.viewport} | ${v.queryCount} | ${passed} | ${failed} | ${skipped} | ${fmtMs(v.durationMs)} |`,
  );
}
lines.push('');
lines.push('## Lifecycle metrics');
lines.push('');
lines.push(
  '| Browser | Viewport | Browser Launches | Context Launches | Page Launches | Recovers |',
);
lines.push('| --- | --- | ---: | ---: | ---: | ---: |');
for (const v of viewports) {
  lines.push(
    `| ${v.browser} | ${v.viewport} | ${v.lifecycle.browserLaunches} | ${v.lifecycle.contextLaunches} | ${v.lifecycle.pageLaunches} | ${v.lifecycle.pageRecovers} |`,
  );
}
lines.push('');
lines.push('## Lifecycle metrics (aggregated)');
lines.push('');
lines.push('| Metric | Count |');
lines.push('| --- | ---: |');
lines.push(`| Browser launches | ${data.totals.browserLaunches} |`);
lines.push(`| Context launches | ${data.totals.contextLaunches} |`);
lines.push(`| Page launches | ${data.totals.pageLaunches} |`);
lines.push(`| Page recovers | ${data.totals.pageRecovers} |`);
lines.push(`| Page recoveries | ${data.totals.pageRecoveries ?? data.totals.pageRecovers} |`);
lines.push(`| Soft failures | ${data.totals.softFailures ?? 0} |`);
lines.push(`| Hard failures | ${data.totals.hardFailures ?? 0} |`);
lines.push(`| Home navigations | ${data.totals.homeNavigations ?? 0} |`);
lines.push(`| Reload recoveries | ${data.totals.reloadRecoveries ?? 0} |`);
lines.push(`| Passed | ${data.totals.passed} |`);
lines.push(`| Failed | ${data.totals.failed} |`);
lines.push(`| Skipped (deduped) | ${data.totals.skipped ?? 0} |`);
lines.push('');
lines.push('## Failures');
lines.push('');
if (!failures.length) {
  lines.push('_None_');
} else {
  lines.push(
    '| Query ID | Query | Browser | Viewport | Module | Error |',
  );
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const f of failures.slice(0, 200)) {
    const err = (f.error || '').replace(/\|/g, '\\|').slice(0, 160);
    const q = (f.query || '').replace(/\|/g, '\\|').slice(0, 40);
    lines.push(
      `| ${f.id} | ${q} | ${f.browser} | ${f.viewport} | ${f.module} | ${err} |`,
    );
  }
  if (failures.length > 200) {
    lines.push(`| … | ${failures.length - 200} more | | | | |`);
  }
}
lines.push('');
lines.push('## Reliability');
lines.push('');
lines.push(
  '- Soft ON-ENTER failures reset the search input on the current page; home/reload only when the page is unusable.',
);
lines.push(
  '- Normalized-query dedupe executes once per viewport/module; every original query ID is still reported.',
);
lines.push(
  '- Functional ON-TYPE keystroke specs are unchanged; analytics uses `fill()`.',
);
lines.push(
  '- Workers shard by browser/viewport project; queries within a viewport stay on one page.',
);
lines.push('');
lines.push('## Recommendation');
lines.push('');
lines.push(
  'See `reports/analytics-batch-runtime-comparison.md` for measured worker guidance.',
);
lines.push('');

fs.writeFileSync(outMd, `${lines.join('\n')}\n`);
console.log('Wrote', path.relative(root, outMd));
