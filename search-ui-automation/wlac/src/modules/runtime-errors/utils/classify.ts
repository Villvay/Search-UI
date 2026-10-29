import {
  CONSOLE_NOISE_PATTERNS,
  IGNORED_HOST_FRAGMENTS,
  KNOWN_APPLICATION_DEFECTS,
  RUNTIME_ERRORS_BEHAVIOR,
  type RuntimeErrorClassification,
  type RuntimeErrorRecord,
} from '../data/behavior';

export function sanitizeUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (/token|secret|password|auth|api_key/i.test(key)) {
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

export function isIgnoredHost(url?: string): boolean {
  const host = hostOf(url);
  return IGNORED_HOST_FRAGMENTS.some((frag) => host.includes(frag));
}

export function classifyRuntimeError(
  record: Pick<RuntimeErrorRecord, 'type' | 'message' | 'url' | 'status'>,
): { classification: RuntimeErrorClassification; reason: string } {
  if (isIgnoredHost(record.url)) {
    return { classification: 'ignored', reason: 'third-party host' };
  }
  if (
    record.status === 401 &&
    /xcart\.wurthlac\.com\/rest\/auth\/login-check/i.test(record.url || '')
  ) {
    return {
      classification: 'ignored',
      reason: 'guest storefront auth probe (HTTP 401)',
    };
  }
  if (
    record.type === 'console-error' &&
    /401 \(Unauthorized\)/i.test(record.message)
  ) {
    return {
      classification: 'ignored',
      reason: 'browser echo of guest auth 401',
    };
  }
  if (record.type === 'console-error') {
    for (const noise of CONSOLE_NOISE_PATTERNS) {
      if (noise.match.test(record.message)) {
        return { classification: 'ignored', reason: noise.reason };
      }
    }
  }
  if (record.type === 'request-failure' && /ERR_ABORTED|cancelled/i.test(record.message)) {
    return { classification: 'ignored', reason: 'aborted/cancelled request' };
  }
  for (const known of KNOWN_APPLICATION_DEFECTS) {
    if (known.match.test(record.message)) {
      return { classification: 'expected', reason: known.reason };
    }
  }
  if (
    record.status &&
    record.status >= 500 &&
    hostOf(record.url).includes(RUNTIME_ERRORS_BEHAVIOR.searchApiHostFragment)
  ) {
    return { classification: 'unexpected', reason: 'storefront API HTTP error' };
  }
  if (record.type === 'http-error' && record.status && record.status >= 400) {
    if (isIgnoredHost(record.url)) {
      return { classification: 'ignored', reason: 'third-party HTTP error' };
    }
  }
  if (record.type === 'console-error' || record.type === 'page-error') {
    return { classification: 'unexpected', reason: 'page/console error' };
  }
  if (record.type === 'http-error' && (record.status ?? 0) >= 400) {
    return { classification: 'unexpected', reason: `HTTP ${record.status}` };
  }
  if (record.type === 'request-failure') {
    return { classification: 'unexpected', reason: 'request failed' };
  }
  return { classification: 'ignored', reason: 'unclassified noise' };
}

export function unexpected(records: RuntimeErrorRecord[]): RuntimeErrorRecord[] {
  const filtered = records.filter((r) => r.classification === 'unexpected');
  if (RUNTIME_ERRORS_BEHAVIOR.strict) {
    return records.filter((r) => r.classification !== 'ignored');
  }
  return filtered;
}
