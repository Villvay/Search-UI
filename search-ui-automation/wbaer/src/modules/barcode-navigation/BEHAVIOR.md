# Barcode / QR navigation

Independent API module (ported from `QA-Search-main/barcode_navigation_validation`).

Validates that barcode / QR / material-number lookups return a **single** product with direct PLP navigation.

## Pass criteria

1. HTTP 200
2. `summary.total == 1`
3. `summary.plp == true`
4. `results.plpProduct` present

## Datasets

| Profile | File | Count | Tags |
| --- | --- | --- | --- |
| Smoke | `data/smoke-skus.json` (first 10 of regression set) | **10** | `@smoke` on `BARCODE-001`…`010` |
| Regression | `data/regression-skus.json` | **50** | `BARCODE-001`…`050` |

SKUs:
- Smoke (`BARCODE-001`…`010`): 10 materialNumbers that **PASS**ed on production barcode run `versions/v5` (2026-07-31).
- Regression (`BARCODE-001`…`050`): those 10 smoke SKUs plus 40 additional curated SKUs.

## Commands

```bash
# Via cycles (preferred)
npm run test:smoke          # includes BARCODE-001…010
npm run test:regression     # includes BARCODE-001…050

# Module only
npm run test:barcode-nav
npm run test:barcode-nav -- --grep @smoke

# Full Python suite (large dataset, not part of cycles)
npm run test:barcode
npm run test:barcode:sample
```

## Environment

| Variable | Purpose |
| --- | --- |
| `ENV` | `qa` \| `production` — selects barcode API host |
| `BARCODE_API_URL` | Override barcode endpoint |
| `BASE_URL` | Storefront referer host (and ENV mapping) |

## Tags

- `@barcode` — all barcode API cases
- `@smoke` — first 10 SKUs only
