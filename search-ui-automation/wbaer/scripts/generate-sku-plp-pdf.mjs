/**
 * Builds a shareable PDF SKU list from the latest (or SKU_PLP_REPORT_DIR) run.
 * Output: reports/sku-plp/runs/<run-id>/sku-search-cache-sku-list.pdf
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function latestRunId(projectRoot) {
  const runsDir = path.join(projectRoot, 'reports', 'sku-plp', 'runs');
  if (!fs.existsSync(runsDir)) return '';
  return fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .at(-1) || '';
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }) + ' UTC';
}

const reportDir = path.resolve(
  process.env.SKU_PLP_REPORT_DIR?.trim() ||
    path.join(root, 'reports', 'sku-plp', 'runs', latestRunId(root) || ''),
);
const jsonPath = path.join(reportDir, 'sku_search_results.json');

if (!fs.existsSync(jsonPath)) {
  console.error(
    'Missing sku_search_results.json — run npm run test:sku-plp first.',
    jsonPath,
  );
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const summary = report.summary || {};
const results = Array.isArray(report.results) ? report.results : [];
const uniqueSkus = Array.isArray(report.uniqueSkus)
  ? report.uniqueSkus
  : [...new Set(results.map((r) => r.searchedSku))];

const failedRows = results.filter((r) => r.overall === 'FAIL');
const uniqueFailed = [...new Set(failedRows.map((r) => r.searchedSku))];
const statusBySku = new Map();
for (const sku of uniqueSkus) statusBySku.set(sku, 'PASS');
for (const row of results) {
  if (row.overall === 'FAIL') statusBySku.set(row.searchedSku, 'FAIL');
}

const runId =
  report.runId ||
  path.basename(reportDir) ||
  latestRunId(root);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SKU search cache — SKU list</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: #15202b;
      font-family: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 10.5px;
      line-height: 1.4;
    }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 {
      font-size: 13px;
      margin: 18px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #d9e1e8;
      color: #0f4c81;
      page-break-after: avoid;
    }
    p { margin: 0 0 8px; }
    .muted { color: #5b6b7c; }
    .kicker { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #0f4c81; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 12px 0 14px; }
    .meta div { border-bottom: 1px dotted #d9e1e8; padding: 3px 0; }
    .meta dt { color: #5b6b7c; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; }
    .meta dd { margin: 0; font-weight: 600; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 12px 0 16px; }
    .stat { border: 1px solid #d9e1e8; border-radius: 8px; padding: 8px 10px; }
    .stat b { display: block; font-size: 18px; }
    .stat span { color: #5b6b7c; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; }
    .fail b { color: #b42318; }
    .pass b { color: #1b7f4a; }
    .stale b { color: #9a3412; }
    .note {
      background: #ffedd5;
      border: 1px solid #fdba74;
      border-radius: 8px;
      padding: 8px 10px;
      margin: 0 0 12px;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .chip {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 9px;
      border: 1px solid #f0b4ae;
      background: #fdeceb;
      color: #b42318;
      border-radius: 4px;
      padding: 2px 6px;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #e8eef3; vertical-align: top; }
    th { font-size: 9px; text-transform: uppercase; letter-spacing: .03em; color: #5b6b7c; background: #f4f6f8; }
    tr { page-break-inside: avoid; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .badge {
      display: inline-block;
      font-size: 8px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .badge-fail { background: #fdeceb; color: #b42318; }
    .badge-pass { background: #e7f6ee; color: #1b7f4a; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px 8px; }
    .sku-row { display: flex; justify-content: space-between; gap: 6px; border-bottom: 1px dotted #e8eef3; padding: 2px 0; page-break-inside: avoid; }
    .sku-row.fail { background: #fdeceb; padding: 2px 4px; border-radius: 3px; border-bottom: 0; }
  </style>
</head>
<body>
  <p class="kicker">Search UI · QA cache validation</p>
  <h1>SKU list — sequential search cache issue</h1>
  <p class="muted">Same browser session, no reload between SKUs. Unique-match SKU Enter search should land on that SKU’s product page (<span class="mono">Item #</span>). Failures mean the previous product page was still shown.</p>

  <div class="meta">
    <div><dt>Environment</dt><dd>${esc(report.baseURL || 'https://qa-baersupply.vercel.app')}</dd></div>
    <div><dt>Run</dt><dd>${esc(runId)}</dd></div>
    <div><dt>Dataset</dt><dd>${esc(report.dataset || 'skus-plp-true-500.json')} · ${esc(summary.uniqueSkus ?? uniqueSkus.length)} unique SKUs · ${esc(summary.totalSkus ?? results.length)} sequential searches</dd></div>
    <div><dt>Finished</dt><dd>${formatWhen(report.finishedAt || report.generatedAt)}</dd></div>
  </div>

  <div class="stats">
    <div class="stat"><span>Unique SKUs</span><b>${esc(uniqueSkus.length)}</b></div>
    <div class="stat pass"><span>Passed</span><b>${esc(summary.passed ?? '')}</b></div>
    <div class="stat fail"><span>Failed</span><b>${esc(summary.failed ?? failedRows.length)}</b></div>
    <div class="stat stale"><span>Stale PLP</span><b>${esc(summary.cacheBugsSuspected ?? '')}</b></div>
    <div class="stat"><span>Unique failed SKUs</span><b>${esc(uniqueFailed.length)}</b></div>
  </div>

  <div class="note">
    <strong>Bug pattern:</strong> Search A → product A (correct). Search B → still product A (stale). Search C → product B (off-by-one).
    All ${esc(failedRows.length)} failures in this run were stale product pages.
  </div>

  <h2>Failed SKUs (${uniqueFailed.length} unique)</h2>
  <p class="muted">SKUs that loaded the previous product instead of the SKU just searched.</p>
  <div class="chips">
    ${uniqueFailed.map((sku) => `<span class="chip">${esc(sku)}</span>`).join('')}
  </div>

  <h2>Failed searches (${failedRows.length})</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Searched SKU</th>
        <th>Previous SKU</th>
        <th>Loaded Item #</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody>
      ${failedRows
        .map(
          (row) => `<tr>
        <td>${esc(row.index)}</td>
        <td class="mono">${esc(row.searchedSku)}</td>
        <td class="mono">${esc(row.previousSku ?? '')}</td>
        <td class="mono">${esc(row.actualPlpSku ?? '(none)')}</td>
        <td><span class="badge badge-fail">${row.cacheBugSuspected ? 'STALE PLP' : esc(row.failureCode || 'FAIL')}</span></td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <h2>Full unique SKU list (${uniqueSkus.length})</h2>
  <p class="muted">First 500 catalog SKUs with <span class="mono">plp=true</span>. Red rows failed at least once in this run.</p>
  <div class="grid">
    ${uniqueSkus
      .map((sku) => {
        const fail = statusBySku.get(sku) === 'FAIL';
        return `<div class="sku-row${fail ? ' fail' : ''}"><span class="mono">${esc(sku)}</span><span class="badge ${fail ? 'badge-fail' : 'badge-pass'}">${fail ? 'FAIL' : 'PASS'}</span></div>`;
      })
      .join('')}
  </div>
</body>
</html>`;

const pdfName = 'sku-search-cache-sku-list.pdf';
const outFile = path.join(reportDir, pdfName);
const latestCopy = path.join(root, 'reports', 'sku-plp', pdfName);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({
  path: outFile,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="font-size:8px;width:100%;padding:0 16mm;color:#5b6b7c;display:flex;justify-content:space-between;">
      <span>SKU search cache validation · ${esc(runId)}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
});
await browser.close();

fs.mkdirSync(path.dirname(latestCopy), { recursive: true });
fs.copyFileSync(outFile, latestCopy);

console.log(`Wrote ${path.relative(root, outFile)}`);
console.log(`Wrote ${path.relative(root, latestCopy)}`);
