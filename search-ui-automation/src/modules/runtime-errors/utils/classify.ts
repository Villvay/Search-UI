import {
  CONSOLE_NOISE_PATTERNS,
  IGNORED_HOST_FRAGMENTS,
  KNOWN_APPLICATION_DEFECTS,
  RUNTIME_ERRORS_BEHAVIOR,
  type RuntimeErrorClassification,
  type RuntimeErrorRecord,
  type RuntimeErrorType,
} from '../data/behavior';

const SENSITIVE_QUERY_KEYS = [
  'token',
  'access_token',
  'auth',
  'authorization',
  'password',
  'secret',
  'api_key',
  'apikey',
  'session',
  'cookie',
];

/** Strip sensitive query params and truncate. */
export function sanitizeUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.some((s) => key.toLowerCase().includes(s))) {
        url.searchParams.set(key, '[redacted]');
      }
    }
    const out = url.toString();
    return out.length > 400 ? `${out.slice(0, 400)}…` : out;
  } catch {
    return String(raw).slice(0, 400);
  }
}

export function sanitizeMessage(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
    .replace(/password[=:]\s*\S+/gi, 'password=[redacted]')
    .slice(0, 500);
}

function hostOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

function pathOf(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

export function isIgnoredHost(url?: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return IGNORED_HOST_FRAGMENTS.some((frag) => host.includes(frag));
}

export function isSearchApiUrl(url?: string): boolean {
  if (!url) return false;
  const host = hostOf(url);
  const path = pathOf(url);
  if (host.includes(RUNTIME_ERRORS_BEHAVIOR.searchApiHostFragment)) {
    return RUNTIME_ERRORS_BEHAVIOR.searchApiPaths.some((p) =>
      path.startsWith(p),
    );
  }
  return false;
}

export function isFirstPartyStorefrontUrl(
  url: string | undefined,
  baseURL: string,
): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const base = new URL(baseURL);
    return u.host === base.host;
  } catch {
    return false;
  }
}

export function classifyRuntimeError(input: {
  type: RuntimeErrorType;
  message: string;
  url?: string;
  status?: number;
  baseURL: string;
}): { classification: RuntimeErrorClassification; reason: string } {
  const { type, message, url, status, baseURL } = input;

  for (const known of KNOWN_APPLICATION_DEFECTS) {
    if (known.match.test(message)) {
      return { classification: 'expected', reason: known.reason };
    }
  }

  if (url && isIgnoredHost(url)) {
    return {
      classification: 'ignored',
      reason: 'known non-search third-party / tracking host',
    };
  }

  if (type === 'console-error' || type === 'console-warn') {
    for (const noise of CONSOLE_NOISE_PATTERNS) {
      if (noise.match.test(message)) {
        return { classification: 'ignored', reason: noise.reason };
      }
    }
  }

  if (type === 'http-error' || type === 'request-failure') {
    if (isSearchApiUrl(url)) {
      return {
        classification: 'unexpected',
        reason: 'Search UI API failure',
      };
    }
    if (
      isFirstPartyStorefrontUrl(url, baseURL) &&
      pathOf(url).startsWith(RUNTIME_ERRORS_BEHAVIOR.storefrontSearchPath)
    ) {
      return {
        classification: 'unexpected',
        reason: 'First-party /search document or RSC failure',
      };
    }
    if (isFirstPartyStorefrontUrl(url, baseURL)) {
      // First-party non-search 404s (e.g. missing static) — report but ignore by default
      if (status && status >= 500) {
        return {
          classification: 'unexpected',
          reason: 'First-party HTTP 5xx',
        };
      }
      return {
        classification: 'ignored',
        reason: 'First-party non-search HTTP error (not Search API)',
      };
    }
    return {
      classification: 'ignored',
      reason: 'Non-search third-party or unclassified network error',
    };
  }

  if (type === 'page-error') {
    return {
      classification: 'unexpected',
      reason: 'Uncaught page error',
    };
  }

  if (type === 'console-error') {
    return {
      classification: 'unexpected',
      reason: 'Console error',
    };
  }

  // console-warn
  return {
    classification: 'ignored',
    reason: 'Console warning (informational; does not fail by default)',
  };
}

export function summarizeRecords(records: RuntimeErrorRecord[]) {
  const summary = {
    consoleErrors: 0,
    consoleWarns: 0,
    pageErrors: 0,
    requestFailures: 0,
    http4xx: 0,
    http5xx: 0,
    unexpected: 0,
    expected: 0,
    ignored: 0,
  };
  for (const r of records) {
    if (r.type === 'console-error') summary.consoleErrors += 1;
    if (r.type === 'console-warn') summary.consoleWarns += 1;
    if (r.type === 'page-error') summary.pageErrors += 1;
    if (r.type === 'request-failure') summary.requestFailures += 1;
    if (r.type === 'http-error' && r.status && r.status >= 400 && r.status < 500) {
      summary.http4xx += 1;
    }
    if (r.type === 'http-error' && r.status && r.status >= 500) {
      summary.http5xx += 1;
    }
    if (r.classification === 'unexpected') summary.unexpected += 1;
    if (r.classification === 'expected') summary.expected += 1;
    if (r.classification === 'ignored') summary.ignored += 1;
  }
  return summary;
}
