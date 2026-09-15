# Barcode Navigation Validation

> **Search-UI integration:** Ported from `QA-Search-main/barcode_navigation_validation`.
> Standalone suite (Python API) — **not** included in Playwright smoke/regression.
> Run via `npm run test:barcode` / `npm run test:qr-code` from `search-ui-automation/`.
> Quick sample: `npm run test:barcode:sample` (uses `input/barcodes.csv`).
> Default `npm run test:barcode` prefers `input/plp_redirect_ALL_skus.json` (~109k SKUs) when present.

Validates that barcode / QR lookups return a single product with direct Product Landing Page (PLP) navigation.

This module is **independent** from other search automation packages. It reuses the same configuration style, HTTP retry pattern, and reporting approach used elsewhere in the repository, without modifying existing modules.

## Purpose

A valid barcode should:

1. Return HTTP 200
2. Return exactly **one** product (`summary.total == 1`)
3. Indicate direct navigation (`summary.plp == true`)
4. Include product information (`results.plpProduct`)

Some valid barcodes currently return no results due to defects. This automation identifies those failures so the same dataset can be re-run after fixes are deployed.

## Execution modes

This module has **two separate modes**. Dataset generation is a manual utility and is **never** executed during normal barcode validation or CI/CD pipelines.

### 1. Normal barcode validation (default)

```bash
cd barcode_navigation_validation
python3 run.py
```

Or from the repository root:

```bash
python3 barcode_navigation_validation/run.py
```

Running `python3 run.py` with no flags only executes barcode navigation validation. It does **not** call the Search/multisearch API to build product datasets.

Large datasets are processed in **3 sequential rounds** by default. Validation logic is unchanged; only execution is split.

#### 3-round execution

```bash
# All rounds (default)
ROUND=all python3 run.py

# One round at a time
ROUND=1 python3 run.py
ROUND=2 python3 run.py
ROUND=3 python3 run.py

# Skip completed rounds
RESUME_ROUNDS=true ROUND=all python3 run.py

# Force rerun round 2
FORCE_ROUND=2 ROUND=2 python3 run.py
```

Round artifacts:

```text
output/rounds/round_1_results.csv
output/rounds/round_2_results.csv
output/rounds/round_3_results.csv
output/rounds/rounds_state.json
```

Final CSV/JSON/HTML reports are generated **only after all rounds are complete**, using the same report format as before.

### 2. Product dataset generation (manual, opt-in only)

Use this when you need to create or refresh the product master Excel before building a barcode validation dataset.

```bash
cd barcode_navigation_validation
python3 run.py --generate-product-dataset
```

Equivalent env enablement:

```bash
GENERATE_DATASET=true python3 run.py
```

Optional overwrite (replace Excel instead of merge/update):

```bash
python3 run.py --generate-product-dataset --overwrite-product-dataset
```

Requires `openpyxl` (`pip install -r requirements.txt`).

Input: `input/search_queries.csv`  
Output: `output/product_dataset.xlsx` (worksheet `Products`)

API used for dataset generation:

```text
GET https://search-api-wurthbaer-qa.search-villvay.workers.dev/multisearch?query={query}
```

Default merge behavior:
- Keep one row per product (`materialNumber`, then `MFRPartNo`, then `UPCCode`)
- Fill blank fields on existing rows; never overwrite populated values with blanks
- Append only new products unless `--overwrite-product-dataset` is set

### Run the full PLP SKU dataset

```bash
cd barcode_navigation_validation
REQUEST_DELAY_S=0 MAX_WORKERS=8 python3 run.py
```

The runner prefers `input/plp_redirect_ALL_skus.json` when present.

```bash
BARCODES_JSON_PATH=/path/to/plp_redirect_ALL_skus.json \
REQUEST_DELAY_S=0 MAX_WORKERS=8 python3 run.py
```

## Input

### JSON (preferred for large SKU sets)

`input/plp_redirect_ALL_skus.json`

```json
{
  "yes_skus": ["AA201004", "..."],
  "no_skus": ["AA12060", "..."]
}
```

| Variable | Values | Default |
|----------|--------|---------|
| `SKU_SET` | `all`, `yes`, `no` | `all` |

### CSV

`input/barcodes.csv`

| Column | Description |
|--------|-------------|
| `barcode` | Barcode / material number / UPC / SAP ID to look up |
| `expected` | Expected outcome (currently always `success`) |

Example:

```csv
barcode,expected
088381234567,success
099991111111,success
123456789012,success
```

Overrides: `BARCODES_JSON_PATH`, `BARCODES_CSV_PATH`.

## Outputs

Written to `output/`:

