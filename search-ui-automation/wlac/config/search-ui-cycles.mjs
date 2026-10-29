/**
 * Würth LAC Search UI test-cycle configuration.
 *
 * Smoke vs regression orchestration — does not redefine module tests.
 * Trending Now and Related Searches are excluded: they were not present on
 * https://wurthlac.com during live inspection (2026-10-29).
 * Barcode/QR API lookup is excluded until a WLAC barcode endpoint is verified.
 */

export const RESPONSIVE_PROJECTS = [
  'desktop-1440',
  'desktop-1280',
  'tablet-1024',
  'tablet-768',
  'mobile-390',
  'mobile-375',
];

export const PRIMARY_DESKTOP_PROJECT = 'desktop-1440';

export const CYCLE_BROWSER = 'Chromium';

export const CYCLE_MODULE_CATALOG = {
  'on-type': {
    id: 'on-type',
    label: 'On-Type',
    shortLabel: 'ON-TYPE',
    path: 'src/modules/on-type/tests/on-type.spec.ts',
    reportModule: 'ON-TYPE',
  },
  suggestions: {
    id: 'suggestions',
    label: 'Suggestions',
    shortLabel: 'SUGGESTIONS',
    path: 'src/modules/suggestions/tests/suggestions.spec.ts',
    reportModule: 'SUGGESTIONS',
  },
  'on-enter': {
    id: 'on-enter',
    label: 'On-Enter',
    shortLabel: 'ON-ENTER',
    path: 'src/modules/on-enter/tests/on-enter.spec.ts',
    reportModule: 'ON-ENTER',
  },
  'recent-searches': {
    id: 'recent-searches',
    label: 'Recent Searches',
    shortLabel: 'RECENT',
    path: 'src/modules/recent-searches/tests/recent-searches.spec.ts',
    reportModule: 'RECENT SEARCHES',
  },
  filters: {
    id: 'filters',
    label: 'Filters & Facets',
    shortLabel: 'FILTERS',
    path: 'src/modules/filters-facets/tests/filters-facets.spec.ts',
    reportModule: 'FILTERS & FACETS',
  },
  sorting: {
    id: 'sorting',
    label: 'Sorting',
    shortLabel: 'SORTING',
    path: 'src/modules/sorting/tests/sorting.spec.ts',
    reportModule: 'SORTING',
  },
  'runtime-errors': {
    id: 'runtime-errors',
    label: 'Runtime Errors',
    shortLabel: 'RUNTIME',
    path: 'src/modules/runtime-errors/tests/runtime-errors.spec.ts',
    reportModule: 'RUNTIME ERRORS',
  },
  'cache-state': {
    id: 'cache-state',
    label: 'Cache & State',
    shortLabel: 'CACHE',
    path: 'src/modules/cache-state/tests/cache-state.spec.ts',
    reportModule: 'CACHE & STATE',
  },
  'search-input-robustness': {
    id: 'search-input-robustness',
    label: 'Search Input Robustness',
    shortLabel: 'INPUT',
    path: 'src/modules/search-input-robustness/tests/search-input-robustness.spec.ts',
    reportModule: 'SEARCH INPUT ROBUSTNESS',
  },
  'barcode-scanner': {
    id: 'barcode-scanner',
    label: 'Barcode Scanner UI',
    shortLabel: 'BARCODE',
    path: 'src/modules/barcode-scanner/tests/barcode-scanner.spec.ts',
    reportModule: 'BARCODE SCANNER',
  },
};

export const KNOWN_DEFECTS = [];

export const RELIABILITY_NOTES = [];

export const CYCLE_EXCLUSIONS = {
  'trending-now': {
    reason:
      'Not observed on wurthlac.com (idle dropdown shows recent searches and a “search bar just got smarter” banner, not Trending now)',
  },
  'related-searches': {
    reason:
      'No Related Searches section on SERP or as query-suggestion chips; dropdown uses products/categories instead',
  },
  'barcode-api': {
    reason:
      'WLAC barcode/SKU lookup API host is not verified; Baer barcode API must not be reused',
  },
  analytics: {
    reason: 'Out of scope for this WLAC suite',
  },
  framework: {
    reason: 'Framework validation remains npm run test',
  },
};

