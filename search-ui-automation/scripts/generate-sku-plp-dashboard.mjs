/**
 * Builds a standalone SKU → PLP cache dashboard from
 * reports/sku-plp/sku_search_results.json
 * Output: reports/sku-plp/dashboard.html
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.resolve(
  process.env.SKU_PLP_REPORT_DIR?.trim() ||
    path.join(root, 'reports', 'sku-plp', 'runs', latestRunId(root) || ''),
);
const jsonPath = path.join(reportDir, 'sku_search_results.json');
const outFile = path.join(reportDir, 'dashboard.html');

function latestRunId(projectRoot) {
  const runsDir = path.join(projectRoot, 'reports', 'sku-plp', 'runs');
  if (!fs.existsSync(runsDir)) return '';
  const dirs = fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs.at(-1) || '';
}

if (!fs.existsSync(jsonPath)) {
  console.error(
    'Missing sku_search_results.json — run npm run test:sku-plp first.',
    jsonPath,
  );
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const dataJson = JSON.stringify(report).replace(/</g, '\\u003c');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SKU → PLP Cache Validation</title>
  <style>
    :root {
      --bg: #f4f6f8;
      --surface: #ffffff;
      --ink: #15202b;
      --muted: #5b6b7c;
      --line: #d9e1e8;
      --pass: #1b7f4a;
      --pass-bg: #e7f6ee;
      --fail: #b42318;
      --fail-bg: #fdeceb;
      --stale: #9a3412;
      --stale-bg: #ffedd5;
      --accent: #0f4c81;
      --warn: #9a6700;
      --radius: 12px;
      --font: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font);
      color: var(--ink);
      background: var(--bg);
      line-height: 1.45;
    }
    .wrap { max-width: 1280px; margin: 0 auto; padding: 28px 20px 64px; }
    header.hero {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 24px 28px;
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 24px;
      align-items: center;
    }
    @media (max-width: 860px) {
      header.hero { grid-template-columns: 1fr; }
    }
    .eyebrow {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 0 0 8px;
      font-weight: 600;
    }
    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: -0.02em; }
    .subtitle { margin: 0; color: var(--muted); font-size: 14px; }
    .meta-line { margin: 10px 0 0; font-size: 13px; color: var(--muted); }
    .verdict {
      border-radius: 10px;
      padding: 18px 20px;
      border: 1px solid var(--line);
    }
    .verdict.ok { background: var(--pass-bg); border-color: #b7e4c7; }
    .verdict.bad { background: var(--stale-bg); border-color: #fdba74; }
    .verdict .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--muted); }
    .verdict .value { font-size: 26px; font-weight: 700; margin-top: 4px; }
    .verdict.ok .value { color: var(--pass); }
    .verdict.bad .value { color: var(--stale); }
    .verdict .detail { margin-top: 6px; font-size: 13px; color: var(--muted); }

    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 20px 0 28px;
    }
    @media (max-width: 980px) {
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .metric {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 14px 16px;
    }
    .metric .k { font-size: 12px; color: var(--muted); font-weight: 600; }
    .metric .v { font-size: 26px; font-weight: 700; margin-top: 4px; }
    .metric.pass .v { color: var(--pass); }
    .metric.fail .v { color: var(--fail); }
    .metric.stale .v { color: var(--stale); }

    .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 18px;
      margin-bottom: 16px;
    }
    .panel h2 { margin: 0 0 14px; font-size: 16px; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    @media (max-width: 900px) {
      .grid-2 { grid-template-columns: 1fr; }
    }

    .bar-row {
      display: grid;
      grid-template-columns: 160px 1fr 48px;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .track {
      height: 12px;
      background: #eef2f6;
      border-radius: 999px;
      overflow: hidden;
    }
    .seg { height: 100%; background: var(--fail); }
    .seg.stale { background: var(--stale); }
    .seg.sku { background: var(--fail); }
    .seg.url { background: #c2410c; }
    .seg.nav { background: #7c3aed; }
    .seg.timeout { background: var(--warn); }
    .seg.other { background: #64748b; }
    .bar-total { color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }

    .sequence {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 4px;
    }
    .seq-step {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 10px;
      min-width: 132px;
      background: #f8fafc;
      font-size: 12px;
    }
    .seq-step.pass { background: var(--pass-bg); border-color: #b7e4c7; }
    .seq-step.fail { background: var(--fail-bg); border-color: #f3b4ae; }
    .seq-step.stale { background: var(--stale-bg); border-color: #fdba74; }
    .seq-step .sku { font-weight: 700; font-size: 13px; }
    .seq-step .sub { color: var(--muted); margin-top: 2px; }
    .seq-arrow { color: var(--muted); font-weight: 700; padding: 0 2px; }

    .defect {
      background: var(--stale-bg);
      border: 1px solid #fdba74;
      border-radius: var(--radius);
      padding: 18px 20px;
      margin-bottom: 16px;
    }
    .defect h2 { margin: 0 0 8px; color: var(--stale); font-size: 16px; }
    .defect p { margin: 0 0 10px; }
    .defect pre {
      margin: 0;
      background: #fff;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 13px;
      overflow-x: auto;
    }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
    .filters input {
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 10px;
      font: inherit;
      min-width: 220px;
      flex: 1;
    }
    .chip {
      height: 36px;
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 0 12px;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      color: var(--ink);
    }
    .chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }

    .table-wrap { overflow: auto; max-height: 560px; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 1100px; }
    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      font-size: 12px;
    }
    th {
      background: #f7f9fb;
      position: sticky;
      top: 0;
      z-index: 1;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      font-size: 11px;
    }
    tbody tr:hover { background: #f8fafc; }
    .url { max-width: 220px; word-break: break-all; color: var(--muted); }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }
    .badge.pass { background: var(--pass-bg); color: var(--pass); }
    .badge.fail { background: var(--fail-bg); color: var(--fail); }
    .badge.stale { background: var(--stale-bg); color: var(--stale); }
    .dl {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 8px 16px;
      font-size: 13px;
    }
    .dl dt { color: var(--muted); font-weight: 600; }
    .empty { padding: 20px; color: var(--muted); text-align: center; }
    footer { margin-top: 12px; color: var(--muted); font-size: 12px; }
    .table-meta { font-size: 13px; color: var(--muted); margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div>
        <p class="eyebrow">QA test report</p>
        <h1>SKU → PLP Cache Validation</h1>
        <p class="subtitle" id="headerEnv">QA Environment</p>
        <p class="meta-line" id="headerMeta"></p>
      </div>
      <div class="verdict" id="verdict">
        <div class="label">Overall result</div>
        <div class="value" id="verdictValue"></div>
        <div class="detail" id="verdictDetail"></div>
      </div>
    </header>

    <section class="metrics" id="metrics"></section>

    <section class="defect" id="defect" hidden>
      <h2>Cache Issue Detected</h2>
      <p>The application returned a previously loaded product/PLP after searching for a different SKU in the same browser session.</p>
      <pre id="defectExample"></pre>
    </section>

    <div class="grid-2">
      <section class="panel">
        <h2>Failure breakdown</h2>
        <div id="failBars"></div>
      </section>
      <section class="panel">
        <h2>Stale PLP / Cache Defect Evidence</h2>
        <div id="staleEvidence"></div>
      </section>
    </div>

    <section class="panel">
      <h2>Search sequence (same browser session, no reload)</h2>
      <div class="sequence" id="sequence"></div>
    </section>

    <section class="panel">
      <h2>Detailed results</h2>
      <div class="filters">
        <input id="search" type="search" placeholder="Search SKU, URL, or failure type" />
        <button class="chip active" data-filter="ALL" type="button">ALL</button>
        <button class="chip" data-filter="PASS" type="button">PASS</button>
        <button class="chip" data-filter="FAIL" type="button">FAIL</button>
        <button class="chip" data-filter="STALE PLP" type="button">STALE PLP</button>
        <button class="chip" data-filter="URL MISMATCH" type="button">URL MISMATCH</button>
        <button class="chip" data-filter="SKU MISMATCH" type="button">SKU MISMATCH</button>
        <button class="chip" data-filter="ERROR" type="button">ERROR</button>
      </div>
      <div class="table-meta" id="tableMeta"></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Search SKU</th>
              <th>Previous Search SKU</th>
              <th>Expected URL</th>
              <th>Actual URL</th>
              <th>Expected PLP SKU</th>
              <th>Actual PLP SKU</th>
              <th>URL Validation</th>
              <th>PLP SKU Validation</th>
              <th>Result</th>
              <th>Failure Type</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Execution metadata</h2>
      <dl class="dl" id="metadata"></dl>
    </section>
    <footer>Standalone report generated from sku_search_results.json. No server required.</footer>
  </div>
  <script>
    const DATA = ${dataJson};

    function esc(s) {
      return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function na(v) {
      if (v == null || v === '') return 'N/A';
      return String(v);
    }

    function fmtMs(ms) {
      if (ms == null || Number.isNaN(Number(ms))) return 'N/A';
      const n = Number(ms);
      if (n < 1000) return n + 'ms';
      return (n / 1000).toFixed(1) + 's';
    }

    function fmtTime(iso) {
      if (!iso) return 'N/A';
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    }

    function pct(part, total) {
      if (!total) return '0%';
      return ((part / total) * 100).toFixed(1) + '%';
    }

    function isErrorRow(row) {
      const code = row.failureCode || '';
      return ['TIMEOUT', 'NAVIGATION_FAILED', 'SEARCH_FAILED', 'ELEMENT_NOT_FOUND', 'PLP_NOT_LOADED'].includes(code);
    }

    function primaryFailureCategory(row) {
      if (row.overall !== 'FAIL') return null;
      if (row.cacheBugSuspected) return 'Stale Previous PLP';
      if (row.failureCode === 'TIMEOUT') return 'Timeout';
      if (row.failureCode === 'NAVIGATION_FAILED') return 'Navigation Failure';
      if (row.urlValidation === 'FAIL') return 'URL Mismatch';
      if (row.skuMatch === 'FAIL') return 'SKU Mismatch';
      return 'Other';
    }

    function failureTypeLabel(row) {
      if (row.overall === 'PASS') return '';
      if (row.cacheBugSuspected) return 'STALE_PREVIOUS_PLP';
      return row.failureCode || 'FAIL';
    }

    function badge(ok) {
      const pass = ok === 'PASS' || ok === true;
      return '<span class="badge ' + (pass ? 'pass' : 'fail') + '">' + (pass ? 'PASS' : 'FAIL') + '</span>';
    }

    function init() {
      const s = DATA.summary || {};
      const results = DATA.results || [];
      const total = s.totalSkus || results.length || 0;
      const passed = s.passed || 0;
      const failed = s.failed || 0;
      const stale = s.cacheBugsSuspected || 0;
      const urlFail = s.urlMismatches || 0;
      const skuFail = s.skuMismatches || 0;
      const errors = results.filter(isErrorRow).length;
      const durations = results.map((r) => r.durationMs).filter((n) => typeof n === 'number');
      const avgMs = durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

      document.getElementById('headerEnv').textContent =
        (DATA.environment ? String(DATA.environment).toUpperCase() : 'QA') + ' Environment';
      document.getElementById('headerMeta').textContent =
        'Execution ' + fmtTime(DATA.startedAt || DATA.generatedAt) +
        ' · Environment: ' + na(DATA.environment || 'qa').toUpperCase() +
        ' · Total SKUs tested: ' + (s.uniqueSkus || DATA.uniqueSkus?.length || 'N/A') +
        ' unique / ' + total + ' sequential searches';

      const verdict = document.getElementById('verdict');
      if (stale > 0) {
        verdict.className = 'verdict bad';
        document.getElementById('verdictValue').textContent = 'CACHE ISSUE DETECTED';
        document.getElementById('verdictDetail').textContent =
          failed + ' failed of ' + total + ' · ' + stale + ' stale PLP detection' + (stale === 1 ? '' : 's');
      } else if (failed > 0) {
        verdict.className = 'verdict bad';
        document.getElementById('verdictValue').textContent = 'FAIL';
        document.getElementById('verdictDetail').textContent = failed + ' failed of ' + total;
      } else {
        verdict.className = 'verdict ok';
        document.getElementById('verdictValue').textContent = 'PASS';
        document.getElementById('verdictDetail').textContent = 'All sequential SKU searches matched the expected PLP';
      }

      document.getElementById('metrics').innerHTML = [
        ['TOTAL TESTS', total, ''],
        ['PASSED', passed, 'pass'],
        ['FAILED', failed, 'fail'],
        ['PASS RATE', pct(passed, total), passed === total ? 'pass' : ''],
        ['STALE PLP DETECTIONS', stale, 'stale'],
        ['URL MISMATCHES', urlFail, urlFail ? 'fail' : ''],
        ['SKU MISMATCHES', skuFail, skuFail ? 'fail' : ''],
        ['ERRORS', errors, errors ? 'fail' : '']
      ].map(([k, v, cls]) =>
        '<div class="metric ' + cls + '"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'
      ).join('');

      const staleRows = results.filter((r) => r.cacheBugSuspected);
      const defect = document.getElementById('defect');
      if (staleRows.length) {
        defect.hidden = false;
        const ex = staleRows[0];
        document.getElementById('defectExample').textContent =
          'Example:\\n\\n' +
          'Previous SKU: ' + na(ex.previousSku) + '\\n' +
          'Searched SKU: ' + na(ex.searchedSku) + '\\n' +
          'Actual PLP SKU: ' + na(ex.actualPlpSku) + '\\n\\n' +
          'This indicates that the newly searched SKU did not correctly replace the previous PLP state.';
      }

      const cats = {
        'Stale Previous PLP': 0,
        'SKU Mismatch': 0,
        'URL Mismatch': 0,
        'Navigation Failure': 0,
        'Timeout': 0,
        'Other': 0
      };
      results.forEach((row) => {
        const cat = primaryFailureCategory(row);
        if (cat && cats[cat] != null) cats[cat] += 1;
      });
      const maxCat = Math.max(1, ...Object.values(cats));
      const clsMap = {
        'Stale Previous PLP': 'stale',
        'SKU Mismatch': 'sku',
        'URL Mismatch': 'url',
        'Navigation Failure': 'nav',
        Timeout: 'timeout',
        Other: 'other'
      };
      document.getElementById('failBars').innerHTML = Object.keys(cats).map((name) =>
        '<div class="bar-row"><div>' + esc(name) + '</div>' +
        '<div class="track"><div class="seg ' + clsMap[name] + '" style="width:' + ((cats[name] / maxCat) * 100) + '%"></div></div>' +
        '<div class="bar-total">' + cats[name] + '</div></div>'
      ).join('');

      const evidence = document.getElementById('staleEvidence');
      if (!staleRows.length) {
        evidence.innerHTML = '<div class="empty">No stale previous-PLP failures in this run.</div>';
      } else {
        evidence.innerHTML =
          '<div class="table-wrap"><table><thead><tr><th>Previous SKU</th><th>Searched SKU</th><th>Actual PLP SKU</th><th>Status</th></tr></thead><tbody>' +
          staleRows.map((r) =>
            '<tr><td>' + esc(na(r.previousSku)) + '</td><td>' + esc(r.searchedSku) + '</td><td>' +
            esc(na(r.actualPlpSku)) + '</td><td><span class="badge stale">STALE</span></td></tr>'
          ).join('') +
          '</tbody></table></div>';
      }

      const seq = document.getElementById('sequence');
      seq.innerHTML = results.map((row, i) => {
        const cls = row.cacheBugSuspected ? 'stale' : row.overall === 'PASS' ? 'pass' : 'fail';
        const arrow = i < results.length - 1 ? '<span class="seq-arrow">↓</span>' : '';
        return (
          '<div class="seq-step ' + cls + '">' +
            '<div class="sku">' + esc(row.searchedSku) + '</div>' +
            '<div class="sub">prev ' + esc(na(row.previousSku)) + '</div>' +
            '<div class="sub">expected ' + esc(na(row.expectedPlpSku)) + '</div>' +
            '<div class="sub">actual ' + esc(na(row.actualPlpSku)) + '</div>' +
            '<div class="sub">' + esc(row.cacheBugSuspected ? 'STALE' : row.overall) + '</div>' +
          '</div>' + arrow
        );
      }).join('');

      document.getElementById('metadata').innerHTML = [
        ['Run ID', na(DATA.runId)],
        ['Environment', (DATA.environment || 'qa').toUpperCase()],
        ['Base URL', na(DATA.baseURL)],
        ['Execution timestamp', fmtTime(DATA.startedAt || DATA.generatedAt)],
        ['Finished', fmtTime(DATA.finishedAt)],
        ['Browser', na(DATA.browser)],
        ['Viewport', na(DATA.viewport)],
        ['Dataset', na(DATA.dataset)],
        ['Number of SKUs', na(s.uniqueSkus || DATA.uniqueSkus?.length)],
        ['Number of sequential searches', na(total)],
        ['Test command', na(DATA.command || 'ENV=qa npm run test:sku-plp')],
        ['Average duration', fmtMs(avgMs)],
        ['Wall-clock duration', fmtMs(DATA.durationMs)]
      ].map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('');

      let activeFilter = 'ALL';
      const searchInput = document.getElementById('search');

      function matchesFilter(row, filter) {
        if (filter === 'ALL') return true;
        if (filter === 'PASS') return row.overall === 'PASS';
        if (filter === 'FAIL') return row.overall === 'FAIL';
        if (filter === 'STALE PLP') return !!row.cacheBugSuspected;
        if (filter === 'URL MISMATCH') return row.urlValidation === 'FAIL';
        if (filter === 'SKU MISMATCH') return row.skuMatch === 'FAIL';
        if (filter === 'ERROR') return isErrorRow(row);
        return true;
      }

      function matchesSearch(row, q) {
        if (!q) return true;
        const hay = [
          row.searchedSku,
          row.previousSku,
          row.expectedPlpSku,
          row.actualPlpSku,
          row.expectedUrl,
          row.actualUrl,
          row.failureCode,
          failureTypeLabel(row)
        ].join(' ').toLowerCase();
        return hay.includes(q);
      }

      function renderTable() {
        const q = searchInput.value.trim().toLowerCase();
        const rows = results.filter((r) => matchesFilter(r, activeFilter) && matchesSearch(r, q));
        document.getElementById('tableMeta').textContent =
          'Showing ' + rows.length + ' of ' + results.length + ' searches';
        const tbody = document.getElementById('tbody');
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="12" class="empty">No rows match the current filter.</td></tr>';
          return;
        }
        tbody.innerHTML = rows.map((row) => {
          const ftype = failureTypeLabel(row);
          const resultBadge = row.cacheBugSuspected
            ? '<span class="badge stale">STALE</span>'
            : badge(row.overall);
          return '<tr>' +
            '<td class="mono">' + esc(row.index) + '</td>' +
            '<td>' + esc(row.searchedSku) + '</td>' +
            '<td>' + esc(na(row.previousSku)) + '</td>' +
            '<td class="url">' + esc(na(row.expectedUrl)) + '</td>' +
            '<td class="url">' + esc(na(row.actualUrl)) + '</td>' +
            '<td>' + esc(na(row.expectedPlpSku)) + '</td>' +
            '<td>' + esc(na(row.actualPlpSku)) + '</td>' +
            '<td>' + badge(row.urlValidation) + '</td>' +
            '<td>' + badge(row.skuMatch) + '</td>' +
            '<td>' + resultBadge + '</td>' +
            '<td>' + (ftype ? '<span class="badge stale">' + esc(ftype) + '</span>' : '—') + '</td>' +
            '<td class="mono">' + fmtMs(row.durationMs) + '</td>' +
            '</tr>';
        }).join('');
      }

      document.querySelectorAll('.chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.chip').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          activeFilter = btn.getAttribute('data-filter');
          renderTable();
        });
      });
      searchInput.addEventListener('input', renderTable);
      renderTable();
    }

    init();
  </script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
console.log('Wrote', path.relative(root, outFile));
writeRunsIndex();

function writeRunsIndex() {
  const runsDir = path.join(root, 'reports', 'sku-plp', 'runs');
  if (!fs.existsSync(runsDir)) return;
  const runs = fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse()
    .map((name) => {
      const jsonFile = path.join(runsDir, name, 'sku_search_results.json');
      let summary = {};
      let started = name;
      try {
        const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        summary = data.summary || {};
        started = data.startedAt || name;
      } catch {
        // ignore incomplete runs
      }
      return { name, summary, started };
    });

  const rows = runs
    .map((run) => {
      const s = run.summary || {};
      const href = `runs/${run.name}/dashboard.html`;
      return (
        `<tr>` +
        `<td><a href="${href}">${run.name}</a></td>` +
        `<td>${run.started}</td>` +
        `<td>${s.totalSkus ?? ''}</td>` +
        `<td>${s.passed ?? ''}</td>` +
        `<td>${s.failed ?? ''}</td>` +
        `<td>${s.cacheBugsSuspected ?? ''}</td>` +
        `</tr>`
      );
    })
    .join('\n');

  const index = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SKU → PLP report runs</title>
  <style>
    body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; margin: 32px; color: #15202b; background: #f4f6f8; }
    .panel { background: #fff; border: 1px solid #d9e1e8; border-radius: 12px; padding: 20px; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #d9e1e8; font-size: 14px; }
    th { color: #5b6b7c; font-size: 12px; text-transform: uppercase; }
    a { color: #0f4c81; }
  </style>
</head>
<body>
  <div class="panel">
    <h1>SKU → PLP cache report runs</h1>
    <p>Each run keeps its own dashboard. Previous reports are not replaced.</p>
    <table>
      <thead>
        <tr>
          <th>Run</th>
          <th>Started</th>
          <th>Searches</th>
          <th>Passed</th>
          <th>Failed</th>
          <th>Stale PLP</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
</body>
</html>
`;
  const indexPath = path.join(root, 'reports', 'sku-plp', 'index.html');
  fs.writeFileSync(indexPath, index);
  console.log('Wrote', path.relative(root, indexPath));
}

