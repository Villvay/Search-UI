export const RUNTIME_ERRORS_BEHAVIOR = {
  uiSettleTimeoutMs: 30_000,
  get strict(): boolean {
    const raw = (process.env.RUNTIME_ERRORS_STRICT || '').trim();
    return raw === '1' || raw.toLowerCase() === 'true';
  },
  searchApiHostFragment: 'xcart.wurthlac.com',
  searchApiPaths: ['/search', '/api'] as const,
  storefrontSearchPath: '/search',
} as const;

export type RuntimeErrorType =
  | 'console-error'
  | 'page-error'
  | 'request-failure'
  | 'http-error';

export type RuntimeErrorClassification = 'unexpected' | 'expected' | 'ignored';

export type RuntimeErrorRecord = {
  type: RuntimeErrorType;
  classification: RuntimeErrorClassification;
  reason: string;
  message: string;
  url?: string;
  status?: number;
  timestamp: string;
  query?: string;
  viewport?: string;
  browser?: string;
};

export const IGNORED_HOST_FRAGMENTS = [
  'cdn.acsbapp.com',
  'acsbapp.com',
  'connect.facebook.net',
  'facebook.com',
  'hubspot',
  'elfsight',
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'clarity.ms',
  'bing.com',
  'hotjar.com',
  'sentry.io',
  'newrelic.com',
] as const;

export const KNOWN_APPLICATION_DEFECTS: ReadonlyArray<{
  match: RegExp;
  reason: string;
}> = [
  {
    match: /Minified React error #418/i,
    reason: 'React hydration mismatch (#418) observed on storefront load',
  },
  {
    match: /Hydration failed|Text content does not match server-rendered HTML/i,
    reason: 'Hydration warning/error on storefront load',
  },
];

/**
 * Browser console noise that is not a Search UI functional failure.
 * Do not use this list to swallow arbitrary console errors.
 */
export const CONSOLE_NOISE_PATTERNS: ReadonlyArray<{
  match: RegExp;
  reason: string;
}> = [
  {
    match: /Content-Security-Policy:\s*\(Report-Only policy\)/i,
    reason:
      'Firefox logs CSP Report-Only violations as console errors; the policy does not block execution',
  },
  {
    match: /Cookie .+ has been rejected for invalid domain/i,
    reason: 'Firefox third-party cookie rejection, not a Search UI error',
  },
];
