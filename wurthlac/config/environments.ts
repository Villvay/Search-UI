/**
 * Environment URLs for the Würth LAC / Louis & Company Search UI.
 *
 * Select with ENV=qa|staging|production (default: qa).
 * Override any environment URL with BASE_URL without changing test code.
 *
 * Default QA is the public storefront https://wurthlac.com as specified for this project.
 * Staging and production hosts are not invented — provide BASE_URL when using those ENV values.
 *
 * Credentials must never be stored here — use .env (gitignored) or CI secrets.
 */

export type EnvironmentName = 'qa' | 'staging' | 'production';

export type EnvironmentConfig = {
  name: EnvironmentName;
  baseURL: string;
  homePath: string;
  searchPath: string;
};

const ENVIRONMENT_DEFAULTS: Record<
  EnvironmentName,
  Omit<EnvironmentConfig, 'baseURL'> & { baseURL?: string }
> = {
  qa: {
    name: 'qa',
    baseURL: 'https://wurthlac.com',
    homePath: '/',
    searchPath: '/search',
  },
  staging: {
    name: 'staging',
    homePath: '/',
    searchPath: '/search',
  },
  production: {
    name: 'production',
    homePath: '/',
    searchPath: '/search',
  },
};

const BAER_HOST_HINTS = [
  'wurthbaersupply.com',
  'qa-baersupply.vercel.app',
  'shop.wurthbaerusa.com',
  'wurthbaer',
];

function resolveEnvironmentName(raw: string | undefined): EnvironmentName {
  const value = (raw ?? 'qa').trim().toLowerCase();
  if (value === 'qa' || value === 'staging' || value === 'production') {
    return value;
  }
  throw new Error(
    `Unsupported ENV="${raw}". Use one of: qa, staging, production.`,
  );
}

function assertNotBaerHost(baseURL: string): void {
  let host = '';
  try {
    host = new URL(baseURL).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    throw new Error(`WLAC suite BASE_URL is not a valid URL: "${baseURL}"`);
  }
  if (BAER_HOST_HINTS.some((hint) => host.includes(hint))) {
    throw new Error(
      `WLAC suite refused to run against a Würth Baer host (${host}). ` +
        `Set BASE_URL to a Louis & Company / Würth LAC origin such as https://wurthlac.com.`,
    );
  }
}

function assertWlacHost(baseURL: string): void {
  assertNotBaerHost(baseURL);
  try {
    const host = new URL(baseURL).hostname.replace(/^www\./, '').toLowerCase();
    const looksLikeWlac =
      host === 'wurthlac.com' ||
      host.includes('wurthlac') ||
      host.includes('wurth-lac');
    if (!looksLikeWlac) {
      throw new Error(
        `WLAC suite BASE_URL host "${host}" is not a known Würth LAC host. ` +
          `Use https://wurthlac.com or a wurthlac / wurth-lac preview origin.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('WLAC suite')) {
      throw error;
    }
    throw new Error(`WLAC suite BASE_URL is not a valid URL: "${baseURL}"`);
  }
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const name = resolveEnvironmentName(process.env.ENV);
  const defaults = ENVIRONMENT_DEFAULTS[name];
  const override = process.env.BASE_URL?.trim();
  const baseURL = (override || defaults.baseURL || '').replace(/\/$/, '');

  if (!baseURL) {
    throw new Error(
      `ENV=${name} has no default host. Set BASE_URL to the correct Würth LAC origin. ` +
        `Staging and production URLs are not hard-coded in this project.`,
    );
  }

  assertWlacHost(baseURL);

  return {
    name,
    baseURL,
    homePath: defaults.homePath,
    searchPath: defaults.searchPath,
  };
}

export function getEnvironmentLabel(
  config = getEnvironmentConfig(),
): EnvironmentName {
  try {
    const host = new URL(config.baseURL).hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'wurthlac.com') return config.name;
  } catch {
    // keep ENV name
  }
  return config.name;
}

export function isPreviewTarget(config = getEnvironmentConfig()): boolean {
  try {
    const host = new URL(config.baseURL).hostname.toLowerCase();
    return host.includes('vercel.app') || host.includes('wurth-lac-git');
  } catch {
    return false;
  }
}

/**
 * Public wurthlac.com does not require the Baer automation User-Agent.
 * Preview hosts may still send an optional Vercel bypass secret.
 */
export function usesLegitimateBrowserProfile(): boolean {
  return !isPreviewTarget();
}

export function resolveHeadlessPreference(): boolean {
  const raw = process.env.HEADLESS?.trim()?.toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;

  const headedFlag = process.env.HEADED?.trim()?.toLowerCase();
  if (headedFlag === '1' || headedFlag === 'true') {
    return false;
  }
  return true;
}

export function getAutomationUserAgent(): string | undefined {
  return undefined;
}

export function getVercelBypassSecret(): string | undefined {
  return (
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET_QA?.trim() ||
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ||
    undefined
  );
}

export function describeVercelBypassConfig(): string {
  const env = getEnvironmentLabel();
  const hasSecret = Boolean(getVercelBypassSecret());
  return `ENV=${env}; preview=${isPreviewTarget()}; bypassSecret=${hasSecret ? 'set' : 'unset'}`;
}

export function getVercelBypassHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const secret = getVercelBypassSecret();
  if (secret && isPreviewTarget()) {
    headers['x-vercel-protection-bypass'] = secret;
    headers['x-vercel-set-bypass-cookie'] = 'samesitenone';
  }
  return headers;
}

export function withVercelBypassQuery(pathOrUrl: string): string {
  const secret = getVercelBypassSecret();
  if (!secret || !isPreviewTarget()) {
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
