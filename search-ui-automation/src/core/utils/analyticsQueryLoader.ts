/**
 * Shared loader for analytics query datasets.
 * Feature modules import this — they must not import each other.
 */
import fs from 'fs';
import path from 'path';

export type AnalyticsQuery = {
  id: string;
  query: string;
  searchCount?: number;
  source?: string;
  category?: string;
};

type AnalyticsDatasetFile = {
  source?: string;
  label?: string;
  recordCount?: number;
  queries: AnalyticsQuery[];
};

const DATASET_RELATIVE = path.join(
  'src',
  'test-data',
  'analytics',
  'queries-50.json',
);

function datasetPath(): string {
  return path.resolve(process.cwd(), DATASET_RELATIVE);
}

export function loadAnalyticsDataset(): AnalyticsDatasetFile {
  const raw = fs.readFileSync(datasetPath(), 'utf8');
  const data = JSON.parse(raw) as AnalyticsDatasetFile;
  if (!Array.isArray(data.queries) || data.queries.length === 0) {
    throw new Error(`Analytics dataset has no queries: ${DATASET_RELATIVE}`);
  }
  return data;
}

/** All analytics queries from the shared dataset (exact source order). */
export function loadAllAnalyticsQueries(): AnalyticsQuery[] {
  return loadAnalyticsDataset().queries.map((q) => ({ ...q }));
}

/**
 * Queries for the current run.
 * Filters (optional):
 *   ANALYTICS_IDS=AN-Q001,AN-Q002
 *   ANALYTICS_LIMIT=5   (first N after ID filter, source order)
 */
export function loadAnalyticsQueries(): AnalyticsQuery[] {
  let queries = loadAllAnalyticsQueries();

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
