# Analytics query dataset

## Datasets

### 1. Existing — Non-SKU top 50 by searches (unchanged)

File: `queries-50.json`

| Field | Meaning |
| --- | --- |
| `id` | Stable ID `AN-Q001` … `AN-Q050` |
| `query` | Original analytics query text (unchanged) |
| `searchCount` | Search volume from the provided table |
| `source` | `analytics` |
| `category` | `non-sku` |

| Metric | Count |
| --- | ---: |
| Queries | 50 |
| Exact duplicate strings | 0 |
| Case-insensitive duplicates | 2 pairs (`mdf`/`MDF`, `plywood`/`Plywood`) |

### 2. New — Top 50 SKU + Non-SKU (searches + clicks)

Source PDF: `top50_queries_sku_nonsku_2026-08-31.pdf`  
File: `queries-top50-sku-nonsku-2026-08-31.json`

| Metric | Count |
| --- | ---: |
| Total queries (rows) | **200** |
| Unique exact strings | **136** |
| Unique case-insensitive | **131** |
| Exact duplicate occurrences (across lists) | **64** |
| Categories | `non-sku`, `sku` |
| Lists | `non-sku-by-searches`, `non-sku-by-clicks`, `sku-by-searches`, `sku-by-clicks` |

IDs: `AN-NSF###`, `AN-NSC###`, `AN-SKF###`, `AN-SKC###`. Duplicate query text across ranked lists is **preserved**.

## Usage

```ts
import { loadAnalyticsQueries } from '../../core/utils/analyticsQueryLoader';

const queries = loadAnalyticsQueries(); // respects ANALYTICS_DATASET / PROFILE / LIMIT / IDS
```

### Profiles / commands

| Command | Dataset | Execution |
| --- | --- | --- |
| `npm run test:analytics` | `queries-50.json` (default) | Per-query Playwright tests (existing) |
| `npm run test:analytics:smoke` | smoke IDs from default file | Existing |
| `npm run test:analytics:batched` | `top50-sku-nonsku` (default for batched) | **Viewport batch**: 1 page → all queries × 3 modules |

```bash
ANALYTICS_DATASET=top50-sku-nonsku ANALYTICS_LIMIT=5 ANALYTICS_WORKERS=1 \
  npm run test:analytics:batched -- --project=desktop-1440
```

Env:

- `ANALYTICS_DATASET=default\|top50-sku-nonsku`
- `ANALYTICS_PROFILE=smoke\|full`
- `ANALYTICS_LIMIT=5`
- `ANALYTICS_IDS=…`
- `ANALYTICS_CATEGORY=sku\|non-sku`
- `ANALYTICS_LIST=non-sku-by-searches`
- `ANALYTICS_MODULES=on-type,suggestions,on-enter` — select analytics modules (batched default: all three)
- `ANALYTICS_WORKERS=1..4` — shards by **viewport/project**, not by query

## Pass criteria (analytics tests)

| Module | Pass | Fail |
| --- | --- | --- |
| **SUGGESTIONS** | `suggestionCount > 0` in dropdown | Empty suggestions / zero count |
| **ON-ENTER** | SERP has products; first **10** product titles include the searched query | No Results / zero products / title mismatch / PDP redirect |
| **ON-TYPE** | UI handles query (columns or empty-state) | Unhandled / crash / stuck idle |
