import fs from 'fs';
import path from 'path';

export type SkuDataset = {
  sourcePath: string;
  uniqueSkus: string[];
  searchSequence: string[];
};

type JsonSkuFile = {
  skus?: Array<string | { sku?: string }>;
};

const DEFAULT_RELATIVE = path.join('src', 'test-data', 'sku-plp', 'skus.json');

function resolveDatasetPath(): string {
  const override = process.env.SKU_DATASET?.trim();
  if (override) {
    return path.isAbsolute(override)
      ? override
      : path.resolve(process.cwd(), override);
  }
  return path.resolve(process.cwd(), DEFAULT_RELATIVE);
}

function parseLimit(): number | undefined {
  const raw = process.env.SKU_LIMIT?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`SKU_LIMIT must be a positive number (got "${raw}")`);
  }
  return Math.floor(n);
}

function includeCacheSequences(): boolean {
  const raw = process.env.SKU_CACHE_SEQUENCES?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return true;
}

function includeFailedCatalogRows(): boolean {
  const raw = process.env.SKU_INCLUDE_FAILS?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function normalizeSku(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

export function skusMatch(actual: string | null | undefined, expected: string): boolean {
  if (actual == null) return false;
  const a = normalizeSku(actual);
  const b = normalizeSku(expected);
  return a.length > 0 && a === b;
}

function pushSku(target: string[], seen: Set<string>, raw: string): void {
  const sku = raw.trim();
  if (!sku) return;
  const key = normalizeSku(sku);
  if (seen.has(key)) return;
  seen.add(key);
  target.push(sku);
}

function parseJsonSkus(raw: string): string[] {
  const parsed = JSON.parse(raw) as JsonSkuFile | string[];
  const rows = Array.isArray(parsed) ? parsed : parsed.skus;
  if (!Array.isArray(rows)) {
    throw new Error('SKU dataset JSON must be { "skus": [...] } or a string array');
  }
  const seen = new Set<string>();
  const skus: string[] = [];
  for (const row of rows) {
    if (typeof row === 'string') {
      pushSku(skus, seen, row);
    } else if (row && typeof row.sku === 'string') {
      pushSku(skus, seen, row.sku);
    }
  }
  return skus;
}

/**
 * Catalog NDJSON rows: { "sku", "plp", "status", "total" }.
 * Default: keep rows with plp=true (or missing plp). Skip known catalog fails.
 */
function parseNdjsonSkus(raw: string): string[] {
  const seen = new Set<string>();
  const skus: string[] = [];
  const keepFails = includeFailedCatalogRows();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: { sku?: string; plp?: boolean | null; status?: string };
    try {
      row = JSON.parse(trimmed) as { sku?: string; plp?: boolean | null; status?: string };
    } catch {
      continue;
    }
    if (typeof row.sku !== 'string') continue;
    if (row.plp === false) continue;
    if (!keepFails && row.status === 'fail') continue;
    if (row.plp === null && !keepFails) continue;
    pushSku(skus, seen, row.sku);
  }
  return skus;
}

function loadUniqueSkus(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`SKU dataset not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    throw new Error(`SKU dataset is empty: ${filePath}`);
  }

  if (raw.startsWith('{') || raw.startsWith('[')) {
    return parseJsonSkus(raw);
  }
  return parseNdjsonSkus(raw);
}

/**
 * Build sequences that expose stale product pages in the same session:
 *   A → B, B → C, C → A, A → B → A
 * then the remaining unique SKUs.
 */
export function buildCacheSearchSequence(skus: string[]): string[] {
  if (skus.length === 0) return [];
  if (skus.length === 1) return [...skus];
  if (skus.length === 2) {
    const [a, b] = skus;
    return [a, b, a];
  }
  const [a, b, c] = skus;
  return [a, b, c, a, b, a, ...skus.slice(3)];
}

export function loadSkuDataset(): SkuDataset {
  const sourcePath = resolveDatasetPath();
  let uniqueSkus = loadUniqueSkus(sourcePath);
  const limit = parseLimit();
  if (limit != null) {
    uniqueSkus = uniqueSkus.slice(0, limit);
  }
  if (uniqueSkus.length === 0) {
    throw new Error(`SKU dataset contained no usable SKUs: ${sourcePath}`);
  }

  const searchSequence = includeCacheSequences()
    ? buildCacheSearchSequence(uniqueSkus)
    : uniqueSkus;

  return { sourcePath, uniqueSkus, searchSequence };
}
