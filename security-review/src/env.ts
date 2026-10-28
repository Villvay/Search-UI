export type EnvironmentName = 'qa' | 'staging' | 'production';

const ENVIRONMENT_URLS: Record<EnvironmentName, string> = {
  qa: 'https://qa-baersupply.vercel.app',
  staging: 'https://shop.wurthbaerusa.com',
  production: 'https://wurthbaersupply.com',
};

export const AUTOMATION_USER_AGENT = 'jmter-elastic-search';

function envName(): EnvironmentName {
  const value = (process.env.ENV ?? 'qa').trim().toLowerCase();
  if (value === 'staging' || value === 'production') return value;
  return 'qa';
}

export function resolveDefaultBaseURL(): string {
  const override = process.env.BASE_URL?.trim();
  return (override || ENVIRONMENT_URLS[envName()]).replace(/\/$/, '');
}

function isProductionTarget(): boolean {
  try {
    const host = new URL(resolveDefaultBaseURL()).hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'wurthbaersupply.com') return true;
  } catch {
    // fall through to ENV
  }
  return envName() === 'production';
}

export function resolveHeadlessPreference(): boolean {
  const raw = process.env.HEADLESS?.trim()?.toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;

  const headedFlag = process.env.HEADED?.trim()?.toLowerCase();
  if (headedFlag === '1' || headedFlag === 'true') return false;

  return !isProductionTarget();
}

export function getAutomationUserAgent(): string | undefined {
  if (isProductionTarget()) return undefined;
  return AUTOMATION_USER_AGENT;
}

export function getVercelBypassHeaders(): Record<string, string> {
  if (isProductionTarget()) return {};

  const headers: Record<string, string> = {
    'User-Agent': AUTOMATION_USER_AGENT,
  };

  const secret =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET_QA?.trim() ||
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (secret) {
    headers['x-vercel-protection-bypass'] = secret;
    headers['x-vercel-set-bypass-cookie'] = 'samesitenone';
  }

  return headers;
}
