/**
 * Builds an interactive Search UI dashboard from summary/cycle JSON.
 * Output: reports/html/index.html (override with --summary / --out for cycles)
 *
 *   node scripts/generate-search-ui-html.mjs
 *   node scripts/generate-search-ui-html.mjs --summary=reports/search-ui-smoke-report.json --out=reports/html/search-ui-smoke-dashboard.html
 *
 * Optional CI enrichment (never required):
 *   GITHUB_SHA, GITHUB_REF_NAME, GITHUB_RUN_ID, GITHUB_RUN_NUMBER, GITHUB_REPOSITORY, GITHUB_SERVER_URL
 *   SMOKE_ARTIFACT_NAME, SMOKE_DASHBOARD_URL (workflow may set after artifact upload)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseHtmlArgs(argv) {
  let summaryRel = 'reports/search-ui-summary.json';
  let outRel = 'reports/html/index.html';
  for (const arg of argv) {
    if (arg.startsWith('--summary=')) summaryRel = arg.slice('--summary='.length);
    else if (arg.startsWith('--out=')) outRel = arg.slice('--out='.length);
  }
  return {
    summaryPath: path.resolve(root, summaryRel),
    outFile: path.resolve(root, outRel),
  };
}

function mergeOptionalCi(summary) {
  const cycle = summary.cycle || null;
  if (!cycle) return summary;
  const existing = cycle.ci || {};
  const sha = process.env.GITHUB_SHA || existing.sha || '';
  const runId = process.env.GITHUB_RUN_ID || existing.runId || '';
  const runNumber = process.env.GITHUB_RUN_NUMBER || existing.runNumber || '';
  const repository = process.env.GITHUB_REPOSITORY || existing.repository || '';
  const serverUrl = (
    process.env.GITHUB_SERVER_URL ||
    existing.serverUrl ||
    'https://github.com'
  ).replace(/\/$/, '');
  const branch =
    process.env.GITHUB_REF_NAME ||
    process.env.GITHUB_HEAD_REF ||
    existing.branch ||
    '';
  const hasAny = Boolean(sha || runId || branch || repository || process.env.SMOKE_DASHBOARD_URL);
  if (!hasAny && !cycle.ci) return summary;
  cycle.ci = {
    ...existing,
    branch: branch || existing.branch || null,
    sha: sha || existing.sha || null,
    shortSha: (sha || existing.sha || '').slice(0, 7) || existing.shortSha || null,
    runId: runId || existing.runId || null,
    runNumber: runNumber || existing.runNumber || null,
    repository: repository || existing.repository || null,
    serverUrl,
    runUrl:
      (repository || existing.repository) && (runId || existing.runId)
        ? `${serverUrl}/${repository || existing.repository}/actions/runs/${runId || existing.runId}`
        : existing.runUrl || null,
    artifactName: process.env.SMOKE_ARTIFACT_NAME || existing.artifactName || null,
    dashboardUrl: process.env.SMOKE_DASHBOARD_URL || existing.dashboardUrl || null,
  };
  return summary;
}

const { summaryPath, outFile } = parseHtmlArgs(process.argv.slice(2));
const outDir = path.dirname(outFile);

if (!fs.existsSync(summaryPath)) {
  console.error(
    `Missing ${path.relative(root, summaryPath)} — run test:summary or a test cycle first.`,
  );
  process.exit(1);
}

const summary = mergeOptionalCi(JSON.parse(fs.readFileSync(summaryPath, 'utf8')));
const dataJson = JSON.stringify(summary).replace(/</g, '\\u003c');

const clientJs = `
const DATA = ${dataJson};

const MODULE_ORDER = ['FRAMEWORK', 'ON-TYPE', 'SUGGESTIONS', 'TRENDING NOW', 'RECENT SEARCHES', 'RUNTIME ERRORS', 'CACHE & STATE', 'SEARCH INPUT ROBUSTNESS', 'ON-ENTER', 'RELATED SEARCHES', 'FILTERS & FACETS', 'SORTING', 'ON-TYPE ANALYTICS', 'SUGGESTIONS ANALYTICS', 'ON-ENTER ANALYTICS'];
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
  if (status === 'KNOWN DEFECT' || status === 'known-defect') return 'KNOWN DEFECT';
  return String(status || '').toUpperCase();
}

function displayStatus(t) {
  return t.cycleStatus || statusLabel(t.status);
}

function noteFor(t) {
  if (t.cycleStatus === 'KNOWN DEFECT') {
    return t.knownDefectReason || t.error || 'Documented known defect';
  }
  if (t.status === 'failed') return t.error || t.errorMessage || '';
  if (t.status === 'skipped') return t.skipReason || 'Skipped';
  if (t.status === 'recovered') return 'Passed on retry' + (t.error ? '; earlier: ' + t.error : '');
  return '';
}

function fmtDuration(ms) {
  if (ms == null || ms === '') return '—';
  const n = Number(ms);
  if (!Number.isFinite(n)) return '—';
  if (n < 1000) return Math.round(n) + 'ms';
  if (n < 60000) return (n / 1000).toFixed(1) + 's';
  const m = Math.floor(n / 60000);
  const s = Math.round((n % 60000) / 1000);
  return m + 'm ' + s + 's';
}

function passRate(passed, total) {
  if (!total) return '—';
  return ((passed / total) * 100).toFixed(1) + '%';
}

function cycleResultLabel(cycle) {
  if (!cycle) return '—';
  if (cycle.result === 'FAILED' || cycle.result === 'FAIL') return 'FAIL';
  if (cycle.result === 'PASS (KNOWN DEFECTS)') return 'PASS (KNOWN DEFECTS)';
  return cycle.result || 'PASS';
}

function artifactLinks(t) {
  const links = [];
  const candidates = [
    ['screenshot', t.screenshot || t.screenshotPath],
    ['trace', t.trace || t.tracePath],
    ['video', t.video || t.videoPath],
    ['result', t.resultPath || t.attachmentsPath],
  ];
  for (const [label, href] of candidates) {
    if (href && typeof href === 'string' && !/secret|token|password|cookie/i.test(href)) {
      links.push('<a href="' + esc(href) + '">' + esc(label) + '</a>');
    }
  }
  return links.length ? links.join(' · ') : '—';
}

function renderBars(targetId, order, bucket) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const names = order.filter((name) => bucket[name] && bucket[name].total > 0);
  if (!names.length) {
    el.innerHTML = '<p class="muted">No data.</p>';
    return;
  }
  el.innerHTML = names
    .map((name) => {
      const b = bucket[name];
      const total = Math.max(b.total, 1);
      return (
        '<div class="bar-row">' +
          '<div class="name">' + esc(name) + '</div>' +
          '<div class="track" title="P ' + b.passed + ' / F ' + b.failed + ' / S ' + b.skipped + ' / R ' + (b.recovered || 0) + '">' +
            '<div class="seg-pass" style="width:' + ((b.passed / total) * 100) + '%"></div>' +
            '<div class="seg-fail" style="width:' + ((b.failed / total) * 100) + '%"></div>' +
            '<div class="seg-skip" style="width:' + ((b.skipped / total) * 100) + '%"></div>' +
            '<div class="seg-recover" style="width:' + (((b.recovered || 0) / total) * 100) + '%"></div>' +
          '</div>' +
          '<div class="bar-total">' + b.total + '</div>' +
        '</div>'
      );
    })
    .join('');
}

function renderModuleTable() {
  const el = document.getElementById('moduleTableBody');
  if (!el) return;
  const cycle = DATA.cycle;
  const by = DATA.byModuleCycle || {};
  const order = (cycle && cycle.moduleResults && cycle.moduleResults.length)
    ? cycle.moduleResults.map((m) => m.reportModule)
    : MODULE_ORDER;
  const seen = new Set();
  const rows = [];
  for (const name of order) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const b = by[name];
    if (!b || !b.total) continue;
    const status = b.cycleResult || (b.failed > 0 ? 'FAIL' : b.knownDefects > 0 ? 'KNOWN DEFECT' : 'PASS');
    const statusClass = status === 'FAIL' ? 'fail' : status.includes('KNOWN') ? 'known' : 'pass';
    rows.push(
      '<tr>' +
        '<td>' + esc(name) + '</td>' +
        '<td class="mono">' + b.total + '</td>' +
        '<td class="mono">' + b.passed + '</td>' +
        '<td class="mono">' + b.failed + '</td>' +
        '<td class="mono">' + b.skipped + '</td>' +
        '<td class="mono">' + (b.knownDefects || 0) + '</td>' +
        '<td><span class="badge ' + statusClass + '">' + esc(status === 'KNOWN DEFECT' ? 'PASS*' : status) + '</span></td>' +
      '</tr>'
    );
  }
  // Include any remaining modules present in byModuleCycle
  for (const name of Object.keys(by)) {
    if (seen.has(name) || !by[name].total) continue;
    const b = by[name];
    const status = b.cycleResult || 'PASS';
    rows.push(
      '<tr>' +
        '<td>' + esc(name) + '</td>' +
        '<td class="mono">' + b.total + '</td>' +
        '<td class="mono">' + b.passed + '</td>' +
        '<td class="mono">' + b.failed + '</td>' +
        '<td class="mono">' + b.skipped + '</td>' +
        '<td class="mono">' + (b.knownDefects || 0) + '</td>' +
        '<td><span class="badge">' + esc(status) + '</span></td>' +
      '</tr>'
    );
  }
  el.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="7" class="muted">No module results.</td></tr>';
}

function renderFailures() {
  const el = document.getElementById('failuresBody');
  if (!el) return;
  const fails = (DATA.tests || []).filter(
    (t) => t.status === 'failed' && t.cycleStatus !== 'KNOWN DEFECT',
  );
  if (!fails.length) {
    el.innerHTML = '<p class="ok-text">No unexpected failures detected.</p>';
    return;
  }
  el.innerHTML = fails
    .map((t) =>
      '<article class="failure-card">' +
        '<div class="failure-head">' +
          '<strong class="mono">' + esc(t.testId || '—') + '</strong>' +
          '<span class="badge fail">FAIL</span>' +
        '</div>' +
        '<div class="failure-title">' + esc(t.scenario || t.title || '—') + '</div>' +
        '<dl class="kv">' +
          '<div><dt>Module</dt><dd>' + esc(t.module || '—') + '</dd></div>' +
          '<div><dt>Browser / project</dt><dd>' + esc(t.browser || DATA.cycle?.browser || 'Chromium') + ' / ' + esc(t.viewport || '—') + '</dd></div>' +
          '<div><dt>Duration</dt><dd>' + esc(fmtDuration(t.durationMs)) + '</dd></div>' +
          '<div><dt>URL</dt><dd class="mono break-word">' + esc(t.url || t.errorUrl || '—') + '</dd></div>' +
          '<div><dt>Error</dt><dd class="break-word">' + esc(t.error || t.errorMessage || '—') + '</dd></div>' +
          '<div><dt>Artifacts</dt><dd>' + artifactLinks(t) + '</dd></div>' +
        '</dl>' +
      '</article>'
    )
    .join('');
}

function renderKnownDefects() {
  const el = document.getElementById('knownDefectsBody');
  if (!el) return;
  const catalog = (DATA.cycle && DATA.cycle.knownDefectsCatalog) || [];
  const knownTests = (DATA.tests || []).filter((t) => t.cycleStatus === 'KNOWN DEFECT' || t.knownDefect);
  if (!catalog.length && !knownTests.length) {
    el.innerHTML =
      '<p class="muted">No known defects in this run.</p>' +
      '<p class="muted small">Known defects are documented product issues. They do not fail the smoke gate by themselves.</p>';
    return;
  }
  const cards = [];
  const byId = new Map(knownTests.map((t) => [t.testId, t]));
  for (const d of catalog) {
    const t = byId.get(d.testId);
    cards.push(
      '<article class="known-card">' +
        '<div class="failure-head">' +
          '<strong class="mono">' + esc(d.testId) + '</strong>' +
          '<span class="badge known">KNOWN DEFECT</span>' +
        '</div>' +
        '<p>' + esc(d.reason || 'Documented known defect') + '</p>' +
        '<dl class="kv">' +
          '<div><dt>Module</dt><dd>' + esc(d.reportModule || t?.module || '—') + '</dd></div>' +
          '<div><dt>Status</dt><dd>KNOWN DEFECT</dd></div>' +
          '<div><dt>Impact</dt><dd>Informational — does not fail smoke/regression gate alone</dd></div>' +
          (t ? '<div><dt>Observed this run</dt><dd>Yes (' + esc(t.viewport || '—') + ')</dd></div>' : '<div><dt>Observed this run</dt><dd>Not in this selection</dd></div>') +
        '</dl>' +
      '</article>'
    );
  }
  for (const t of knownTests) {
    if (catalog.some((d) => d.testId === t.testId)) continue;
    cards.push(
      '<article class="known-card">' +
        '<div class="failure-head"><strong class="mono">' + esc(t.testId) + '</strong><span class="badge known">KNOWN DEFECT</span></div>' +
        '<p>' + esc(t.knownDefectReason || t.error || 'Known defect') + '</p>' +
      '</article>'
    );
  }
  el.innerHTML =
    cards.join('') +
    '<p class="muted small">Known defects do not fail the smoke gate by themselves. Unexpected failures still fail the cycle.</p>';
}

function renderResponsive() {
  const el = document.getElementById('responsiveBody');
  if (!el) return;
  const cycle = DATA.cycle;
  if (!cycle) {
    el.innerHTML = '<p class="muted">Responsive: Not Run</p>';
    return;
  }
  if (!cycle.responsive) {
    el.innerHTML =
      '<p><strong>Responsive:</strong> Not Run</p>' +
      '<p class="muted small">Default daily smoke uses desktop-1440 only. Use test:smoke:responsive or workflow input run_responsive=true for six viewports.</p>';
    return;
  }
  const byVp = DATA.byViewport || {};
  const projects = cycle.projects || Object.keys(byVp);
  el.innerHTML =
    '<p><strong>Responsive:</strong> Executed</p>' +
    '<table class="compact"><thead><tr><th>Viewport</th><th>Total</th><th>Passed</th><th>Failed</th><th>Skipped</th></tr></thead><tbody>' +
    projects
      .map((vp) => {
        const b = byVp[vp] || { total: 0, passed: 0, failed: 0, skipped: 0 };
        return (
          '<tr><td class="mono">' +
          esc(vp) +
          '</td><td class="mono">' +
          b.total +
          '</td><td class="mono">' +
          b.passed +
          '</td><td class="mono">' +
          b.failed +
          '</td><td class="mono">' +
          b.skipped +
          '</td></tr>'
        );
      })
      .join('') +
    '</tbody></table>';
}

function renderRecentRuns() {
  const el = document.getElementById('recentRunsBody');
  if (!el) return;
  const recent = DATA.recentRuns;
  if (!Array.isArray(recent) || !recent.length) {
    el.innerHTML =
      '<p class="muted">No historical cycle snapshots available yet. Local archives under reports/html/runs/ can power this section later without changing report structure.</p>';
    return;
  }
  el.innerHTML =
    '<table class="compact"><thead><tr><th>Date</th><th>Env</th><th>Result</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Known</th><th>Duration</th></tr></thead><tbody>' +
    recent
      .slice(0, 10)
      .map((r) => {
        const c = r.cycle || {};
        const counts = c.counts || r.overall || {};
        return (
          '<tr>' +
          '<td class="mono">' +
          esc(c.startedAt || r.generatedAt || r.id || '—') +
          '</td>' +
          '<td>' +
          esc(c.environment || '—') +
          '</td>' +
          '<td><span class="badge">' +
          esc(cycleResultLabel(c) || '—') +
          '</span></td>' +
          '<td class="mono">' +
          (counts.passed ?? '—') +
          '</td>' +
          '<td class="mono">' +
          (counts.failed ?? '—') +
          '</td>' +
          '<td class="mono">' +
          (counts.skipped ?? '—') +
          '</td>' +
          '<td class="mono">' +
          (counts.knownDefects ?? '—') +
          '</td>' +
          '<td class="mono">' +
          esc(fmtDuration(c.wallClockMs)) +
          '</td>' +
          '</tr>'
        );
      })
      .join('') +
    '</tbody></table>';
}

function init() {
  const o = DATA.overall || {};
  const cycle = DATA.cycle || null;
  const unexpectedFailed = cycle ? (cycle.counts?.failed || 0) : (o.failed || 0);
  const knownDefects = cycle ? (cycle.counts?.knownDefects || 0) : 0;
  const passed = cycle?.counts?.passed ?? o.passed ?? 0;
  const skipped = cycle?.counts?.skipped ?? o.skipped ?? 0;
  const total = cycle?.counts?.total ?? o.total ?? 0;
  const rate = cycle ? passRate(passed, total) : (o.passRate || '—');

  const titleEl = document.getElementById('dashTitle');
  if (titleEl) {
    if (cycle?.id === 'smoke') titleEl.textContent = 'Search UI Smoke Test Dashboard';
    else if (cycle?.id === 'regression') titleEl.textContent = 'Search UI Regression Dashboard';
    else titleEl.textContent = 'Search UI Test Results Dashboard';
  }

  const verdict = document.getElementById('verdict');
  const verdictValue = document.getElementById('verdictValue');
  const verdictDetail = document.getElementById('verdictDetail');
  const resultLabel = cycleResultLabel(cycle);

  if (unexpectedFailed > 0) {
    verdict.className = 'verdict bad';
    verdictValue.textContent = 'FAIL';
    verdictDetail.textContent =
      unexpectedFailed + ' unexpected failure(s) · Pass rate ' + rate;
  } else if (knownDefects > 0) {
    verdict.className = 'verdict warn';
    verdictValue.textContent = 'PASS (KNOWN DEFECTS)';
    verdictDetail.textContent =
      knownDefects + ' known defect(s) · does not fail gate alone · Pass rate ' + rate;
  } else {
    verdict.className = 'verdict ok';
    verdictValue.textContent = resultLabel === '—' ? 'PASS' : resultLabel;
    verdictDetail.textContent = 'Pass rate ' + rate + ' · ' + skipped + ' skipped';
  }

  const headerMeta = document.getElementById('headerMeta');
  if (headerMeta) {
    const ci = cycle?.ci || {};
    const bits = [
      ['Environment', cycle?.environment || '—'],
      ['Overall result', resultLabel],
      ['Execution', cycle?.startedAt || DATA.generatedAt || '—'],
      ['Duration', fmtDuration(cycle?.wallClockMs)],
      ['Browser', cycle?.browser || 'Chromium'],
      ['Project(s)', (cycle?.projects || []).join(', ') || '—'],
      ['Viewport', cycle?.responsive ? (cycle?.projects || []).join(', ') : ((cycle?.projects || [])[0] || 'desktop-1440')],
      ['Git branch', ci.branch || '—'],
      ['Commit', ci.shortSha || ci.sha || '—'],
      ['Actions run #', ci.runNumber || '—'],
    ];
    headerMeta.innerHTML = bits
      .map(
        ([k, v]) =>
          '<div><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>',
      )
      .join('');
  }

  document.getElementById('generatedMeta').textContent =
    'Generated ' + (DATA.generatedAt || '—') + ' · Source ' + (DATA.source || '—');

  document.getElementById('metrics').innerHTML =
    '<div class="metric"><div class="k">Total Tests</div><div class="v">' + total + '</div></div>' +
    '<div class="metric pass"><div class="k">Passed</div><div class="v">' + passed + '</div></div>' +
    '<div class="metric fail"><div class="k">Failed</div><div class="v">' + unexpectedFailed + '</div></div>' +
    '<div class="metric skip"><div class="k">Skipped</div><div class="v">' + skipped + '</div></div>' +
    '<div class="metric known"><div class="k">Known Defects</div><div class="v">' + knownDefects + '</div></div>' +
    '<div class="metric fail"><div class="k">Unexpected Failures</div><div class="v">' + unexpectedFailed + '</div></div>' +
    '<div class="metric"><div class="k">Pass Rate</div><div class="v">' + esc(rate) + '</div></div>' +
    '<div class="metric"><div class="k">Duration</div><div class="v">' + esc(fmtDuration(cycle?.wallClockMs)) + '</div></div>';

  renderModuleTable();
  renderBars('moduleBars', MODULE_ORDER, DATA.byModule || {});
  renderBars('viewportBars', VIEWPORT_ORDER, DATA.byViewport || {});
  renderFailures();
  renderKnownDefects();
  renderResponsive();
  renderRecentRuns();

  const modules = [...new Set((DATA.tests || []).map((t) => t.module))].filter(Boolean).sort();
  const viewports = [...new Set((DATA.tests || []).map((t) => t.viewport))].filter(Boolean);
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
    if (status) {
      const ds = displayStatus(t);
      if (status === 'known-defect') {
        if (ds !== 'KNOWN DEFECT') return false;
      } else if (t.status !== status && ds !== statusLabel(status) && ds !== status) {
        return false;
      }
    }
    if (!q) return true;
    const hay = [t.testId, t.title, t.module, t.viewport, t.error, t.skipReason, t.cycleStatus, t.browser]
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
        '<td>' + esc(t.scenario || t.title || '—') + '</td>' +
        '<td>' + esc(t.module) + '</td>' +
        '<td><span class="badge ' + esc(t.cycleStatus === 'KNOWN DEFECT' ? 'known' : t.status) + '">' + esc(displayStatus(t)) + '</span></td>' +
        '<td class="mono">' + fmtDuration(t.durationMs) + '</td>' +
        '<td class="mono">' + esc(t.browser || DATA.cycle?.browser || 'Chromium') + '</td>' +
        '<td class="mono">' + esc(t.viewport) + '</td>' +
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
      grid-template-columns: 1.3fr 0.9fr;
      gap: 24px;
      align-items: start;
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
    h2 { margin: 0 0 12px; font-size: 16px; letter-spacing: -0.01em; }
    .subtitle { margin: 0; color: var(--muted); font-size: 14px; }
    .header-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 16px;
      margin-top: 14px;
    }
    .header-meta .k {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      font-weight: 600;
    }
    .header-meta .v { font-weight: 600; word-break: break-word; }
    .verdict {
      border-radius: 10px;
      padding: 18px 20px;
      border: 1px solid var(--line);
    }
    .verdict.ok { background: var(--pass-bg); border-color: #b7e4c7; }
    .verdict.bad { background: var(--fail-bg); border-color: #f3b4ae; }
    .verdict.warn { background: var(--skip-bg); border-color: #f0d48a; }
    .verdict .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--muted); }
    .verdict .value { font-size: 26px; font-weight: 700; margin-top: 4px; }
    .verdict.ok .value { color: var(--pass); }
    .verdict.bad .value { color: var(--fail); }
    .verdict.warn .value { color: var(--skip); }
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
      box-shadow: var(--shadow);
    }
    .metric .k { font-size: 12px; color: var(--muted); font-weight: 600; }
    .metric .v { font-size: 24px; font-weight: 700; margin-top: 4px; }
    .metric.pass .v { color: var(--pass); }
    .metric.fail .v { color: var(--fail); }
    .metric.skip .v { color: var(--skip); }
    .metric.known .v { color: #3730a3; }

    .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 18px;
      box-shadow: var(--shadow);
      margin-bottom: 16px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 16px;
      margin-bottom: 4px;
    }
    @media (max-width: 900px) {
      .grid-2 { grid-template-columns: 1fr; }
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
    .swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }

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
    button.secondary {
      background: #fff;
      color: var(--ink);
      border-color: var(--line);
      font-weight: 600;
      cursor: pointer;
    }
    .table-wrap {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-bottom: 16px;
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
    table.compact th, table.compact td { padding: 8px 10px; }
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
    .badge.known { background: #eef2ff; color: #3730a3; }
    .mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    .notes { color: var(--muted); max-width: 320px; }
    .muted { color: var(--muted); }
    .small { font-size: 12px; }
    .ok-text { color: var(--pass); font-weight: 600; }
    .empty { padding: 28px; text-align: center; color: var(--muted); }
    .failure-card, .known-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 10px;
      background: #fcfdff;
    }
    .failure-card { border-left: 4px solid var(--fail); }
    .known-card { border-left: 4px solid #6366f1; }
    .failure-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 6px; }
    .failure-title { font-weight: 600; margin-bottom: 8px; }
    .kv { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 0; }
    @media (max-width: 700px) { .kv { grid-template-columns: 1fr; } }
    .kv dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; }
    .kv dd { margin: 2px 0 0; }
    .break-word { word-break: break-word; }
    footer { margin-top: 18px; color: var(--muted); font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <div>
        <p class="eyebrow">Search UI Automation</p>
        <h1 id="dashTitle">Test Results Dashboard</h1>
        <p class="subtitle" id="generatedMeta"></p>
        <div class="header-meta" id="headerMeta"></div>
      </div>
      <div id="verdict" class="verdict ok">
        <div class="label">Overall result</div>
        <div class="value" id="verdictValue">—</div>
        <div class="detail" id="verdictDetail"></div>
      </div>
    </header>

    <section class="metrics" id="metrics" aria-label="Executive summary"></section>

    <section class="panel">
      <h2>Module summary</h2>
      <div style="overflow:auto;">
        <table class="compact">
          <thead>
            <tr>
              <th>Module</th>
              <th>Total</th>
              <th>Passed</th>
              <th>Failed</th>
              <th>Skipped</th>
              <th>Known Defects</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="moduleTableBody"></tbody>
        </table>
      </div>
      <p class="muted small">PASS* = module passed gate with known defect(s) only.</p>
    </section>

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

    <section class="panel">
      <h2>Responsive execution</h2>
      <div id="responsiveBody"></div>
    </section>

    <section class="panel">
      <h2>Failed tests</h2>
      <div id="failuresBody"></div>
    </section>

    <section class="panel">
      <h2>Known defects</h2>
      <div id="knownDefectsBody"></div>
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
          <option value="known-defect">Known defect</option>
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
        <div>Individual test-case details</div>
      </div>
      <div style="max-height: 620px; overflow: auto;">
        <table>
          <thead>
            <tr>
              <th>Test ID</th>
              <th>Test name</th>
              <th>Module</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Browser</th>
              <th>Viewport</th>
              <th>Error / notes</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
        <div class="empty" id="empty" hidden>No tests match the current filters.</div>
      </div>
    </section>

    <section class="panel">
      <h2>Recent runs</h2>
      <div id="recentRunsBody"></div>
    </section>

    <footer>
      Generated from Playwright JSON / cycle reports. Secrets are never embedded.
      Archive: <code>reports/html/runs/</code>
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

// Catalog of versioned dashboards (used for optional Recent Runs).
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

const cycleId = summary.cycle?.id || null;
const recentRuns = catalog
  .filter((entry) => {
    if (!entry) return false;
    if (!cycleId) return Boolean(entry.cycle);
    return entry.cycle?.id === cycleId;
  })
  .slice(0, 10);

summary.recentRuns = recentRuns;
const dataJsonFinal = JSON.stringify(summary).replace(/</g, '\\u003c');
const htmlFinal = html.replace(`const DATA = ${dataJson};`, `const DATA = ${dataJsonFinal};`);

const versionFile = path.join(versionDir, 'index.html');
fs.writeFileSync(versionFile, htmlFinal);
fs.writeFileSync(outFile, htmlFinal);

const summarySnap = path.join(versionDir, 'search-ui-summary.json');
fs.copyFileSync(summaryPath, summarySnap);

const meta = {
  id: stamp,
  generatedAt: summary.generatedAt || new Date().toISOString(),
  path: `runs/${stamp}/index.html`,
  source: summary.source || null,
  overall: summary.overall || null,
  analyticsCoverage: summary.analyticsCoverage || null,
  cycle: summary.cycle
    ? {
        id: summary.cycle.id,
        result: summary.cycle.result,
        environment: summary.cycle.environment,
        responsive: summary.cycle.responsive,
        startedAt: summary.cycle.startedAt,
        wallClockMs: summary.cycle.wallClockMs,
        counts: summary.cycle.counts,
      }
    : null,
};
fs.writeFileSync(path.join(versionDir, 'meta.json'), JSON.stringify(meta, null, 2));

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
  <p class="muted">Previous runs are preserved under <code>reports/html/runs/</code>.</p>
  <table>
    <thead><tr><th>Run ID</th><th>Cycle</th><th>Generated</th><th>Result</th><th>Total</th><th>Failed</th></tr></thead>
    <tbody>
${catalog
  .map((e) => {
    const o = e.overall || {};
    const c = e.cycle || {};
    return `<tr>
      <td><a href="./${e.id}/index.html">${e.id}</a></td>
      <td>${c.id || '—'}</td>
      <td>${e.generatedAt || ''}</td>
      <td>${c.result || o.passRate || '—'}</td>
      <td>${c.counts?.total ?? o.total ?? '—'}</td>
      <td>${c.counts?.failed ?? o.failed ?? '—'}</td>
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
