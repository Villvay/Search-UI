# Analytics optimization summary

Generated: 2026-09-03T07:00:13.076Z

## Dataset

- Dataset key: `top50-sku-nonsku`
- Total rows (per viewport): 200
- Unique normalized queries: 131
- Duplicate rows: 69
- Deduplication percentage (rows): 34.5%

## Execution

- Modules: `on-type,suggestions,on-enter`
- Workers: 1
- Viewports: desktop-1440
- Wall clock: 76m 9s
- Actual executions (all modules × viewports): 393
- Deduplicated executions avoided: 207
- Result rows reported: 600
- Passed / failed / skipped: 297 / 96 / 207

## Deduplication

| Metric | Value |
| --- | ---: |
| Dataset rows | 200 |
| Unique normalized queries | 131 |
| Duplicate rows | 69 |
| Actual executions (aggregate) | 393 |
| Duplicate executions avoided | 207 |
| Dedup savings (rows) | 34.5% |

## Recovery

| Metric | After | Before (baseline) |
| --- | ---: | ---: |
| Soft failures | 96 | — |
| Hard failures | 0 | — |
| Page recoveries | 0 | 133 |
| Home navigations | 3 | — |
| Reload recoveries | 0 | — |

Measured page recoveries: **before 133 → after 0**.

## Runtime

| Configuration | Runtime |
| --- | ---: |
| Before optimization | 122m 8s |
| After optimization | 76m 9s |
| Improvement | 45m 59s (37.6%) |

## Viewport matrix

| Browser | Viewport | Rows | Unique | Actual exec | Skipped dup | Soft fail | Page recoveries | Duration |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Chromium | desktop-1440 | 200 | 131 | 393 | 207 | 96 | 0 | 76m 6s |

## Reliability

- Deduplication is scoped per browser + viewport + module (responsive coverage retained).
- Soft ON-ENTER failures clear the search input and continue on the current SERP; home navigation is reserved for unusable pages.
- Skipped duplicates inherit the canonical result and are not counted as failures.
- Functional ON-TYPE / SUGGESTIONS / ON-ENTER specs are unchanged; relevance matching and title sample size are unchanged.

## Recommendation

Use `ANALYTICS_MODULES=on-type,suggestions` for fast smoke; full modules for nightly. Keep `ANALYTICS_WORKERS=2` for multi-viewport runs.

## Full-dataset benchmark (desktop-1440, W=1, all modules)

| Metric | Before | After | Improvement |
| --- | ---: | ---: | ---: |
| Dataset rows | 200 | 200 | — |
| Unique normalized queries | 200 (no dedupe) | 131 | — |
| Actual query executions (×3 modules) | 600 | 393 | 34.5% fewer |
| Duplicate executions avoided | 0 | 207 | — |
| Page recoveries | 133 | **0** | 100% |
| Home navigations (approx) | ~136+ (per fail + opens) | **3** (module opens only) | — |
| Soft failures | n/a | 96 | — |
| Hard failures | n/a | 0 | — |
| Runtime | 7327.8s (~2h 2m) | 4569.8s (~1h 16m) | **37.7%** |
| Pass / fail / skipped-dup | 467 / 133 / 0 | 297 / 96 / 207 | failures are executed only |

### 10-query × 2-viewport × W=2 calibration

| Metric | Before | After |
| --- | ---: | ---: |
| Runtime | 356.4s | 354.9s |
| Page recoveries | 10 | **0** |

## Validation checklist

- Test1 (5q): soft recovery `pageRecoveries=0` (was 3)
- Test2 (8 rows / 6 unique): `skippedDup=6`, all IDs reported
- Test3 (`ANALYTICS_MODULES=on-type,suggestions`): no ON-ENTER
- Test4 (`ANALYTICS_MODULES=on-enter`): only ON-ENTER; `homeNavigations=1`
- Test5 (10q bench): recoveries 10→0
- Test6 (full 200): runtime −37.7%, recoveries 133→0, exec −34.5%

