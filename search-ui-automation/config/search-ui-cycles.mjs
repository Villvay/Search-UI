/**
 * Search UI test-cycle configuration.
 *
 * Explicit smoke vs regression orchestration — does not redefine module tests.
 * Paths and IDs are taken from modules present in this repository.
 *
 * Audit notes (production readiness):
 * - Smoke discovery: 29 unique @smoke tests × desktop-1440 only (no Chromium alias dupes).
 * - Each module is a single spec path; module-level parallel processes do not re-run the same file.
 * - Analytics / sku-plp-cache / framework are excluded from both cycles.
 * - Responsive runs only when --responsive or SMOKE_RESPONSIVE=1.
 */

/** Canonical Playwright projects for responsive coverage. */
export const RESPONSIVE_PROJECTS = [
  'desktop-1440',
  'desktop-1280',
  'tablet-1024',
  'tablet-768',
  'mobile-390',
  'mobile-375',
];

/** Primary desktop project for daily smoke / standard regression. */
export const PRIMARY_DESKTOP_PROJECT = 'desktop-1440';

/** Browser label for cycle reports (projects are Chromium unless otherwise noted). */
export const CYCLE_BROWSER = 'Chromium';

/**
 * Module catalog used by cycle runners (mirrors functional suite paths).
 * Analytics and sku-plp-cache are intentionally excluded from Search UI cycles.
 * Paths point at specific functional specs (never analytics sibling specs).
 */
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
  'trending-now': {
    id: 'trending-now',
    label: 'Trending Now',
    shortLabel: 'TRENDING',
    path: 'src/modules/trending-now/tests/trending-now.spec.ts',
    reportModule: 'TRENDING NOW',
  },
  'recent-searches': {
    id: 'recent-searches',
    label: 'Recent Searches',
    shortLabel: 'RECENT',
    path: 'src/modules/recent-searches/tests/recent-searches.spec.ts',
    reportModule: 'RECENT SEARCHES',
  },
  'on-enter': {
    id: 'on-enter',
    label: 'On-Enter',
    shortLabel: 'ON-ENTER',
    /** Explicit file — excludes on-enter-analytics.spec.ts */
    path: 'src/modules/on-enter/tests/on-enter.spec.ts',
    reportModule: 'ON-ENTER',
  },
  'related-searches': {
    id: 'related-searches',
    label: 'Related Searches',
    shortLabel: 'RELATED',
    path: 'src/modules/related-searches/tests/related-searches.spec.ts',
    reportModule: 'RELATED SEARCHES',
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
};

/**
 * Documented known defects — still executed; classified in cycle reports.
 * Do not convert these into passes; do not weaken assertions.
 * Known defects alone do NOT fail the cycle exit code.
 */
export const KNOWN_DEFECTS = [
  {
    testId: 'CACHE-005',
    moduleId: 'cache-state',
    reportModule: 'CACHE & STATE',
    reason:
      'Browser back/forward updates URL q but SERP input/heading/products stay on previous query (SPA history vs React state).',
  },
];

/**
 * Reliability notes for orchestration (NOT known product defects).
 * Keep as unexpected failures until product confirms a defect.
 *
 * ENTER-009: resolved 2026-09-09 — root cause was obsolete no-result fixture
 * (`zzzznonexistentproduct12345` now returns fuzzy Search API hits). Fixture
 * replaced with a QA-verified zero-hit query; do not reclassify as known defect.
 */
export const RELIABILITY_NOTES = [];

/**
 * Suites intentionally excluded from Search UI smoke/regression cycles.
 * Keep running via their dedicated npm scripts.
 */
export const CYCLE_EXCLUSIONS = {
  analytics: {
    reason: 'Separate analytics suite (test:analytics / test:analytics:smoke)',
  },
  'sku-plp-cache': {
    reason: 'Separate SKU/PLP cache suite (test:sku-plp)',
  },
  framework: {
    reason: 'Framework validation remains npm run test / test:search-ui',
  },
};

/**
 * Daily smoke — @smoke tests on listed modules only (desktop-1440).
 * CACHE-005 is not @smoke, so it is not part of the daily gate.
 *
 * Documented smoke test IDs (must exist in specs):
 *   ON-TYPE-001, ON-TYPE-003
 *   SUG-001, SUG-002
 *   ENTER-001, ENTER-002
 *   TREND-001, TREND-002, TREND-004
 *   RECENT-001, RECENT-002, RECENT-005, RECENT-007
 *   FILTER-001, FILTER-002, FILTER-004, FILTER-005
 *   RUNTIME-001, RUNTIME-002, RUNTIME-003
 *   CACHE-001, CACHE-002, CACHE-003, CACHE-006, CACHE-008
 *   INPUT-001, INPUT-007, INPUT-008
 *   SORT-001  (documents absent sorting UI — meaningful contract check)
 *
 * Expected discovery: 29 tests on desktop-1440.
 */
export const SMOKE_CYCLE = {
  id: 'smoke',
  title: 'SEARCH UI DAILY SMOKE',
  displayName: 'Daily Smoke',
  purpose: 'Fast daily health check of critical Search UI functionality',
  defaultProjects: [PRIMARY_DESKTOP_PROJECT],
  responsiveProjects: RESPONSIVE_PROJECTS,
  browser: CYCLE_BROWSER,
  /** Playwright grep — selects existing @smoke tests; no duplicate specs. */
  grep: '@smoke',
  /** Optional: set SMOKE_RESPONSIVE=1 or use test:smoke:responsive */
  responsiveGrep: '@smoke',
  moduleIds: [
    'on-type',
    'suggestions',
    'on-enter',
    'trending-now',
    'recent-searches',
    'filters',
    'runtime-errors',
    'cache-state',
    'search-input-robustness',
    'sorting',
  ],
  /** Not in smoke (no meaningful @smoke / unsupported feature surface). */
  excludedModuleIds: ['related-searches'],
  artifactPrefix: 'search-ui-smoke',
  reportJson: 'reports/search-ui-smoke-report.json',
  dashboardHtml: 'reports/html/search-ui-smoke-dashboard.html',
  summaryTxt: 'reports/search-ui-smoke-summary.txt',
  /** Fail cycle when unexpected failures > 0. Skips / known defects alone do not fail. */
  failOnUnexpectedFailuresOnly: true,
  /** Slightly higher module concurrency — Recent Searches dominates wall clock. */
  defaultModuleWorkers: 3,
  defaultPlaywrightWorkers: 2,
  /** One retry absorbs intermittent env blips without masking real defects. */
  defaultRetries: 1,
  expectedSmokeTestCount: 29,
};

/**
 * Full functional regression — all applicable Search UI modules.
 * Standard: desktop-1440 full modules.
 * Responsive: @responsive across six viewports.
 */
export const REGRESSION_CYCLE = {
  id: 'regression',
  title: 'SEARCH UI REGRESSION',
  displayName: 'Regression',
  purpose:
    'Comprehensive Search UI validation before/after releases or major changes',
  defaultProjects: [PRIMARY_DESKTOP_PROJECT],
  responsiveProjects: RESPONSIVE_PROJECTS,
  browser: CYCLE_BROWSER,
  grep: null,
  responsiveGrep: '@responsive',
  moduleIds: [
    'on-type',
    'suggestions',
    'trending-now',
    'recent-searches',
    'on-enter',
    'related-searches',
    'filters',
    'sorting',
    'runtime-errors',
    'cache-state',
    'search-input-robustness',
  ],
  excludedModuleIds: [],
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
