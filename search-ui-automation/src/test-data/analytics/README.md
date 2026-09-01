# Analytics query dataset

## Source

**Non-SKU — top 50 by searches**, provided exactly by the user (2026-08-31).

File: `queries-50.json`

| Field | Meaning |
| --- | --- |
| `id` | Stable ID `AN-Q001` … `AN-Q050` |
| `query` | Original analytics query text (unchanged) |
| `searchCount` | Search volume from the provided table |
| `source` | `analytics` |
| `category` | `non-sku` |

## Validation summary (source as provided)

| Metric | Count |
| --- | ---: |
| Queries | 50 |
| Empty | 0 |
| Exact duplicate strings | 0 |
| Case-insensitive duplicates | 2 pairs (`mdf`/`MDF`, `plywood`/`Plywood`) |
| Near-duplicate phrasing | `trash pullout` / `trash pull out`; `blum hinges` / `blum hinge`; `rev-a-shelf` / `rev a shelf` |
| Special-character | 1 (`olympus lock 1-3/4" Cam #326`) |
| Pure numeric | 0 |
| Long (≥ 25 chars) | 2 |

Duplicates are preserved — analytics can legitimately repeat variants.

## Usage

```ts
import { loadAnalyticsQueries } from '../../core/utils/analyticsQueryLoader';

const queries = loadAnalyticsQueries(); // respects ANALYTICS_LIMIT
```

## Pass criteria (analytics tests)

| Module | Pass | Fail |
| --- | --- | --- |
| **SUGGESTIONS** | `suggestionCount > 0` in dropdown | Empty suggestions / zero count |
| **ON-ENTER** | SERP has products; first **10** product titles include the searched query (case-insensitive; multi-word = each word ≥2 chars) | No Results / zero products / title mismatch / PDP redirect |
| **ON-TYPE** | UI handles query (columns or empty-state) | Unhandled / crash / stuck idle |

Env:

- `ANALYTICS_LIMIT=5` — first N queries (controlled runs)
- `ANALYTICS_IDS=AN-Q001,AN-Q002` — explicit ID filter
