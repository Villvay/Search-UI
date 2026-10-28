/**
 * Prints the Würth LAC 100-SKU cache report to a self-contained PDF.
 * Usage: node scripts/generate-pdf.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const { resolveSite } = require('../lib/catalog.js');
const { datasetVersion } = require('../lib/versions.js');
const site = resolveSite();
const dataset = datasetVersion(site.key);
const reportDir = site.reportDir;
const csvPath = path.join(reportDir, 'lac-sku-cache-report.csv');
const summaryPath = path.join(reportDir, 'lac-sku-cache-summary.json');
const outFile = path.join(reportDir, 'lac-sku-cache-report.pdf');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((entry) => entry.some((value) => value !== ''));
  return body.map((entry) => Object.fromEntries(header.map((name, index) => [name, entry[index] || ''])));
}

function pill(value) {
  const text = String(value ?? '');
  const kind = /fail|high/i.test(text)
    ? 'bad'
    : /medium/i.test(text)
      ? 'warn'
      : /pass|low/i.test(text)
        ? 'ok'
        : 'neutral';
  return `<span class="pill ${kind}">${esc(text)}</span>`;
}

function severityOf(cacheIssue) {
  const match = String(cacheIssue || '').match(/^(High|Medium|Low)/);
  return match ? match[1] : '';
}

function shortDetails(details) {
  const text = String(details || '').replace(/\s+/g, ' ').trim();
  const match = text.match(/Previous SKU:.*?Current SKU:[^.]*\./);
  return match ? match[0] : text.slice(0, 180);
}

function isPrimarySearch(row) {
  return !/\(|^(back|forward|refresh)$/i.test(row['Search query'] || '');
}

function imageBlock(file, caption) {
  const absolute = path.join(reportDir, 'screenshots', file);
  if (!fs.existsSync(absolute)) return '';
  const data = fs.readFileSync(absolute).toString('base64');
  return `<figure>
    <img src="data:image/png;base64,${data}" alt="${esc(caption)}" />
    <figcaption>${esc(caption)}</figcaption>
  </figure>`;
}

if (!fs.existsSync(csvPath)) {
  console.error(`Missing ${csvPath}. Run npm run test:lac-sku-cache first.`);
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const summaryFile = fs.existsSync(summaryPath)
  ? JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
  : {};
const summary = summaryFile.summary || {};
const searches = rows.filter(isPrimarySearch);
const passes = searches.filter((row) => row.Status === 'Pass');
const fails = searches.filter((row) => row.Status === 'Fail');

const streaks = [];
let current = null;
searches.forEach((row, index) => {
  if (!current || current.status !== row.Status) {
    if (current) streaks.push(current);
    current = { status: row.Status, count: 1, start: row.SKU, end: row.SKU, index: index + 1 };
  } else {
    current.count += 1;
    current.end = row.SKU;
  }
});
if (current) streaks.push(current);
const longestFail = streaks.filter((item) => item.status === 'Fail').sort((a, b) => b.count - a.count)[0];

const when = new Date(summaryFile.generatedAt || Date.now()).toLocaleString('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const strip = searches
  .map((row) => `<i class="${row.Status === 'Pass' ? 'ok' : 'bad'}" title="${esc(row.SKU)}"></i>`)
  .join('');

const tableRows = rows
  .map((row) => {
    const severity = severityOf(row['Cache issue']);
    return `<tr class="${row.Status === 'Fail' ? 'fail' : 'pass'}">
      <td class="sku">${esc(row.SKU)}</td>
      <td>${esc(row['Search query'])}</td>
      <td>${esc(row['Expected page'])}</td>
      <td>${esc(row['Actual page'])}</td>
      <td>${severity ? pill(severity) : ''}<span class="issue-text">${esc(row['Cache issue'])}</span></td>
      <td>${esc(row.Status === 'Fail' ? shortDetails(row['Error details']) : '')}</td>
      <td>${pill(row.Status)}</td>
    </tr>`;
  })
  .join('');

const srpForQuery = fails.filter((row) => {
  const sku = String(row.SKU || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    /displayed page is not/i.test(row['Cache issue'] || '') &&
    new RegExp(`Search Results for "${sku}"`, 'i').test(row['Actual page'] || '')
  );
});
const cacheHigh = fails.filter((row) =>
  /previous SKU .+ is displayed|displayed content is still/i.test(row['Cache issue'] || ''),
).length;
const emptyInput = fails.filter((row) => /search input still shows ""/.test(row['Cache issue'] || ''));
const interrupted = fails.filter((row) => /could not be completed/.test(row['Cache issue'] || ''));
const previousProduct = fails.filter((row) => /previous SKU .+ is displayed/i.test(row['Cache issue'] || ''));
const historyRows = rows.filter((row) => /^(back|forward)$/i.test(row['Search query'] || ''));
const historyFails = historyRows.filter((row) => row.Status === 'Fail');
const refreshRow = rows.find((row) => row['Search query'] === 'refresh');
const skuList = (list) => list.map((row) => row.SKU).join(', ');

const findings = [
  previousProduct.length
    ? `<article class="finding high"><strong>High — previous product remained on screen</strong><p>${previousProduct.length} searches showed the previous SKU’s product page: ${esc(skuList(previousProduct))}.</p></article>`
    : `<article class="finding ok"><strong>Previous-product cache did not reproduce</strong><p>No settled page still showed the previous SKU. Product pages that opened showed the SKU just searched. Results pages that opened were headed for that same query.</p></article>`,
  srpForQuery.length
    ? `<article class="finding ok"><strong>Some exact SKUs stayed on search results</strong><p>${srpForQuery.length} searches stayed on a results page for the current SKU instead of opening one product page. The heading and the first products matched that query: ${esc(skuList(srpForQuery))}.</p></article>`
    : '',
  emptyInput.length
    ? `<article class="finding medium"><strong>Medium — search field cleared on the correct product</strong><p>${emptyInput.length} searches opened the right product page, then the search field was empty: ${esc(skuList(emptyInput))}.</p></article>`
    : '',
  interrupted.length
    ? `<article class="finding medium"><strong>Medium — navigation interrupted the check</strong><p>${interrupted.length} searches were still navigating when the check ran, so the page was not readable: ${esc(skuList(interrupted))}. The recorded URL was the expected product except where the result row says otherwise. Screenshots from these steps are blank.</p></article>`
    : '',
  `<article class="finding ${historyFails.length ? 'medium' : 'ok'}"><strong>Back and forward</strong><p>${historyFails.length ? `${historyFails.length} of ${historyRows.length} history checks left the search field or product out of sync with the URL.` : `All ${historyRows.length} back and forward checks kept the product and the search field aligned with the URL.`}</p></article>`,
  refreshRow
    ? `<article class="finding ${refreshRow.Status === 'Pass' ? 'ok' : 'medium'}"><strong>Refresh</strong><p>${refreshRow.Status === 'Pass' ? `Refreshing ${esc(refreshRow.SKU)} stayed on ${esc(refreshRow['Actual page'])}.` : esc(refreshRow['Cache issue'] || refreshRow['Error details'])}</p></article>`
    : '',
  `<article class="finding ok"><strong>Console and network</strong><p>No Zod validation errors and no failed search API responses were recorded. Longest failure streak: ${longestFail ? `${longestFail.count} searches, ${esc(longestFail.start)} through ${esc(longestFail.end)}` : 'none'}.</p></article>`,
].join('');

const evidence = fails
  .filter((row) => /Item #/.test(row['Actual page'] || '') && /screenshots\//.test(row['Error details'] || ''))
  .slice(0, 2)
  .map((row) => {
    const file = (row['Error details'].match(/screenshots\/(\S+)/) || [])[1];
    return imageBlock(
      file,
      `${row.SKU}: ${row['Cache issue']}. Page shown: ${row['Actual page']}.`,
    );
  })
  .filter(Boolean);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Würth LAC SKU cache and navigation report</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #1a2332; font: 10px/1.4 "Helvetica Neue", Helvetica, Arial, sans-serif; }
    h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.02em; }
    h2 { margin: 18px 0 6px; font-size: 14px; }
    p { margin: 0 0 8px; }
    .muted { color: #5c6b7a; }
    .summary { display: flex; gap: 8px; margin: 12px 0; }
    .card { border: 1px solid #d7dee7; border-radius: 8px; padding: 8px 10px; min-width: 92px; }
    .card .value { font-size: 18px; font-weight: 700; }
    .card.ok .value { color: #0f7b4c; }
    .card.warn .value { color: #9a3412; }
    .card.bad .value { color: #9b1c1c; }
    .finding { break-inside: avoid; border: 1px solid #e4eaf0; border-left-width: 4px; border-radius: 8px; padding: 8px 10px; margin: 0 0 8px; }
    .finding.high { border-left-color: #9b1c1c; }
    .finding.medium { border-left-color: #c2410c; }
    .finding.ok { border-left-color: #0f7b4c; }
    .finding strong { display: block; margin-bottom: 2px; }
    .strip { display: flex; flex-wrap: wrap; gap: 2px; margin: 6px 0 2px; }
    .strip i { width: 8px; height: 12px; border-radius: 1px; display: block; }
    .strip i.ok { background: #1f9d62; }
    .strip i.bad { background: #d64545; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    thead { display: table-header-group; }
    th, td { border-bottom: 1px solid #e4eaf0; padding: 4px 5px; vertical-align: top; text-align: left; }
    th { font-size: 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #5c6b7a; }
    tr { break-inside: avoid; }
    td.sku { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8px; white-space: nowrap; }
    .issue-text { display: block; margin-top: 2px; }
    .pill { display: inline-block; border-radius: 999px; padding: 0 6px; font-size: 8px; font-weight: 700; background: #eef2f6; }
    .pill.ok { background: #e7f6ee; color: #0f7b4c; }
    .pill.warn { background: #fff4d6; color: #8a5a00; }
    .pill.bad { background: #fde8e8; color: #9b1c1c; }
    .evidence { break-before: page; }
    figure { margin: 0 0 12px; break-inside: avoid; }
    img { width: 100%; height: auto; border: 1px solid #d7dee7; border-radius: 6px; }
    figcaption { margin-top: 4px; font-size: 10px; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${esc(summaryFile.label || site.label)} SKU cache and navigation</h1>
  <p class="muted">Generated ${esc(when)} UTC. Site: ${esc(summaryFile.site || site.url)} · Dataset: ${esc(path.basename(summaryFile.dataset || site.dataset))} ${esc(summaryFile.datasetVersion || dataset.version)} created ${esc(summaryFile.datasetCreatedAt || dataset.createdAt)} · Module ${esc(summaryFile.moduleVersion || dataset.moduleVersion)} created ${esc(summaryFile.moduleCreatedAt || dataset.moduleCreatedAt)} · One Chrome session, no reload between searches.</p>

  <div class="summary">
    <div class="card"><div class="muted">SKUs tested</div><div class="value">${searches.length}</div></div>
    <div class="card ok"><div class="muted">Passed</div><div class="value">${passes.length}</div></div>
    <div class="card bad"><div class="muted">Failed</div><div class="value">${fails.length}</div></div>
    <div class="card ${cacheHigh ? 'bad' : 'ok'}"><div class="muted">Stale product pages</div><div class="value">${cacheHigh}</div></div>
    <div class="card warn"><div class="muted">Medium checks</div><div class="value">${rows.filter((row) => /^Medium/.test(row['Cache issue'] || '')).length}</div></div>
    <div class="card"><div class="muted">Low</div><div class="value">${summary.low ?? 0}</div></div>
  </div>

  <h2>Findings</h2>
  ${findings}

  <h2>Result sequence</h2>
  <p class="muted">Each mark is one SKU in file order. Green passed. Red failed.</p>
  <div class="strip">${strip}</div>
  <p class="muted">Failed SKUs: ${esc(fails.map((row) => row.SKU).join(', ')) || 'none'}.</p>

  <h2>Results</h2>
  <p class="muted">Includes the ${searches.length} searches plus repeat, back, forward, and refresh checks. Failure screenshots from this run are stored beside the CSV.</p>
  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>Search query</th>
        <th>Expected page</th>
        <th>Actual page</th>
        <th>Cache issue</th>
        <th>Error details</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <section class="evidence">
    <h2>Evidence</h2>
    <p class="muted">Failure screenshots from the same run. The full set is stored with the CSV report.</p>
    ${evidence.join('')}
  </section>
</body>
</html>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({
  path: outFile,
  format: 'Letter',
  landscape: true,
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="font-size:8px;width:100%;padding:0 12mm;color:#5c6b7a;display:flex;justify-content:space-between;">
      <span>${esc(summaryFile.label || site.label)} SKU cache and navigation · ${esc(path.basename(summaryFile.dataset || site.dataset))}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '12mm', bottom: '14mm', left: '10mm', right: '10mm' },
});
await browser.close();
console.log(outFile);
