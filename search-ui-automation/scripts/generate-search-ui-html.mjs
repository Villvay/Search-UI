/**
 * Builds an interactive Search UI dashboard from reports/search-ui-summary.json.
 * Output: reports/html/index.html
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const summaryPath = path.join(root, 'reports', 'search-ui-summary.json');
const outDir = path.join(root, 'reports', 'html');
const outFile = path.join(outDir, 'index.html');

if (!fs.existsSync(summaryPath)) {
  console.error('Missing reports/search-ui-summary.json — run test:summary first.');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const dataJson = JSON.stringify(summary).replace(/</g, '\\u003c');

const clientJs = `
const DATA = ${dataJson};

const MODULE_ORDER = ['FRAMEWORK', 'ON-TYPE', 'SUGGESTIONS', 'ON-ENTER', 'RELATED SEARCHES', 'ON-TYPE ANALYTICS', 'SUGGESTIONS ANALYTICS', 'ON-ENTER ANALYTICS'];
const VIEWPORT_ORDER = ['desktop-1440', 'desktop-1440-chrome', 'desktop-1440-firefox', 'desktop-1440-safari', 'desktop-1280', 'tablet-1024', 'tablet-768', 'mobile-390', 'mobile-375'];

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusLabel(status) {
  if (status === 'recovered') return 'RECOVERED';
  if (status === 'passed') return 'PASS';
  if (status === 'failed') return 'FAIL';
  if (status === 'skipped') return 'SKIPPED';
  return String(status || '').toUpperCase();
}

function noteFor(t) {
  if (t.status === 'failed') return t.error || '';
  if (t.status === 'skipped') return t.skipReason || 'Skipped';
  if (t.status === 'recovered') return 'Passed on retry' + (t.error ? '; earlier: ' + t.error : '');
  return '';
}

function fmtDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function renderBars(targetId, order, bucket) {
  const el = document.getElementById(targetId);
  el.innerHTML = order
    .filter((name) => bucket[name] && bucket[name].total > 0)
    .map((name) => {
      const b = bucket[name];
      const total = Math.max(b.total, 1);
      return (
        '<div class="bar-row">' +
          '<div class="name">' + esc(name) + '</div>' +
          '<div class="track" title="P ' + b.passed + ' / F ' + b.failed + ' / S ' + b.skipped + ' / R ' + b.recovered + '">' +
            '<div class="seg-pass" style="width:' + ((b.passed / total) * 100) + '%"></div>' +
            '<div class="seg-fail" style="width:' + ((b.failed / total) * 100) + '%"></div>' +
            '<div class="seg-skip" style="width:' + ((b.skipped / total) * 100) + '%"></div>' +
            '<div class="seg-recover" style="width:' + ((b.recovered / total) * 100) + '%"></div>' +
          '</div>' +
          '<div class="bar-total">' + b.total + '</div>' +
        '</div>'
      );
    })
    .join('');
}

function init() {
  const o = DATA.overall || {};
  const failed = o.failed || 0;
  const verdict = document.getElementById('verdict');
  const verdictValue = document.getElementById('verdictValue');
  const verdictDetail = document.getElementById('verdictDetail');

  if (failed > 0) {
    verdict.className = 'verdict bad';
    verdictValue.textContent = failed + ' failed';
    verdictDetail.textContent =
      'Pass rate ' + (o.passRate || '—') +
      ' · ' + (o.passed || 0) + ' passed · ' + (o.skipped || 0) + ' skipped';
  } else {
    verdict.className = 'verdict ok';
    verdictValue.textContent = 'All executed tests passed';
    verdictDetail.textContent =
      'Pass rate ' + (o.passRate || '—') +
      ' · ' + (o.skipped || 0) + ' skipped (expected for unavailable features)';
  }

  document.getElementById('generatedMeta').textContent =
    'Generated ' + (DATA.generatedAt || '—') + ' · Source ' + (DATA.source || '—');

  document.getElementById('metrics').innerHTML =
    '<div class="metric"><div class="k">Total</div><div class="v">' + (o.total || 0) + '</div></div>' +
    '<div class="metric pass"><div class="k">Passed</div><div class="v">' + (o.passed || 0) + '</div></div>' +
    '<div class="metric fail"><div class="k">Failed</div><div class="v">' + (o.failed || 0) + '</div></div>' +
    '<div class="metric skip"><div class="k">Skipped</div><div class="v">' + (o.skipped || 0) + '</div></div>' +
    '<div class="metric recover"><div class="k">Recovered</div><div class="v">' + (o.recovered || 0) + '</div></div>' +
    '<div class="metric"><div class="k">Pass rate</div><div class="v">' + esc(o.passRate || '—') + '</div></div>';

  renderBars('moduleBars', MODULE_ORDER, DATA.byModule || {});
  renderBars('viewportBars', VIEWPORT_ORDER, DATA.byViewport || {});

  const modules = [...new Set((DATA.tests || []).map((t) => t.module))].sort();
  const viewports = [...new Set((DATA.tests || []).map((t) => t.viewport))];
  viewports.sort((a, b) => VIEWPORT_ORDER.indexOf(a) - VIEWPORT_ORDER.indexOf(b));

  const moduleSelect = document.getElementById('module');
  modules.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    moduleSelect.appendChild(opt);
  });

  const viewportSelect = document.getElementById('viewport');
  viewports.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    viewportSelect.appendChild(opt);
  });

  ['q', 'module', 'viewport', 'status'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderTable);
    document.getElementById(id).addEventListener('change', renderTable);
  });
  document.getElementById('reset').addEventListener('click', () => {
    document.getElementById('q').value = '';
    document.getElementById('module').value = '';
    document.getElementById('viewport').value = '';
    document.getElementById('status').value = '';
    renderTable();
  });

  renderTable();
}

function renderTable() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  const module = document.getElementById('module').value;
  const viewport = document.getElementById('viewport').value;
  const status = document.getElementById('status').value;

  const rows = (DATA.tests || []).filter((t) => {
    if (module && t.module !== module) return false;
    if (viewport && t.viewport !== viewport) return false;
    if (status && t.status !== status) return false;
    if (!q) return true;
    const hay = [t.testId, t.title, t.module, t.viewport, t.error, t.skipReason]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  document.getElementById('showing').textContent =
    'Showing ' + rows.length + ' of ' + (DATA.tests || []).length + ' tests';

  const tbody = document.getElementById('tbody');
  const empty = document.getElementById('empty');
  if (!rows.length) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  tbody.innerHTML = rows
    .map((t) =>
      '<tr>' +
        '<td class="mono">' + esc(t.testId || '—') + '</td>' +
        '<td>' + esc(t.module) + '</td>' +
        '<td>' + esc(t.title) + '</td>' +
        '<td class="mono">' + esc(t.viewport) + '</td>' +
        '<td><span class="badge ' + esc(t.status) + '">' + statusLabel(t.status) + '</span></td>' +
        '<td class="mono">' + fmtDuration(t.durationMs) + '</td>' +
        '<td class="notes">' + esc(noteFor(t)) + '</td>' +
      '</tr>'
    )
    .join('');
}

init();
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Search UI Automation Dashboard</title>
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
      --skip: #9a6700;
      --skip-bg: #fff6de;
      --recover: #b54708;
      --recover-bg: #ffedd5;
      --accent: #0f4c81;
      --shadow: 0 1px 2px rgba(21, 32, 43, 0.06);
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
      box-shadow: var(--shadow);
      display: grid;
      grid-template-columns: 1.4fr 1fr;
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
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: -0.02em; }
    .subtitle { margin: 0; color: var(--muted); font-size: 14px; }
    .verdict {
      border-radius: 10px;
      padding: 18px 20px;
      border: 1px solid var(--line);
    }
    .verdict.ok { background: var(--pass-bg); border-color: #b7e4c7; }
    .verdict.bad { background: var(--fail-bg); border-color: #f3b4ae; }
    .verdict .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--muted); }
    .verdict .value { font-size: 30px; font-weight: 700; margin-top: 4px; }
    .verdict.ok .value { color: var(--pass); }
    .verdict.bad .value { color: var(--fail); }
    .verdict .detail { margin-top: 6px; font-size: 13px; color: var(--muted); }

    .metrics {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 12px;
      margin: 20px 0 28px;
    }
    @media (max-width: 980px) {
      .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 560px) {
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .metric {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 14px 16px;
      box-shadow: var(--shadow);
    }
    .metric .k { font-size: 12px; color: var(--muted); font-weight: 600; }
    .metric .v { font-size: 26px; font-weight: 700; margin-top: 4px; }
    .metric.pass .v { color: var(--pass); }
    .metric.fail .v { color: var(--fail); }
    .metric.skip .v { color: var(--skip); }
    .metric.recover .v { color: var(--recover); }

    .grid-2 {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    @media (max-width: 900px) {
      .grid-2 { grid-template-columns: 1fr; }
    }
    .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 18px 18px 12px;
      box-shadow: var(--shadow);
    }
    .panel h2 {
      margin: 0 0 14px;
      font-size: 16px;
      letter-spacing: -0.01em;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 150px 1fr 64px;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .bar-row .name { font-weight: 600; }
    .track {
      height: 12px;
      background: #eef2f6;
      border-radius: 999px;
      overflow: hidden;
      display: flex;
    }
    .seg-pass { background: var(--pass); }
    .seg-fail { background: var(--fail); }
    .seg-skip { background: #e0b000; }
    .seg-recover { background: var(--recover); }
    .bar-total { color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }

    .legend {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin: 8px 0 4px;
      font-size: 12px;
      color: var(--muted);
    }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .swatch {
      width: 10px; height: 10px; border-radius: 2px; display: inline-block;
    }

    .filters {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 14px 16px;
      box-shadow: var(--shadow);
      display: grid;
      grid-template-columns: 1.4fr repeat(3, 1fr) auto;
      gap: 10px;
      align-items: end;
      margin-bottom: 14px;
    }
    @media (max-width: 900px) {
      .filters { grid-template-columns: 1fr 1fr; }
    }
    label { display: block; font-size: 12px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
    input, select, button {
      width: 100%;
      height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 10px;
      font: inherit;
      background: #fff;
      color: var(--ink);
    }
    button {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
      font-weight: 600;
      cursor: pointer;
    }
    button.secondary {
      background: #fff;
      color: var(--ink);
      border-color: var(--line);
    }

    .table-wrap {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .table-meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
      font-size: 13px;
      color: var(--muted);
    }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      font-size: 13px;
    }
    th {
      background: #f7f9fb;
      position: sticky;
      top: 0;
      z-index: 1;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }
    tbody tr:hover { background: #f8fafc; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .badge.pass { background: var(--pass-bg); color: var(--pass); }
    .badge.fail { background: var(--fail-bg); color: var(--fail); }
    .badge.skip { background: var(--skip-bg); color: var(--skip); }
    .badge.recovered { background: var(--recover-bg); color: var(--recover); }
    .mono { font-variant-numeric: tabular-nums; }
    .notes { color: var(--muted); max-width: 360px; }
    .empty {
      padding: 28px;
      text-align: center;
      color: var(--muted);
    }
    footer {
      margin-top: 18px;
      color: var(--muted);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div>
        <p class="eyebrow">Search UI Automation</p>
        <h1>Test Results Dashboard</h1>
        <p class="subtitle" id="generatedMeta"></p>
      </div>
      <div id="verdict" class="verdict ok">
        <div class="label">Overall verdict</div>
        <div class="value" id="verdictValue">—</div>
        <div class="detail" id="verdictDetail"></div>
      </div>
    </header>

    <section class="metrics" id="metrics"></section>

    <section class="grid-2">
      <div class="panel">
        <h2>Results by module</h2>
        <div class="legend">
          <span><i class="swatch" style="background:var(--pass)"></i>Passed</span>
          <span><i class="swatch" style="background:var(--fail)"></i>Failed</span>
          <span><i class="swatch" style="background:#e0b000"></i>Skipped</span>
          <span><i class="swatch" style="background:var(--recover)"></i>Recovered</span>
        </div>
        <div id="moduleBars"></div>
      </div>
      <div class="panel">
        <h2>Results by viewport</h2>
        <div class="legend">
          <span><i class="swatch" style="background:var(--pass)"></i>Passed</span>
          <span><i class="swatch" style="background:var(--fail)"></i>Failed</span>
          <span><i class="swatch" style="background:#e0b000"></i>Skipped</span>
          <span><i class="swatch" style="background:var(--recover)"></i>Recovered</span>
        </div>
        <div id="viewportBars"></div>
      </div>
    </section>

    <section class="filters">
      <div>
        <label for="q">Search</label>
        <input id="q" type="search" placeholder="Test ID, name, error…" />
      </div>
      <div>
        <label for="module">Module</label>
        <select id="module"><option value="">All modules</option></select>
      </div>
      <div>
        <label for="viewport">Viewport</label>
        <select id="viewport"><option value="">All viewports</option></select>
      </div>
      <div>
        <label for="status">Status</label>
        <select id="status">
          <option value="">All statuses</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
          <option value="recovered">Recovered</option>
        </select>
      </div>
      <div>
        <label>&nbsp;</label>
        <button type="button" class="secondary" id="reset">Reset</button>
      </div>
    </section>

    <section class="table-wrap">
      <div class="table-meta">
        <div id="showing">Showing 0 tests</div>
        <div>Tip: filter to Failed or Skipped to review exceptions quickly</div>
      </div>
      <div style="max-height: 620px; overflow: auto;">
        <table>
          <thead>
            <tr>
              <th>Test ID</th>
              <th>Module</th>
              <th>Test</th>
              <th>Viewport</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
        <div class="empty" id="empty" hidden>No tests match the current filters.</div>
      </div>
    </section>

    <footer>
      Generated from Playwright JSON results. Full-suite archive:
      <code>reports/search-ui-playwright-results.json</code>
    </footer>
  </div>
  <script>
${clientJs}
  </script>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });

const runsDir = path.join(outDir, 'runs');
fs.mkdirSync(runsDir, { recursive: true });

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .replace('T', '_')
  .replace(/Z$/, '');
const versionDir = path.join(runsDir, stamp);
fs.mkdirSync(versionDir, { recursive: true });

const versionFile = path.join(versionDir, 'index.html');
fs.writeFileSync(versionFile, html);
fs.writeFileSync(outFile, html);

// Preserve summary snapshot with this version (do not overwrite older run folders).
const summarySnap = path.join(versionDir, 'search-ui-summary.json');
fs.copyFileSync(summaryPath, summarySnap);

const meta = {
  id: stamp,
  generatedAt: summary.generatedAt || new Date().toISOString(),
  path: `runs/${stamp}/index.html`,
  source: summary.source || null,
  overall: summary.overall || null,
  analyticsCoverage: summary.analyticsCoverage || null,
};
fs.writeFileSync(path.join(versionDir, 'meta.json'), JSON.stringify(meta, null, 2));

// Catalog of all versioned dashboards (never delete entries for missing folders).
const catalogPath = path.join(runsDir, 'catalog.json');
let catalog = [];
if (fs.existsSync(catalogPath)) {
  try {
    catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    if (!Array.isArray(catalog)) catalog = [];
  } catch {
    catalog = [];
  }
}
catalog = catalog.filter((entry) => entry && entry.id !== stamp);
catalog.unshift(meta);
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

const catalogHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Search UI Dashboard Versions</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; background: #0f1419; color: #e7ecf3; }
    a { color: #7dd3fc; }
    table { border-collapse: collapse; width: 100%; max-width: 960px; }
    th, td { text-align: left; padding: 0.6rem 0.75rem; border-bottom: 1px solid #243041; }
    th { color: #9fb0c3; font-size: 0.85rem; }
    .muted { color: #9fb0c3; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Dashboard versions</h1>
  <p class="muted">Previous runs are preserved under <code>reports/html/runs/</code>. Latest also at <a href="../index.html">../index.html</a>.</p>
  <table>
    <thead><tr><th>Run ID</th><th>Generated</th><th>Pass rate</th><th>Total</th><th>Failed</th></tr></thead>
    <tbody>
${catalog
  .map((e) => {
    const o = e.overall || {};
    return `<tr>
      <td><a href="./${e.id}/index.html">${e.id}</a></td>
      <td>${e.generatedAt || ''}</td>
      <td>${o.passRate ?? '—'}</td>
      <td>${o.total ?? '—'}</td>
      <td>${o.failed ?? '—'}</td>
    </tr>`;
  })
  .join('\n')}
    </tbody>
  </table>
</body>
</html>
`;
fs.writeFileSync(path.join(runsDir, 'index.html'), catalogHtml);

console.log(`Wrote ${path.relative(root, outFile)} (latest)`);
console.log(`Archived ${path.relative(root, versionFile)}`);
console.log(`Version catalog: ${path.relative(root, catalogPath)} (${catalog.length} runs)`);