export const SMOKE_CYCLE = {
  id: 'smoke',
  title: 'WLAC SEARCH UI DAILY SMOKE',
  displayName: 'Daily Smoke',
  purpose: 'Fast daily health check of critical Würth LAC Search UI functionality',
  defaultProjects: [PRIMARY_DESKTOP_PROJECT],
  responsiveProjects: RESPONSIVE_PROJECTS,
  browser: CYCLE_BROWSER,
  grep: '@smoke',
  responsiveGrep: '@smoke',
  moduleIds: [
    'on-type',
    'suggestions',
    'on-enter',
    'recent-searches',
    'filters',
    'runtime-errors',
    'cache-state',
    'search-input-robustness',
    'sorting',
    'barcode-scanner',
  ],
  excludedModuleIds: ['trending-now', 'related-searches'],
  artifactPrefix: 'search-ui-smoke',
  reportJson: 'reports/search-ui-smoke-report.json',
  dashboardHtml: 'reports/html/search-ui-smoke-dashboard.html',
  summaryTxt: 'reports/search-ui-smoke-summary.txt',
  failOnUnexpectedFailuresOnly: true,
  defaultModuleWorkers: 3,
  defaultPlaywrightWorkers: 2,
  defaultRetries: 1,
  expectedSmokeTestCount: null,
};

export const REGRESSION_CYCLE = {
  id: 'regression',
  title: 'WLAC SEARCH UI REGRESSION',
  displayName: 'Regression',
  purpose:
    'Comprehensive Würth LAC Search UI validation before/after releases or major changes',
  defaultProjects: [PRIMARY_DESKTOP_PROJECT],
  responsiveProjects: RESPONSIVE_PROJECTS,
  browser: CYCLE_BROWSER,
  grep: null,
  responsiveGrep: '@responsive',
  moduleIds: [
    'on-type',
    'suggestions',
    'on-enter',
    'recent-searches',
    'filters',
    'sorting',
    'runtime-errors',
    'cache-state',
    'search-input-robustness',
    'barcode-scanner',
  ],
  excludedModuleIds: ['trending-now', 'related-searches'],
  artifactPrefix: 'search-ui-regression',
  reportJson: 'reports/search-ui-regression-report.json',
  dashboardHtml: 'reports/html/search-ui-regression-dashboard.html',
  summaryTxt: 'reports/search-ui-regression-summary.txt',
  failOnUnexpectedFailuresOnly: true,
  defaultModuleWorkers: 2,
  defaultPlaywrightWorkers: 2,
  defaultRetries: 1,
};

export const CYCLES = {
  smoke: SMOKE_CYCLE,
  regression: REGRESSION_CYCLE,
};

export function resolveCycle(name) {
  const key = String(name || '').toLowerCase();
  const cycle = CYCLES[key];
  if (!cycle) {
    throw new Error(
      `Unknown cycle "${name}". Supported: ${Object.keys(CYCLES).join(', ')}`,
    );
  }
  return cycle;
}

export function resolveCycleModules(cycle) {
  const seen = new Set();
  return cycle.moduleIds.map((id) => {
    if (seen.has(id)) {
      throw new Error(`Duplicate module id in cycle config: ${id}`);
    }
    seen.add(id);
    const mod = CYCLE_MODULE_CATALOG[id];
    if (!mod) {
      throw new Error(`Cycle module "${id}" missing from CYCLE_MODULE_CATALOG`);
    }
    return mod;
  });
}

export function isKnownDefectTestId(testId) {
  if (!testId) return null;
  const id = String(testId).toUpperCase();
  return KNOWN_DEFECTS.find((d) => d.testId.toUpperCase() === id) || null;
}
