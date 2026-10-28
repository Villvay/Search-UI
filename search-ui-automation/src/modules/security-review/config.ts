import path from 'path';
import { getEnvironmentConfig } from '../../../config/environments';

export type FailOnLevel = 'none' | 'critical' | 'high' | 'medium' | 'all';

export type SecurityReviewConfig = {
  baseURL: string;
  extraPaths: string[];
  maxPages: number;
  maxScripts: number;
  navigationTimeoutMs: number;
  failOn: FailOnLevel;
  reportJsonPath: string;
  reportHtmlPath: string;
};

const DEFAULT_SEED_PATHS = [
  '/',
  '/sign-in',
  '/login',
  '/cart',
  '/robots.txt',
];

const SENSITIVE_PATHS = [
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/favicon.ico',
  '/.well-known/security.txt',
  '/.env',
  '/.git/config',
  '/admin',
  '/login',
  '/sign-in',
  '/my-account',
  '/cart',
  '/checkout',
  '/api',
  '/graphql',
  '/swagger.json',
  '/openapi.json',
];

export function loadSecurityReviewConfig(): SecurityReviewConfig {
  const env = getEnvironmentConfig();
  const override =
    argValue('url') ||
    process.env.SECURITY_REVIEW_BASE_URL?.trim() ||
    process.env.BASE_URL?.trim() ||
    env.baseURL;

  return {
    baseURL: stripTrailingSlash(override),
    extraPaths: uniquePaths([
      ...DEFAULT_SEED_PATHS,
      ...csvPaths(process.env.SECURITY_REVIEW_PATHS),
      ...csvPaths(argValue('paths')),
    ]),
    maxPages: intEnv('SECURITY_REVIEW_MAX_PAGES', argValue('max-pages'), 8),
    maxScripts: intEnv('SECURITY_REVIEW_MAX_SCRIPTS', argValue('max-scripts'), 12),
    navigationTimeoutMs: intEnv(
      'SECURITY_REVIEW_NAV_TIMEOUT_MS',
      argValue('nav-timeout-ms'),
      30_000,
    ),
    failOn: parseFailOn(
      argValue('fail-on') || process.env.SECURITY_REVIEW_FAIL_ON || 'high',
    ),
    reportJsonPath: path.resolve(
      process.env.SECURITY_REVIEW_JSON || 'reports/security-review.json',
    ),
    reportHtmlPath: path.resolve(
      process.env.SECURITY_REVIEW_HTML || 'reports/security-review.html',
    ),
  };
}

export function sensitiveProbePaths(): string[] {
  return [...SENSITIVE_PATHS];
}

export function absoluteUrl(baseURL: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, `${stripTrailingSlash(baseURL)}/`).toString();
}

function parseFailOn(raw: string): FailOnLevel {
  const value = raw.trim().toLowerCase();
  if (
    value === 'none' ||
    value === 'critical' ||
    value === 'high' ||
    value === 'medium' ||
    value === 'all'
  ) {
    return value;
  }
  throw new Error(
    `Unsupported SECURITY_REVIEW_FAIL_ON="${raw}". Use none|critical|high|medium|all.`,
  );
}

function intEnv(name: string, arg: string | null, fallback: number): number {
  const raw = arg || process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function csvPaths(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith('/') || /^https?:\/\//i.test(item) ? item : `/${item}`));
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  const value = hit?.slice(prefix.length).trim();
  return value || null;
}
