/**
 * Runtime error monitoring — QA-inspected classification & endpoints.
 */
export const RUNTIME_ERRORS_BEHAVIOR = {
  uiSettleTimeoutMs: 30_000,
  suggestionsVisibleTimeoutMs: 15_000,
  /**
   * When true (RUNTIME_ERRORS_STRICT=1), EXPECTED known defects also fail tests.
   */
  get strict(): boolean {
    const raw = (process.env.RUNTIME_ERRORS_STRICT || '').trim();
    return raw === '1' || raw.toLowerCase() === 'true';
  },
  searchApiHostFragment: 'search-villvay.workers.dev',
  searchApiPaths: ['/trending', '/suggestions', '/multisearch'] as const,
  storefrontSearchPath: '/search',
} as const;

export type RuntimeErrorType =
  | 'console-error'
  | 'console-warn'
  | 'page-error'
  | 'request-failure'
  | 'http-error';

export type RuntimeErrorClassification =
  | 'unexpected'
  | 'expected'
  | 'ignored';

export type RuntimeErrorRecord = {
  type: RuntimeErrorType;
  classification: RuntimeErrorClassification;
  reason: string;
  message: string;
  url?: string;
  method?: string;
  status?: number;
  resourceType?: string;
  timestamp: string;
  query?: string;
  viewport?: string;
  browser?: string;
  stack?: string;
};

/** Third-party / tracking hosts that must not fail Search UI monitoring. */
export const IGNORED_HOST_FRAGMENTS = [
  'cdn.acsbapp.com',
  'acsbapp.com',
  'connect.facebook.net',
  'facebook.com',
  'facebook.net',
  'api.hubapi.com',
  'hs-analytics',
  'hs-scripts',
  'hscollectedforms',
  'hubspot',
  'core.service.elfsight.com',
  'elfsightcdn.com',
  'elfsight.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googleadservices.com',
  'doubleclick.net',
  'providesupport.com',
  'callrail',
  'calltrk',
  'clarity.ms',
  'bing.com',
  'bat.bing.com',
  'hotjar.com',
  'sentry.io',
  'fullstory.com',
  'segment.com',
  'segment.io',
  'newrelic.com',
  'nr-data.net',
] as const;

/**
 * Known QA application defects — reported as EXPECTED (fail only in strict mode).
 * Confirmed: React hydration #418 fires as pageerror on storefront load.
 */
export const KNOWN_APPLICATION_DEFECTS: ReadonlyArray<{
  match: RegExp;
  reason: string;
}> = [
  {
    match: /Minified React error #418/i,
    reason:
      'Known QA React hydration mismatch (#418) on page load — application defect under observation',
  },
  {
    match: /Hydration failed|Text content does not match server-rendered HTML/i,
    reason: 'Known QA hydration warning/error — application defect under observation',
  },
];

export const CONSOLE_NOISE_PATTERNS: ReadonlyArray<{
  match: RegExp;
  reason: string;
}> = [
  {
    match: /Failed to load resource: the server responded with a status of 4\d\d/i,
    reason: 'Browser echo of HTTP 4xx resource load (classified via network rules when possible)',
  },
  {
    match: /net::ERR_/i,
    reason: 'Browser network diagnostic often tied to third-party/aborted requests',
  },
];
