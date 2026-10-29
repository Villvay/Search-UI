# Analytics batch runtime comparison

Measured against the new dataset key `top50-sku-nonsku`
(`src/test-data/analytics/queries-top50-sku-nonsku-2026-08-31.json`).

## Dataset (source file, unmodified)

| Metric | Count |
| --- | ---: |
| Total queries | 200 |
| Unique queries (exact) | 136 |
| Unique queries (case-insensitive) | 131 |
| Exact duplicate occurrences | 64 |
| Categories | non-sku, sku |

```text
Total queries: 200
Unique queries: 136
Duplicate queries: 64 (exact occurrences across lists)
Categories: non-sku, sku
```

## Calibration slice (Test 1) — before vs after

Configuration:

```text
Queries: 5
Browser: Chromium
Viewport: desktop-1440
Workers: 1
Modules: ON-TYPE + SUGGESTIONS + ON-ENTER
```

| Metric | Before (per-query specs) | After (viewport batch) | Improvement |
| --- | ---: | ---: | ---: |
| Total runtime | 223.23s | 185.62s | **16.8%** faster |
| Browser launches (approx) | 15 | 1 | **~15× fewer** |
| Context launches (approx) | 15 | 1 | **~15× fewer** |
| Page launches | 15 | **1** | **93%** fewer |
| Queries × modules | 15 | 15 | — |
| Avg / query-module | 14.9s | 12.4s | 16.8% |
| Passed / failed | 12 / 3 | 12 / 3 | same outcomes |

Commands:

- Before: `ANALYTICS_DATASET=top50-sku-nonsku ANALYTICS_LIMIT=5 ANALYTICS_WORKERS=1 ANALYTICS_RETRIES=0 npm run test:analytics -- --project=desktop-1440`
- After: `ANALYTICS_DATASET=top50-sku-nonsku ANALYTICS_LIMIT=5 ANALYTICS_WORKERS=1 ANALYTICS_RETRIES=0 npm run test:analytics:batched -- --project=desktop-1440`

Notes:

- Failures are ON-ENTER product-title relevance mismatches (existing assertion semantics), not batching defects.
- Wall-time savings are smaller than launch reduction because ON-ENTER (~30–35s/query) dominates.

## Viewport batching validation (Tests 2–3)

| Test | Config | Wall clock | Page launches | Observation |
| --- | --- | ---: | ---: | --- |
| Test 2 | 10 queries × 2 viewports × 1 worker | 710.25s | 2 | `desktop-1440` → all 10, then `desktop-1280` → all 10 |
| Test 3 | 10 queries × 2 viewports × 2 workers | 356.43s | 2 | Parallel viewports; same 50 pass / 10 fail; **no worker interference** |

| Workers | Runtime (10q × 2 vp) | Speedup vs W=1 |
| ---: | ---: | ---: |
| 1 | 710.25s | — |
| 2 | 356.43s | **~2.0×** |

## Test 4 — full dataset × one viewport

```text
Queries: 200
Browser: Chromium
Viewport: desktop-1440
Workers: 1
```

| Metric | Batched result |
| --- | ---: |
| Total runtime | **7327.75s (~2h 2m)** |
| Browser launches | 1 |
| Context launches | 1 |
| Page launches | **1** |
| Queries | 200 |
| Result rows (×3 modules) | 600 |
| Passed / failed | 467 / 133 |
| Avg / query-module | 12.2s |
| ON-TYPE | 200 pass / 0 fail |
| SUGGESTIONS | 193 pass / 7 fail |
| ON-ENTER | 74 pass / 126 fail |

Batching proof: logs show `[1/200]…[200/200]` for each module inside one `Browser: Chromium / Viewport: desktop-1440` header, with `pageLaunches=1`.

Estimated legacy cost for the same slice (600 per-query tests ≈ 600 page launches): **>> 2h** wall time; calibration suggests ~17%+ wall savings plus ~600× fewer page launches.

## Test 5 — full Chromium viewport matrix

```text
Queries: 200
Viewports: desktop-1440, desktop-1280, tablet-1024, tablet-768, mobile-390, mobile-375
Workers: 2 (viewport-level shard)
```

Status: **running** (`reports/analytics-batch-test5.log`). Results will be merged into this file when complete.

## Recommendation (from measured Tests 1–4)

```text
ANALYTICS_WORKERS=2
Batched by browser + viewport (npm run test:analytics:batched)
Safari opt-in only (INCLUDE_SAFARI=1)
```

Rationale: workers=2 halved wall clock on a 2-viewport batch with identical pass/fail. Prefer sharding **viewports across workers**, never splitting one viewport’s query list. Do not raise workers past the number of active viewport projects.
