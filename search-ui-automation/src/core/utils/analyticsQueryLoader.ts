/**
 * Shared loader for analytics query datasets.
 * Feature modules import this — they must not import each other.
 *
 * Default dataset: queries-50.json (Non-SKU top 50 — existing).
 * New dataset: queries-top50-sku-nonsku-2026-08-31.json via ANALYTICS_DATASET.
 */
import fs from 'fs';
import path from 'path';

export type AnalyticsQuery = {
  id: string;
  query: string;
  searchCount?: number;
  clickCount?: number;
  source?: string;
  category?: string;
  list?: string;
  rank?: number;
};

type AnalyticsDatasetFile = {
  source?: string;
  label?: string;
  recordCount?: number;
  notes?: string;
  stats?: Record<string, unknown>;
  queries: AnalyticsQuery[];
};

type SmokeIdsFile = {
  ids: string[];
};

const DATASET_FILES: Record<string, string> = {
  /** Existing Non-SKU top-50 by searches (unchanged). */
  default: path.join('src', 'test-data', 'analytics', 'queries-50.json'),
  'queries-50': path.join('src', 'test-data', 'analytics', 'queries-50.json'),
  /** New PDF dataset: Non-SKU + SKU × searches + clicks (200 rows). */
  'top50-sku-nonsku': path.join(
    'src',
    'test-data',
    'analytics',
    'queries-top50-sku-nonsku-2026-08-31.json',
  ),
  'sku-nonsku': path.join(
    'src',
    'test-data',
    'analytics',
    'queries-top50-sku-nonsku-2026-08-31.json',
  ),
};

const SMOKE_IDS_RELATIVE = path.join(
  'src',
  'test-data',
  'analytics',
  'smoke-query-ids.json',
);

function resolveDatasetRelative(): string {
  const key = (process.env.ANALYTICS_DATASET || 'default').trim().toLowerCase();
  if (DATASET_FILES[key]) return DATASET_FILES[key];
  // Allow relative path under src/test-data/analytics/
  if (key.endsWith('.json')) {
    return path.join('src', 'test-data', 'analytics', path.basename(key));
  }
  throw new Error(
    `Unknown ANALYTICS_DATASET="${key}". Known: ${Object.keys(DATASET_FILES).join(', ')} or a *.json filename.`,
  );
}

function datasetPath(): string {
  return path.resolve(process.cwd(), resolveDatasetRelative());
}

function smokeIdsPath(): string {
  return path.resolve(process.cwd(), SMOKE_IDS_RELATIVE);
}

export function getActiveAnalyticsDatasetPath(): string {
  return datasetPath();
}

export function loadAnalyticsDataset(): AnalyticsDatasetFile {
  const file = datasetPath();
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw) as AnalyticsDatasetFile;
  if (!Array.isArray(data.queries) || data.queries.length === 0) {
    throw new Error(`Analytics dataset has no queries: ${file}`);
  }
  return data;
}

/** All analytics queries from the active dataset (exact source order). */
export function loadAllAnalyticsQueries(): AnalyticsQuery[] {
  return loadAnalyticsDataset().queries.map((q) => ({ ...q }));
}

/** Fixed smoke IDs from smoke-query-ids.json (subset of the default dataset). */
export function loadAnalyticsSmokeIds(): string[] {
  const raw = fs.readFileSync(smokeIdsPath(), 'utf8');
  const data = JSON.parse(raw) as SmokeIdsFile;
  if (!Array.isArray(data.ids) || data.ids.length === 0) {
    throw new Error(`Analytics smoke IDs missing: ${SMOKE_IDS_RELATIVE}`);
  }
  return data.ids.map((id) => id.trim().toUpperCase()).filter(Boolean);
}

/**
 * Queries for the current run.
 * Filters (optional, applied in order):
 *   ANALYTICS_DATASET=…      → select dataset file (default: queries-50)
 *   ANALYTICS_PROFILE=smoke  → representative subset from smoke-query-ids (default dataset IDs)
 *   ANALYTICS_IDS=AN-Q001,… → explicit ID allow-list
 *   ANALYTICS_LIMIT=5        → first N after prior filters (source order)
 *   ANALYTICS_CATEGORY=sku|non-sku → category filter (new dataset)
 *   ANALYTICS_LIST=non-sku-by-searches → list filter (new dataset)
 */
