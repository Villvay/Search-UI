import type { APIRequestContext } from '@playwright/test';
import {
  AUTOMATION_USER_AGENT,
  getEnvironmentConfig,
  getEnvironmentLabel,
} from '../../../../config/environments';
import {
  BARCODE_API_URLS,
  BARCODE_NAVIGATION_BEHAVIOR,
} from '../data/behavior';

export type BarcodeLookupResult = {
  sku: string;
  url: string;
  httpStatus: number;
  payload: Record<string, unknown> | null;
  error: string;
  elapsedMs: number;
};

function resolveBarcodeApiUrl(): string {
  const override = (
    process.env.BARCODE_API_URL ||
    process.env.SEARCH_API_URL ||
    process.env.BASE_URL ||
    ''
  ).trim();
  if (override) {
    const cleaned = override.replace(/\/$/, '');
    if (cleaned.endsWith('/search')) {
      return `${cleaned.slice(0, -'/search'.length)}/barcode`;
    }
    if (cleaned.endsWith('/barcode')) return cleaned;
    // Storefront BASE_URL override should not become the barcode host.
    if (/^https?:\/\/(qa-)?.*baer/i.test(cleaned) && !cleaned.includes('search-api')) {
      // fall through to ENV mapping
    } else if (cleaned.includes('search-api') || cleaned.includes('/barcode')) {
      return cleaned;
    }
  }
  const env = getEnvironmentLabel();
  if (env === 'production') return BARCODE_API_URLS.production;
  return BARCODE_API_URLS.qa;
}

export async function lookupBarcode(
  request: APIRequestContext,
  sku: string,
): Promise<BarcodeLookupResult> {
  const apiUrl = resolveBarcodeApiUrl();
  const url = `${apiUrl}?query=${encodeURIComponent(sku)}`;
  const referer = `${getEnvironmentConfig().baseURL}/`;
  const started = Date.now();

  try {
    const response = await request.get(url, {
      timeout: BARCODE_NAVIGATION_BEHAVIOR.requestTimeoutMs,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': AUTOMATION_USER_AGENT,
        Referer: referer,
      },
    });
    const httpStatus = response.status();
    const body = await response.text();
    const elapsedMs = Date.now() - started;
    if (!body.trim()) {
      return {
        sku,
        url,
        httpStatus,
        payload: null,
        error: 'Empty response',
        elapsedMs,
      };
    }
    try {
      const parsed = JSON.parse(body) as unknown;
      const payload =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : { data: parsed };
      return { sku, url, httpStatus, payload, error: '', elapsedMs };
    } catch {
      return {
        sku,
        url,
        httpStatus,
        payload: null,
        error: 'Invalid response',
        elapsedMs,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = /timeout|timed out/i.test(message);
    return {
      sku,
      url,
      httpStatus: 0,
      payload: null,
      error: timedOut ? 'Timeout' : message || 'Unexpected error',
      elapsedMs: Date.now() - started,
    };
  }
}
