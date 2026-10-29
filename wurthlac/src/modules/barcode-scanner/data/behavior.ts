/**
 * Würth LAC exposes an "Open barcode scanner" header control.
 * A barcode/SKU lookup API host was not verified on this storefront.
 * Do not call the Würth Baer barcode API from this suite.
 */
export const BARCODE_SCANNER_BEHAVIOR = {
  uiSettleTimeoutMs: 15_000,
  apiVerified: false,
} as const;