| File | Description |
|------|-------------|
| `barcode_navigation_results.csv` | Pass/fail table (final, after all rounds) |
| `barcode_navigation_results.json` | Full execution details (final) |
| `barcode_navigation_dashboard.html` | Interactive success/failed dashboard (final) |
| `rounds/round_N_results.csv` | Temporary per-round results |
| `rounds/rounds_state.json` | Round completion state for resume |

### CSV columns

`barcode`, `identifier_type`, `status`, `reason`, `http_status`, `product_id`, `product_name`, `execution_time_ms`

### Console summary

```
Total Tested : 250
Passed       : 236
Failed       : 14
```

### HTML dashboard

Open `output/barcode_navigation_dashboard.html` in a browser. Tabs:

- **Failed** — barcodes that did not navigate to a single PLP product
- **Passed** — successful direct navigation
- **All** — complete dataset

Includes summary cards, search/filter, and sticky table headers. Reports are checkpointed during long runs.

Sample committed outputs are also available as:

- `output/sample_barcode_navigation_results.csv`
- `output/sample_barcode_navigation_results.json`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `qa` | Selects built-in barcode API URL (`qa` / `prod`) |
| `BARCODE_API_URL` | from `ENVIRONMENT` | Direct barcode endpoint override |
| `BASE_URL` | — | Shared override; `/search` is mapped to `/barcode` |
| `SEARCH_API_URL` | — | Shared override; `/search` is mapped to `/barcode` |
| `BARCODES_JSON_PATH` | `input/plp_redirect_ALL_skus.json` | Input JSON override |
| `BARCODES_CSV_PATH` | `input/barcodes.csv` | Input CSV override |
| `SKU_SET` | `all` | JSON SKU subset: `all` / `yes` / `no` |
| `MAX_WORKERS` | `8` | Parallel API workers within a round |
| `CHECKPOINT_EVERY` | `100` | Save round CSV every N SKUs |
| `ROUND` | `all` | `all` / `1` / `2` / `3` — which round(s) to run |
| `ROUND_COUNT` | `3` | Number of sequential rounds |
| `RESUME_ROUNDS` | `true` | Skip rounds marked complete in `rounds_state.json` |
| `FORCE_ROUND` | — | Force rerun of one round number |
| `LIMIT` | — | Optional cap for smoke runs |
| `REQUEST_TIMEOUT_S` | `30` | HTTP timeout |
| `MAX_RETRIES` | `3` | Retry attempts |
| `RETRY_BACKOFF_S` | `0.8` | Retry backoff multiplier |
| `REQUEST_DELAY_S` | `0.12` | Delay between barcodes (sequential only) |
| `PAGE_SIZE` | `20` | API `pageSize` |
| `BARCODE_API_MOCK=1` | off | Offline mode using mock fixtures |

### Built-in URLs

| Environment | URL |
|-------------|-----|
| `qa` | `https://search-api-wurthbaer-qa.search-villvay.workers.dev/barcode` |
| `prod` | `https://search-api-wurthbaer.search-villvay.workers.dev/barcode` |

Examples:

```bash
ENVIRONMENT=qa python3 run.py
ENVIRONMENT=prod python3 run.py
BARCODE_API_URL=https://example.com/barcode python3 run.py
BARCODE_API_MOCK=1 python3 run.py
```

## Validation rules

**PASS** when all are true:

- HTTP 200
- `summary.total == 1`
- `summary.plp == true` (direct product navigation)
- Product payload present (`results.plpProduct`)

**FAIL** examples:

- `No product returned`
- `Product missing`
- `HTTP 500`
- `Timeout`
- `Invalid response`
- `Empty response`
- Unexpected exceptions

Execution continues after individual barcode failures.

## Module layout

```
barcode_navigation_validation/
├── README.md
├── run.py
├── config.py
├── constants.py
├── input/
│   ├── barcodes.csv
│   ├── search_queries.csv
│   └── plp_redirect_ALL_skus.json
├── dataset_generator/
│   ├── generator.py
│   ├── extractor.py
│   └── excel_writer.py
├── services/
│   └── barcode_api.py
├── validators/
│   └── response_validator.py
├── reports/
│   ├── console_summary.py
│   ├── csv_report.py
│   ├── json_report.py
│   └── html_dashboard.py
├── output/
│   └── product_dataset.xlsx   # created by --generate-product-dataset only

└── tests/
    └── fixtures/
        └── mock_responses.json
```

## Offline / mock run

```bash
cd barcode_navigation_validation
BARCODE_API_MOCK=1 python3 run.py
```

Uses `tests/fixtures/mock_responses.json` and does not call the live API.

## Dependencies

Python 3.11+ recommended. Standard library only (`csv`, `json`, `urllib`, `pathlib`). No `pip install` required.
