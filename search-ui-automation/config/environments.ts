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
    baseURL: 'https://wurthbaersupply.com',
    homePath: '/',
    searchPath: '/search',
  },
  production: {
    name: 'production',
    baseURL: 'https://shop.wurthbaerusa.com',
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
  const baseURL = (process.env.BASE_URL ?? defaults.baseURL).replace(/\/$/, '');

  return {
    ...defaults,
    baseURL,
  };
}

export function getVercelBypassSecret(): string | undefined {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  return secret || undefined;
}

export function getVercelBypassHeaders(): Record<string, string> {
  const secret = getVercelBypassSecret();
  if (!secret) {
    return {};
  }

  return {
    'x-vercel-protection-bypass': secret,
    // samesitenone helps WebKit/Safari persist the bypass cookie.
    'x-vercel-set-bypass-cookie': 'samesitenone',
  };
}

/**
 * Appends Vercel automation bypass as query params.
 * WebKit sometimes fails header-only bypass / bot checks; query + cookie
 * redirect is the documented fallback for browser automation.
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
