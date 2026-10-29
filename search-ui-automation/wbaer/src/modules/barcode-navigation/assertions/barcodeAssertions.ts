import { expect, type TestInfo } from '@playwright/test';
import { BARCODE_NAVIGATION_BEHAVIOR } from '../data/behavior';
import type { BarcodeLookupResult } from '../utils/barcodeApi';

function deepGet(payload: Record<string, unknown> | null, ...paths: string[]): unknown {
  if (!payload) return undefined;
  for (const path of paths) {
    let cur: unknown = payload;
    let ok = true;
    for (const part of path.split('.')) {
      if (cur && typeof cur === 'object' && part in (cur as object)) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && cur != null) return cur;
  }
  return undefined;
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase());
  }
  return false;
}

function asInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function extractPlpProduct(
  payload: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const product = deepGet(payload, 'results.plpProduct', 'plpProduct');
  if (product && typeof product === 'object' && !Array.isArray(product)) {
    return product as Record<string, unknown>;
  }
  const products = deepGet(payload, 'results.products', 'products');
  if (Array.isArray(products) && products.length > 0) {
    const first = products[0];
    if (first && typeof first === 'object') return first as Record<string, unknown>;
  }
  return null;
}

function extractProductFields(product: Record<string, unknown> | null): {
  productId: string;
  productName: string;
} {
  if (!product) return { productId: '', productName: '' };
  const productId = String(
    product.materialNumber ||
      product.id ||
      product.sapId ||
      product.MFRPartNo ||
      '',
  );
  const productName = String(
    product.primaryProductTitle ||
      product.productTitle ||
      product.groupName ||
      product.name ||
      '',
  );
  return { productId, productName };
}

export type BarcodeValidation = {
  status: 'PASS' | 'FAIL';
  reason: string;
  httpStatus: number;
  totalResults: number;
  plp: boolean;
  productId: string;
  productName: string;
};

export function validateBarcodeLookup(result: BarcodeLookupResult): BarcodeValidation {
  const { httpStatus, payload, error } = result;
  const errorLower = (error || '').toLowerCase();

  if (errorLower === 'timeout' || errorLower.includes('timed out')) {
    return fail('Timeout', httpStatus);
  }
  if (errorLower === 'invalid response' || errorLower.includes('invalid')) {
    return fail('Invalid response', httpStatus);
  }
  if (errorLower === 'empty response') {
    return fail('Empty response', httpStatus);
  }
  if (httpStatus === 0) {
    return fail(error || 'Unexpected error', httpStatus);
  }
  if (httpStatus !== 200) {
    const reason = error.startsWith('HTTP ') ? error : `HTTP ${httpStatus}`;
    return fail(reason, httpStatus);
  }
  if (!payload) {
    return fail('Empty response', httpStatus);
  }

  const summary =
    payload.summary && typeof payload.summary === 'object'
      ? (payload.summary as Record<string, unknown>)
      : {};
  let total = asInt(summary.total);
  if (total == null) total = asInt(deepGet(payload, 'total'));
  total = total ?? 0;

  const plp = asBool(summary.plp) || asBool(deepGet(payload, 'plp'));
  const product = extractPlpProduct(payload);
  const { productId, productName } = extractProductFields(product);

  if (total === 0) {
    return fail('No product returned', httpStatus, { total, plp });
  }
  if (total !== BARCODE_NAVIGATION_BEHAVIOR.expectedTotal) {
    return fail(`Expected 1 product, got ${total}`, httpStatus, {
      total,
      plp,
      productId,
      productName,
    });
  }
  if (!plp) {
    return fail('Response does not indicate direct product navigation', httpStatus, {
      total,
      plp,
      productId,
      productName,
    });
  }
  if (!product) {
    return fail('Product missing', httpStatus, { total, plp });
  }

  return {
    status: 'PASS',
    reason: '',
    httpStatus,
    totalResults: total,
    plp,
    productId,
    productName,
  };
}

function fail(
  reason: string,
  httpStatus: number,
  extra: {
    total?: number;
    plp?: boolean;
    productId?: string;
    productName?: string;
  } = {},
): BarcodeValidation {
  return {
    status: 'FAIL',
    reason,
    httpStatus,
    totalResults: extra.total ?? 0,
    plp: extra.plp ?? false,
    productId: extra.productId ?? '',
    productName: extra.productName ?? '',
  };
}

export function annotateBarcode(
  testInfo: TestInfo,
  fields: Record<string, string>,
): void {
  for (const [type, description] of Object.entries(fields)) {
    testInfo.annotations.push({ type, description });
  }
}

export function expectBarcodeNavigatesToPlp(
  result: BarcodeLookupResult,
  testInfo?: TestInfo,
): BarcodeValidation {
  const validation = validateBarcodeLookup(result);
  if (testInfo) {
    annotateBarcode(testInfo, {
      sku: result.sku,
      httpStatus: String(validation.httpStatus),
      productId: validation.productId || '(none)',
      productName: (validation.productName || '(none)').slice(0, 120),
      elapsedMs: String(result.elapsedMs),
      barcodeStatus: validation.status,
      reason: validation.reason || 'ok',
    });
  }
  expect(
    validation.status,
    [
      `Barcode/SKU "${result.sku}" did not navigate to a single PLP product.`,
      `HTTP ${validation.httpStatus}`,
      validation.reason || 'unknown',
      `URL: ${result.url}`,
    ].join(' | '),
  ).toBe('PASS');
  return validation;
}
