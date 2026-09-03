# SKU search → product-page cache validation

Independent module. Does not import on-enter / on-type / suggestions / filters.

Target: `https://qa-baersupply.vercel.app`  
Inspected: 2026-09-03 (desktop-1440)

## URL behavior

Exact SKU Enter search:

1. `/search?q=<sku>`
2. Unique-match SKUs then **redirect** to `/product/{numericId}/{slug}`

The product URL does **not** always contain the searched SKU (slug may use manufacturer number). Strongest URL checks:

| Landing | Validation |
| --- | --- |
| `/search?q=` | `q` must equal the searched SKU (case-insensitive) |
| `/product/{id}/{slug}` | Valid unique-SKU landing; **fail** if this is still the previous SKU's product URL |

Displayed identity on the product page:

```text
Item # AA201007
Mfr # 201007
```

`validatePLPUrl(url, expectedSku)` lives in `assertions/skuPlpAssertions.ts`.

## Cache bug this module is designed to catch

Same browser session, no reload between searches:

```text
Search SKU A  →  product page for A     (correct)
Search SKU B  →  product page for A     (stale)
Search SKU C  →  product page for B     (stale / off-by-one)
```

Default sequence expands the dataset into `A → B → C → A → B → A` plus remaining SKUs.

Waits cover search input, URL change, product/SERP content, and URL stability. They do **not** wait until `Item #` matches the searched SKU.

## Commands

```bash
# Default dataset, desktop-1440, QA
npm run test:sku-plp

# Limit unique SKUs / point at the catalog NDJSON
SKU_LIMIT=5 npm run test:sku-plp
SKU_DATASET=/path/to/catalog_sku_plp_results.json SKU_LIMIT=50 npm run test:sku-plp

# Run the JSON list in file order (no A→B→C sequence expansion)
SKU_CACHE_SEQUENCES=0 npm run test:sku-plp
```

Reports:

- `reports/sku-plp/runs/<run-id>/dashboard.html`
- `reports/sku-plp/runs/<run-id>/sku_search_results.json`
- `reports/sku-plp/index.html` — list of versioned runs
- Playwright HTML: `reports/html/index.html`

## Tags

- `@sku-plp` — this suite only (not part of `@smoke` / `@responsive`)