export function loadAnalyticsQueries(): AnalyticsQuery[] {
  let queries = loadAllAnalyticsQueries();

  const profile = (process.env.ANALYTICS_PROFILE || '').trim().toLowerCase();
  if (profile === 'smoke') {
    const smokeIds = loadAnalyticsSmokeIds();
    const byId = new Map(
      queries.map((q) => [q.id.toUpperCase(), q] as const),
    );
    queries = smokeIds
      .map((id) => byId.get(id))
      .filter((q): q is AnalyticsQuery => Boolean(q));

    const missing = smokeIds.filter((id) => !byId.has(id));
    if (missing.length) {
      // Smoke IDs target the default Non-SKU file; when using the new dataset,
      // fall back to first N queries instead of failing hard.
      const limit = smokeIds.length;
      console.warn(
        `[analytics] Smoke IDs not in active dataset (${missing.length} missing). Using first ${limit} queries instead.`,
      );
      queries = loadAllAnalyticsQueries().slice(0, limit);
    }
  } else if (profile && profile !== 'full') {
    throw new Error(
      `Unsupported ANALYTICS_PROFILE="${profile}". Use smoke | full (or omit).`,
    );
  }

  const category = (process.env.ANALYTICS_CATEGORY || '').trim().toLowerCase();
  if (category) {
    queries = queries.filter(
      (q) => (q.category || '').toLowerCase() === category,
    );
  }

  const list = (process.env.ANALYTICS_LIST || '').trim().toLowerCase();
  if (list) {
    queries = queries.filter((q) => (q.list || '').toLowerCase() === list);
  }

  const idsRaw = (process.env.ANALYTICS_IDS || '').trim();
  if (idsRaw) {
    const allow = new Set(
      idsRaw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
    queries = queries.filter((q) => allow.has(q.id.toUpperCase()));
  }

  const limitRaw = (process.env.ANALYTICS_LIMIT || '').trim();
  if (limitRaw) {
    const limit = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(limit) || limit < 1) {
      throw new Error(`Invalid ANALYTICS_LIMIT: ${limitRaw}`);
    }
    queries = queries.slice(0, limit);
  }

  return queries;
}

export function getAnalyticsQueryById(id: string): AnalyticsQuery | undefined {
  return loadAllAnalyticsQueries().find(
    (q) => q.id.toUpperCase() === id.toUpperCase(),
  );
}

export function expectedAnalyticsQueryCount(): number {
  return loadAllAnalyticsQueries().length;
}

/** Truncate query text for Playwright test titles. */
export function truncateQueryForTitle(query: string, max = 28): string {
  const compact = query.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 3)}...`;
}

/** Dataset stats helper for reports. */
export function summarizeAnalyticsDataset(queries: AnalyticsQuery[]): {
  total: number;
  uniqueExact: number;
  uniqueCaseInsensitive: number;
  exactDuplicateOccurrences: number;
  categories: string[];
  lists: string[];
} {
  const texts = queries.map((q) => q.query);
  const uniqueExact = new Set(texts);
  const uniqueCi = new Set(texts.map((t) => t.toLowerCase()));
  return {
    total: queries.length,
    uniqueExact: uniqueExact.size,
    uniqueCaseInsensitive: uniqueCi.size,
    exactDuplicateOccurrences: texts.length - uniqueExact.size,
    categories: [
      ...new Set(
        queries.map((q) => q.category || 'unknown').filter(Boolean),
      ),
    ].sort(),
    lists: [
      ...new Set(queries.map((q) => q.list || 'unknown').filter(Boolean)),
    ].sort(),
  };
}

/** Normalize query text for analytics execution deduplication only. */
export function normalizeAnalyticsQueryKey(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

export type AnalyticsModuleId = 'on-type' | 'suggestions' | 'on-enter';

const ANALYTICS_MODULES: AnalyticsModuleId[] = [
  'on-type',
  'suggestions',
  'on-enter',
];

/**
 * Parse ANALYTICS_MODULES env (comma-separated).
 * Default: on-type,suggestions,on-enter
 */
export function parseAnalyticsModules(
  raw = process.env.ANALYTICS_MODULES,
): AnalyticsModuleId[] {
  const value = (raw || '').trim();
  if (!value) return [...ANALYTICS_MODULES];

  const parts = value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!parts.length) {
    throw new Error(
      `Invalid ANALYTICS_MODULES="${raw}". Use comma-separated: ${ANALYTICS_MODULES.join(',')}`,
    );
  }

  const unknown = parts.filter(
    (p) => !ANALYTICS_MODULES.includes(p as AnalyticsModuleId),
  );
  if (unknown.length) {
    throw new Error(
      `Invalid ANALYTICS_MODULES entry: ${unknown.join(', ')}. Supported: ${ANALYTICS_MODULES.join(', ')}`,
    );
  }

  // Preserve order from env, drop duplicates
  const seen = new Set<string>();
  const modules: AnalyticsModuleId[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    modules.push(p as AnalyticsModuleId);
  }
  return modules;
}
