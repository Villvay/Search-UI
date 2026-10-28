const fs = require('fs');
const path = require('path');

const COLUMNS = [
  'SKU',
  'Search query',
  'Expected page',
  'Actual page',
  'Cache issue',
  'Error details',
  'Status',
];

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = [COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(COLUMNS.map((column) => csvEscape(row[column])).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function summarize(rows) {
  const searches = rows.filter((row) => row.kind === 'search');
  const repeats = rows.filter((row) => row.kind === 'repeat');
  const history = rows.filter((row) => row.kind === 'back' || row.kind === 'forward');
  const refreshes = rows.filter((row) => row.kind === 'refresh');
  const failed = rows.filter((row) => row.Status === 'Fail');
  const cacheRows = rows.filter((row) => row['Cache issue']);

  const offByOne = searches.filter((row) => row.signature === 'previous-product').length;
  const comparable = Math.max(searches.length - 1, 0);
  const offByOneRate = comparable === 0 ? 0 : offByOne / comparable;
  const reproducible =
    offByOne >= 3 || (offByOne >= 2 && offByOneRate >= 0.8)
      ? 'confirmed'
      : offByOne > 0
        ? 'intermittent'
        : 'none';

  const repeatConfirmed = repeats.filter(
    (row) => row.signature && row.signature === row.originalSignature && row.Status === 'Fail',
  ).length;
  const repeatCleared = repeats.filter((row) => row.intermittentClear).length;

  return {
    totalSkusTested: searches.length,
    passed: searches.filter((row) => row.Status === 'Pass').length,
    failed: searches.filter((row) => row.Status === 'Fail').length,
    cacheIssues: cacheRows.length,
    high: cacheRows.filter((row) => row.severity === 'High').length,
    medium: cacheRows.filter((row) => row.severity === 'Medium').length,
    low: cacheRows.filter((row) => row.severity === 'Low').length,
    offByOne,
    offByOneRate,
    reproducibility: reproducible,
    repeatConfirmed,
    repeatCleared,
    historyChecks: history.length,
    historyFailures: history.filter((row) => row.Status === 'Fail').length,
    refreshChecks: refreshes.length,
    refreshResolved: refreshes.filter((row) => row.refreshResolved).length,
    otherFailures: failed.filter((row) => !row['Cache issue']).length,
    consoleErrors: uniqueMessages(rows.flatMap((row) => row.consoleErrors || [])),
    networkErrors: uniqueMessages(rows.flatMap((row) => row.networkErrors || [])),
  };
}

function uniqueMessages(messages) {
  const counts = new Map();
  for (const message of messages) {
    const key = String(message).replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([message, count]) => ({ message, count }));
}

function writeSummary(filePath, summary, meta) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ ...meta, summary }, null, 2),
  );
}

module.exports = {
  COLUMNS,
  writeCsv,
  writeSummary,
  summarize,
};
