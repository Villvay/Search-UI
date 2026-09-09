/**
 * Small shared utilities that are not page-object specific.
 */

export function trimQuery(value: string): string {
  return value.trim();
}

export function isNonEmptyQuery(value: string): boolean {
  return trimQuery(value).length > 0;
}

export {
  normalizeForMatch,
  productTitleMatchesQuery,
} from './analyticsProductTitle';

export {
  expectedAnalyticsQueryCount,
  getActiveAnalyticsDatasetPath,
  getAnalyticsQueryById,
  loadAllAnalyticsQueries,
  loadAnalyticsDataset,
  loadAnalyticsQueries,
  loadAnalyticsSmokeIds,
  normalizeAnalyticsQueryKey,
  parseAnalyticsModules,
  summarizeAnalyticsDataset,
  truncateQueryForTitle,
  type AnalyticsModuleId,
  type AnalyticsQuery,
} from './analyticsQueryLoader';
