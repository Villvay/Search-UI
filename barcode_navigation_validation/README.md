# Barcode Navigation Validation

Validates that barcode lookups return a **single product** with direct Product Landing Page (PLP) navigation.

Baer (WBS) and Lac (WLAC) are **separate tenants**. Use the matching dataset, barcode API, and referer for each. Do not mix them.

Default `python3 run.py` is **Wurth Baer QA**. WLAC always needs explicit API, dataset, and referer overrides.

## Purpose

A valid barcode should:

1. Return HTTP 200
2. Return exactly **one** product (`summary.total == 1`)
3. Indicate direct navigation (`summary.plp == true`)
4. Include product information (`results.plpProduct`)

Failed barcodes can be re-run after a fix is deployed.

---

## How to run: Baer vs WLAC

Always run from the module folder:

```bash
cd barcode_navigation_validation
```

`ENVIRONMENT=qa` / `ENVIRONMENT=prod` only switch **Baer** URLs. For WLAC, set `BARCODE_API_URL` yourself.

### 1. Wurth Baer (WBS)

| | QA | Prod |
|--|--|--|
| API | `https://search-api-wurthbaer-qa.search-villvay.workers.dev/barcode` | `https://search-api-wurthbaer.search-villvay.workers.dev/barcode` |
| Referer | `https://qa-baersupply.vercel.app/` (default) | same default, or `https://www.baersupply.com/` |
| Dataset | `input/plp_redirect_ALL_skus.json` (default) | same |

**QA (default):**

```bash
cd barcode_navigation_validation
python3 run.py
```

Same as:

```bash
ENVIRONMENT=qa python3 run.py
```

**Prod:**

```bash
cd barcode_navigation_validation
ENVIRONMENT=prod python3 run.py
```

**Optional Baer datasets:**

```bash
# Full PLP SKU set (default when this file exists)
python3 run.py

# 70,250-SKU subset
BARCODES_JSON_PATH=input/barcodes_70250.json python3 run.py

# Combined barcode list
BARCODES_JSON_PATH=input/combined_barcodes.json python3 run.py

# Small CSV smoke set
BARCODES_CSV_PATH=input/barcodes.csv python3 run.py
```

### 2. Wurth Lac (WLAC)

`ENVIRONMENT` does **not** select Lac. Always pass the Lac barcode URL, Lac dataset, and Lac referer.

| | QA / Dev | Prod |
|--|--|--|
| API | `https://search-api-wurthlac-dev.search-villvay.workers.dev/barcode` | `https://search-api-wurthlac-prod.search-villvay.workers.dev/barcode` |
| Referer | `https://qa-wurth-lac.vercel.app/` | `https://www.wurthlac.com/` |

**Recommended sample (400 identifiers, 400 products):**

`input/wlac_barcode_data.json` — 100 SKUs, 100 material numbers, 100 UPC codes, 100 SAP IDs. SKU and material number never come from the same product.

**Prod:**

```bash
cd barcode_navigation_validation

BARCODE_API_URL=https://search-api-wurthlac-prod.search-villvay.workers.dev/barcode \
REFERER=https://www.wurthlac.com/ \
BARCODES_JSON_PATH=input/wlac_barcode_data.json \
SKU_SET=yes \
python3 run.py
```

**QA / Dev:**

```bash
cd barcode_navigation_validation

BARCODE_API_URL=https://search-api-wurthlac-dev.search-villvay.workers.dev/barcode \
REFERER=https://qa-wurth-lac.vercel.app/ \
BARCODES_JSON_PATH=input/wlac_barcode_data.json \
SKU_SET=yes \
python3 run.py
```

**Other WLAC datasets:**

```bash
# 34,585 clicked US SKUs (material numbers only)
BARCODES_JSON_PATH=input/wurthlac-barcode-dataset.json

# 300-identifier sample (100 material, 100 UPC, 100 SAP)
BARCODES_JSON_PATH=input/wurthlac-barcode-sample-300.json
```

Keep the same `BARCODE_API_URL` and `REFERER` as the commands above.

CSV equivalent of the 400-row set: `input/wlac_barcode_data.csv`.

```bash
BARCODE_API_URL=https://search-api-wurthlac-prod.search-villvay.workers.dev/barcode \
REFERER=https://www.wurthlac.com/ \
BARCODES_CSV_PATH=input/wlac_barcode_data.csv \
python3 run.py
```

### Smoke test (either tenant)

```bash
LIMIT=20 python3 run.py
```

For WLAC, still include `BARCODE_API_URL`, `REFERER`, and `BARCODES_JSON_PATH`.

---

## Execution modes

This module has **two separate modes**. Dataset generation is a manual utility and is **never** executed during normal barcode validation.

### 1. Normal barcode validation (default)

```bash
cd barcode_navigation_validation
python3 run.py
```

Or from the repository root:

```bash
python3 barcode_navigation_validation/run.py
```

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

Final CSV/JSON/HTML reports are generated **only after all rounds are complete**.

The process exit code is **1 if any barcode FAILs**. That is expected when the dataset contains known defects.

### 2. Product dataset generation (manual, opt-in only)

Use this when you need to create or refresh the product master Excel before building a barcode validation dataset. This path is **Baer-only**.

```bash
cd barcode_navigation_validation
python3 run.py --generate-product-dataset
```

Equivalent:

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

---

## Input

### JSON (preferred for large SKU sets)

