import { SKU_PLP_BEHAVIOR } from '../data/behavior';
import { skusMatch } from '../data/skuLoader';
import {
  classifyLanding,
  productPathKey,
  type SkuLandingKind,
} from '../pages/SkuPlpPage';

export type FailureCode =
  | 'SEARCH_FAILED'
  | 'NAVIGATION_FAILED'
  | 'URL_MISMATCH'
  | 'PLP_NOT_LOADED'
  | 'SKU_MISMATCH'
  | 'TIMEOUT'
  | 'ELEMENT_NOT_FOUND';

export type CheckResult = 'PASS' | 'FAIL';

export type PlpUrlValidation = {
  ok: boolean;
  landing: SkuLandingKind;
  expectedUrl: string;
  reason?: string;
  stalePreviousUrl: boolean;
};

/**
 * Strongest reliable URL check for this storefront:
 * - `/search?q=` must equal the searched SKU (case-insensitive)
 * - `/product/{id}/{slug}` is a valid unique-SKU landing; the SKU is not always
 *   in the path, so a product URL is invalid when it is still the previous SKU's
 *   product page after a different search
 */
export function validatePLPUrl(
  url: string,
  expectedSku: string,
  previousProductUrl?: string | null,
  previousSku?: string | null,
): PlpUrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      landing: 'unknown',
      expectedUrl: expectedSearchUrl(expectedSku),
      reason: `Unparseable URL: ${url}`,
      stalePreviousUrl: false,
    };
  }

  const landing = classifyLanding(parsed);
  const expectedSearch = expectedSearchUrl(expectedSku, parsed.origin);

  if (landing === 'search') {
    const q = parsed.searchParams.get(SKU_PLP_BEHAVIOR.queryParam) ?? '';
    const ok = skusMatch(q, expectedSku);
    return {
      ok,
      landing,
      expectedUrl: expectedSearch,
      reason: ok
        ? undefined
        : `Search URL q="${q}" does not match searched SKU "${expectedSku}"`,
      stalePreviousUrl: false,
    };
  }

  if (landing === 'product') {
    const prevKey = previousProductUrl ? productPathKey(previousProductUrl) : null;
    const currentKey = productPathKey(url);
    const stalePreviousUrl = Boolean(
      prevKey && currentKey && prevKey === currentKey,
    );
    const slugLooksLikePrevious =
      Boolean(previousSku) &&
      !skusMatch(previousSku, expectedSku) &&
      productSlugMatchesSku(parsed.pathname, previousSku) &&
      !productSlugMatchesSku(parsed.pathname, expectedSku);

    if (stalePreviousUrl || slugLooksLikePrevious) {
      return {
        ok: false,
        landing,
        expectedUrl: `product page for ${expectedSku} (not previous SKU URL)`,
        reason: stalePreviousUrl
          ? `Product URL is unchanged from the previous SKU page: ${currentKey}`
          : `Product slug still reflects previous SKU "${previousSku}", not "${expectedSku}"`,
        stalePreviousUrl: true,
      };
    }

    return {
      ok: true,
      landing,
      expectedUrl: `${parsed.origin}${SKU_PLP_BEHAVIOR.productPathPrefix}{id}/{slug}`,
      stalePreviousUrl: false,
    };
  }

  return {
    ok: false,
    landing,
    expectedUrl: expectedSearch,
    reason: `Unexpected landing path "${parsed.pathname}"`,
    stalePreviousUrl: false,
  };
}

export function expectedSearchUrl(sku: string, origin?: string): string {
  const base = origin ?? '';
  return `${base}${SKU_PLP_BEHAVIOR.searchPath}?${SKU_PLP_BEHAVIOR.queryParam}=${encodeURIComponent(sku)}`;
}

function productSlugMatchesSku(
  pathname: string,
  sku: string | null | undefined,
): boolean {
  if (!sku) return false;
  const pathUpper = pathname.toUpperCase();
  return skuPathTokens(sku).some((token) => pathUpper.includes(token));
}

function skuPathTokens(sku: string): string[] {
  const trimmed = sku.trim().toUpperCase();
  const tokens = [trimmed];
  const stripped = trimmed.replace(/^[A-Z]+/, '');
  if (stripped && stripped !== trimmed && stripped.length >= 6) {
    tokens.push(stripped);
  }
  return tokens;
}

export function classifySkuFailure(input: {
  searchCompleted: boolean;
  timedOut: boolean;
  landing: SkuLandingKind;
  urlOk: boolean;
  plpLoaded: boolean;
  displayedSku: string | null;
  skuOk: boolean;
  cacheBugSuspected: boolean;
  elementMissing: boolean;
}): FailureCode | undefined {
  if (input.timedOut) return 'TIMEOUT';
  if (!input.searchCompleted) return 'SEARCH_FAILED';
  if (input.elementMissing) return 'ELEMENT_NOT_FOUND';
  if (input.landing === 'unknown') return 'NAVIGATION_FAILED';
  if (!input.plpLoaded) return 'PLP_NOT_LOADED';
  if (input.cacheBugSuspected && !input.skuOk) return 'SKU_MISMATCH';
  if (!input.urlOk) return 'URL_MISMATCH';
  if (!input.skuOk) return 'SKU_MISMATCH';
  return undefined;
}
