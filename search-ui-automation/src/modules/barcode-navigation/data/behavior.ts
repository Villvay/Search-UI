/**
 * Barcode / QR → PLP navigation behavior (API).
 * Ported from QA-Search-main/barcode_navigation_validation.
 *
 * A valid barcode/SKU lookup must:
 * 1. HTTP 200
 * 2. summary.total === 1
 * 3. summary.plp === true
 * 4. results.plpProduct present
 */
export const BARCODE_API_URLS = {
  qa: 'https://search-api-wurthbaer-qa.search-villvay.workers.dev/barcode',
  staging: 'https://search-api-wurthbaer-qa.search-villvay.workers.dev/barcode',
  production: 'https://search-api-wurthbaer.search-villvay.workers.dev/barcode',
} as const;

export const BARCODE_NAVIGATION_BEHAVIOR = {
  expectedTotal: 1,
  expectPlp: true,
  requestTimeoutMs: 30_000,
} as const;
