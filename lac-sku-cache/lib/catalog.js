const fs = require('fs');
const path = require('path');

const MODULE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATASET = path.join(MODULE_ROOT, 'data', 'wurthlac.json');

function normalizeSku(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function skusMatch(actual, expected) {
  if (actual == null || expected == null) return false;
  const left = normalizeSku(actual);
  const right = normalizeSku(expected);
  return left.length > 0 && left === right;
}

function resolveSite() {
  const sites = JSON.parse(fs.readFileSync(path.join(MODULE_ROOT, 'sites.json'), 'utf8'));
  const key = (process.env.SITE || 'wurthlac').trim().toLowerCase();
  const site = sites[key];
  if (!site) {
    throw new Error(`Unknown SITE="${key}". Use one of: ${Object.keys(sites).join(', ')}`);
  }
  const url = (process.env.LAC_BASE_URL || site.url).replace(/\/?$/, '/');
  const dataset = process.env.SKU_DATASET
    ? path.resolve(process.env.SKU_DATASET)
    : path.join(MODULE_ROOT, site.dataset);
  const reportDir = process.env.LAC_REPORT_DIR
    ? path.resolve(process.env.LAC_REPORT_DIR)
    : path.join(MODULE_ROOT, site.reportDir);
  return { ...site, key, url, dataset, reportDir };
}

function loadCatalog(filePath = resolveSite().dataset) {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`SKU dataset not found: ${resolved}`);
  }
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const rows = Array.isArray(parsed) ? parsed : parsed.skus;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`SKU dataset is empty: ${resolved}`);
  }

  const catalog = [];
  for (const row of rows) {
    if (typeof row === 'string' && row.trim()) {
      catalog.push({ sku: row.trim(), productId: '', title: '', url: '' });
      continue;
    }
    if (!row || typeof row.sku !== 'string' || !row.sku.trim()) continue;
    catalog.push({
      sku: row.sku.trim(),
      productId: row.productId != null ? String(row.productId) : '',
      title: typeof row.title === 'string' ? row.title : '',
      url: typeof row.url === 'string' ? row.url : '',
    });
  }

  const limit = Number(process.env.SKU_LIMIT);
  const limited =
    Number.isFinite(limit) && limit > 0 ? catalog.slice(0, Math.floor(limit)) : catalog;
  if (limited.length === 0) {
    throw new Error(`No SKUs to test in ${resolved}`);
  }
  return { sourcePath: resolved, skus: limited };
}

module.exports = {
  DEFAULT_DATASET,
  loadCatalog,
  normalizeSku,
  resolveSite,
  skusMatch,
};