```json
{
  "yes_skus": ["AA201004", "..."],
  "no_skus": ["AA12060", "..."]
}
```

| Dataset | Tenant | Size | Contents |
|---------|--------|------|----------|
| `input/plp_redirect_ALL_skus.json` | Baer | default full set | PLP redirect SKUs |
| `input/barcodes_70250.json` | Baer | 70,250 | SKU subset |
| `input/combined_barcodes.json` | Baer | ~119k | Combined barcodes |
| `input/wlac_barcode_data.json` | WLAC | 400 | 100 SKU + 100 material + 100 UPC + 100 SAP, disjoint products |
| `input/wurthlac-barcode-sample-300.json` | WLAC | 300 | 100 material + 100 UPC + 100 SAP, disjoint products |
| `input/wurthlac-barcode-dataset.json` | WLAC | 34,585 | Clicked US SKUs (material numbers) |

See `input/wurthlac-barcode-dataset.SOURCE.md` for the full Lac SKU-set origin.

| Variable | Values | Default |
|----------|--------|---------|
| `SKU_SET` | `all`, `yes`, `no` | `all` |

### CSV

`input/barcodes.csv` (Baer smoke) or `input/wlac_barcode_data.csv` (WLAC 400-row set).

| Column | Description |
|--------|-------------|
| `barcode` | Barcode / material number / UPC / SAP ID / SKU to look up |
| `expected` | Expected outcome (currently always `success`) |

Example:

```csv
barcode,expected
088381234567,success
099991111111,success
123456789012,success
```

Overrides: `BARCODES_JSON_PATH`, `BARCODES_CSV_PATH`.

---

## Outputs

Written to `output/`:

| File | Description |
|------|-------------|
| `barcode_navigation_results.csv` | Pass/fail table (final, after all rounds) |
| `barcode_navigation_results.json` | Full execution details (final) |
| `barcode_navigation_dashboard.html` | Interactive success/failed dashboard (final) |
| `rounds/round_N_results.csv` | Temporary per-round results |
| `rounds/rounds_state.json` | Round completion state for resume |
| `versions/vN/` | Versioned copy of the dashboard and reports |
| `versions.json` | Version index |

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

Includes summary cards, search/filter, sticky table headers, and related-field PASS/FAIL. Reports are checkpointed during long runs.

Force a new version folder:

```bash
FORCE_NEW_VERSION=1 python3 run.py
```

Sample committed outputs:

- `output/sample_barcode_navigation_results.csv`
- `output/sample_barcode_navigation_results.json`

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `qa` | Baer only: `qa` / `prod` |
| `BARCODE_API_URL` | from `ENVIRONMENT` (Baer) | Required for WLAC; also overrides Baer |
| `BASE_URL` | — | Shared override; `/search` is mapped to `/barcode` |
| `SEARCH_API_URL` | — | Shared override; `/search` is mapped to `/barcode` |
| `REFERER` | `https://qa-baersupply.vercel.app/` | Use `https://www.wurthlac.com/` for WLAC prod |
| `BARCODES_JSON_PATH` | `input/plp_redirect_ALL_skus.json` | Input JSON override |
| `BARCODES_CSV_PATH` | `input/barcodes.csv` | Input CSV override |
| `SKU_SET` | `all` | JSON SKU subset: `all` / `yes` / `no` |
| `MAX_WORKERS` | `8` | Parallel API workers within a round |
| `CHECKPOINT_EVERY` | `100` | Save round CSV every N SKUs |
| `ROUND` | `all` | `all` / `1` / `2` / `3` |
| `ROUND_COUNT` | `3` | Number of sequential rounds |
| `RESUME_ROUNDS` | `true` | Skip rounds marked complete in `rounds_state.json` |
| `FORCE_ROUND` | — | Force rerun of one round number |
| `FORCE_NEW_VERSION` | — | `1` always creates a new report version folder |
| `LIMIT` | — | Optional cap for smoke runs |
| `REQUEST_TIMEOUT_S` | `30` | HTTP timeout |
| `MAX_RETRIES` | `3` | Retry attempts |
| `RETRY_BACKOFF_S` | `0.8` | Retry backoff multiplier |
| `REQUEST_DELAY_S` | `0` | Delay between barcodes (sequential only) |
| `PAGE_SIZE` | `20` | API `pageSize` |
| `BARCODE_API_MOCK=1` | off | Offline mode using mock fixtures |

---

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

---

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
│   ├── plp_redirect_ALL_skus.json          # Baer default
│   ├── barcodes_70250.json                 # Baer subset
│   ├── combined_barcodes.json              # Baer combined
│   ├── wlac_barcode_data.json              # WLAC 400-row mixed IDs
│   ├── wlac_barcode_data.csv
│   ├── wurthlac-barcode-dataset.json       # WLAC clicked SKUs
│   └── wurthlac-barcode-sample-300.json
├── dataset_generator/
├── services/
├── validators/
├── reports/
├── output/
└── tests/
    └── fixtures/
        └── mock_responses.json
```

---

## Offline / mock run

```bash
cd barcode_navigation_validation
BARCODE_API_MOCK=1 python3 run.py
```

Uses `tests/fixtures/mock_responses.json` and does not call the live API.

## Dependencies

Python 3.11+ recommended. Standard library only (`csv`, `json`, `urllib`, `pathlib`). No `pip install` required for barcode validation. Dataset generation needs `openpyxl`.
