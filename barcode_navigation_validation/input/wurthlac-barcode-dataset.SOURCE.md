# wurthlac-barcode-dataset

Unique Wurthlac SKUs for barcode navigation validation.

| | |
|--|--|
| Tenant | Wurthlac (WLAC) |
| Unique SKUs | 34,585 |
| Source | `search-analytics/data/prod2/exports/lac-dump/lac_us_clicks_20260918.csv` |
| Window | 2026-03-05 to 2026-09-18, US only |
| Field | `sku` (from `properties.material_number` on `search_result_clicked`) |

This is **not** a full product catalog. It includes only SKUs that were clicked in US search during that window.

Files:

- `wurthlac-barcode-dataset.json` — `yes_skus` list for `run.py`
- `wurthlac-barcode-dataset.csv` — `barcode,expected` for CSV loading
