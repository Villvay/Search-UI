/**
 * SKU search → product-page (PLP/PDP) cache validation.
 *
 * Inspected 2026-09-03 on QA: https://qa-baersupply.vercel.app
 *
 * Exact SKU Enter search:
 *   1. Navigates to `/search?q=<sku>`
 *   2. Unique-match SKUs then redirect to `/product/{id}/{slug}`
 *
 * Product pages display `Item # <SKU>` (and often `Mfr # <manufacturer>`).
 * The SKU is not reliably present in the product URL (slug may use Mfr #).
 *
 * Cache bug (sequential same-session searches, no reload):
 *   Search SKU B while on SKU A's product page
 *   → URL briefly `/search?q=B` then lands on SKU A's product (`Item # A`)
 *   Search SKU C
 *   → lands on SKU B's product (`Item # B`)  — off-by-one stale page
 */

export const SKU_PLP_BEHAVIOR = {
  searchPath: '/search',
  queryParam: 'q',
  productPathPrefix: '/product/',
  /** Unique-match SKUs redirect from SERP to a product page. */
  uniqueSkuRedirectsToProduct: true,
  uiSettleTimeoutMs: 30_000,
  /** Extra window after `/search?q=` for the product redirect. */
  skuRedirectTimeoutMs: 12_000,
  /** URL must remain unchanged this long before we snapshot (do not wait for SKU match). */
  urlStableMs: 500,
  urlStableMaxMs: 4_000,
} as const;

export const SKU_PLP_COPY = {
  searchResultsHeadingPrefix: 'Search Results for',
  noResultsHeading: 'No Results',
  itemNumberPrefix: /Item\s*#/i,
} as const;
