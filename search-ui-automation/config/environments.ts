/**
 * Environment URLs for the Würth Baer Supply (WBS) Search UI.
 *
 * Select with ENV=qa|staging|production (default: qa).
 * Override any environment URL with BASE_URL without changing test code.
 *
 * Credentials must never be stored here — use .env (gitignored) or CI secrets.
 */

export type EnvironmentName = 'qa' | 'staging' | 'production';

export type EnvironmentConfig = {
  name: EnvironmentName;
  baseURL: string;
  /** Relative path used when opening the storefront entry for search. */
  homePath: string;
  /** Relative path of the search results page (query param: q). */
  searchPath: string;
};

const ENVIRONMENT_DEFAULTS: Record<EnvironmentName, EnvironmentConfig> = {
  qa: {
    name: 'qa',
    baseURL: 'https://qa-baersupply.vercel.app',
    homePath: '/',
    searchPath: '/search',
  },
  /**
   * Staging URL is configurable. Set BASE_URL when ENV=staging if the
   * default host differs in your deployment topology.
   */
  staging: {
    name: 'staging',
    baseURL: 'https://shop.wurthbaerusa.com',
    homePath: '/',
    searchPath: '/search',
  },
  production: {
    name: 'production',
    baseURL: 'https://wurthbaersupply.com',
    homePath: '/',
    searchPath: '/search',
  },
};

function resolveEnvironmentName(raw: string | undefined): EnvironmentName {
  const value = (raw ?? 'qa').trim().toLowerCase();
  if (value === 'qa' || value === 'staging' || value === 'production') {
    return value;
  }
  throw new Error(
    `Unsupported ENV="${raw}". Use one of: qa, staging, production.`,
  );
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const name = resolveEnvironmentName(process.env.ENV);
  const defaults = ENVIRONMENT_DEFAULTS[name];
  // Empty string from CI vars must not override defaults (?? only skips null/undefined).
  const override = process.env.BASE_URL?.trim();
  const baseURL = (override || defaults.baseURL).replace(/\/$/, '');

  return {
    ...defaults,
    baseURL,
  };
}

/** Label reports from the live host, not only ENV (BASE_URL can point at production). */
export function getEnvironmentLabel(config = getEnvironmentConfig()): EnvironmentName {
  try {
    const host = new URL(config.baseURL).hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'wurthbaersupply.com') return 'production';
    if (host === 'qa-baersupply.vercel.app') return 'qa';
  } catch {
    // keep ENV name
  }
  return config.name;
}

/**
 * User-Agent recognized by WBS Vercel edge to skip the Security Checkpoint.
 * Applied on every browser context (headers + Playwright userAgent).
 * QA allowlists this UA; production typically also needs Protection Bypass
 * (`VERCEL_AUTOMATION_BYPASS_SECRET_PROD`) because prod is a separate Vercel project.
 */
export const AUTOMATION_USER_AGENT = 'jmter-elastic-search';

export function getAutomationUserAgent(): string {
  return AUTOMATION_USER_AGENT;
}

/**
 * Resolve the Vercel Protection Bypass for Automation secret for the active target.
 *
 * Prefer env-specific secrets so QA and production (different Vercel projects)
 * can use different bypass tokens:
 * - production → VERCEL_AUTOMATION_BYPASS_SECRET_PROD || VERCEL_AUTOMATION_BYPASS_SECRET
 * - qa/staging → VERCEL_AUTOMATION_BYPASS_SECRET_QA || VERCEL_AUTOMATION_BYPASS_SECRET
 */
export function getVercelBypassSecret(): string | undefined {
  const env = getEnvironmentLabel();
  if (env === 'production') {
    return (
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET_PROD?.trim() ||
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ||
      undefined
    );
  }
  return (
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET_QA?.trim() ||
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ||
    undefined
  );
}

/** Short diagnostic for checkpoint failures (never logs the secret value). */
export function describeVercelBypassConfig(): string {
  const env = getEnvironmentLabel();
  const hasSecret = Boolean(getVercelBypassSecret());
  const secretHint =
    env === 'production'
      ? 'VERCEL_AUTOMATION_BYPASS_SECRET_PROD (or VERCEL_AUTOMATION_BYPASS_SECRET)'
      : 'VERCEL_AUTOMATION_BYPASS_SECRET (or VERCEL_AUTOMATION_BYPASS_SECRET_QA)';
  return `ENV=${env}; User-Agent=${AUTOMATION_USER_AGENT}; bypassSecret=${hasSecret ? 'set' : `missing — set ${secretHint}`}`;
}

/**
 * HTTP headers applied to every Playwright request.
 * Always includes the automation User-Agent checkpoint bypass.
 * When a bypass secret is set, also sends official Vercel protection-bypass
 * headers (and sets the bypass cookie) — required for production Protection /
 * Bot Challenge when the UA allowlist is QA-only.
 */
export function getVercelBypassHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': AUTOMATION_USER_AGENT,
  };

  const secret = getVercelBypassSecret();
  if (secret) {
    headers['x-vercel-protection-bypass'] = secret;
    // samesitenone helps WebKit/Safari persist the bypass cookie.
    headers['x-vercel-set-bypass-cookie'] = 'samesitenone';
  }

  return headers;
}

/**
 * Appends Vercel automation bypass as query params.
 * WebKit sometimes fails header-only bypass / bot checks; query + cookie
 * redirect is the documented fallback for browser automation.
 * Also required for production when header-only bypass is stripped.
 */
export function withVercelBypassQuery(pathOrUrl: string): string {
  const secret = getVercelBypassSecret();
  if (!secret) {
    return pathOrUrl;
  }

  const isAbsolute = /^https?:\/\//i.test(pathOrUrl);
  const url = isAbsolute
    ? new URL(pathOrUrl)
    : new URL(pathOrUrl, 'http://local.invalid');

  if (!url.searchParams.has('x-vercel-protection-bypass')) {
    url.searchParams.set('x-vercel-protection-bypass', secret);
  }
  if (!url.searchParams.has('x-vercel-set-bypass-cookie')) {
    url.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
  }

  if (isAbsolute) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
