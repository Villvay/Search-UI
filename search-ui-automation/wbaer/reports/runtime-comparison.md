# Runtime comparison — Fast Execution / Test Profiles

Measured on local macOS against QA (`ENV=qa`), Playwright **1.61.1**, Chromium project **`desktop-1440`**.

**Dataset note:** The provided analytics file is Non-SKU top **50** (`queries-50.json`). Full analytics uses that complete file (not reduced). Analytics smoke uses **15** IDs from the same file (`smoke-query-ids.json`). No queries were invented. A future SKU top-50 can extend the dataset when provided.

## Summary table

| Suite | Before | After | Improvement |
| --- | ---: | ---: | ---: |
| Smoke | 21.6s | 16.0s | **~26% faster** |
| Analytics Smoke | 791.3s (~13.2m) | 223.1s (~3.7m) | **~72% faster** |
| Full Analytics | ~43.9m *(estimated)* | 18.2m *(measured)* | **~59% faster** *(est. vs measured)* |

Full Analytics **before** was not re-run end-to-end after profiling started (disk pressure / time). It is estimated from the pre-change Analytics Smoke measurement scaled by query count: `791.3s × (50/15) ≈ 2638s (~43.9m)` at `ANALYTICS_WORKERS=1`, sequential modules. Treat that cell as an estimate, not a wall-clock capture.

## Smoke

| Field | Before | After |
| --- | --- | --- |
| Command (before) | Closest equivalent: `playwright test` ON-TYPE/SUGGESTIONS/ON-ENTER specs `--grep "ON-TYPE-001\|ON-TYPE-003\|SUG-001\|SUG-002\|ENTER-001\|ENTER-002" --project=desktop-1440 --retries=0` | `npm run test:smoke` |
| Project / browser | `desktop-1440` / Chromium | `desktop-1440` / Chromium |
| Workers | Playwright default (4) | Playwright default (4) |
| Tests | 6 | 6 (`@smoke`) |
| Pass / fail | 6 / 0 | 6 / 0 |
| Wall clock (`time -p real`) | **21.59s** | **15.95s** |
| Playwright reported | 19.8s | 14.6s |

## Analytics Smoke

| Field | Before | After |
| --- | --- | --- |
| Command (before) | `ANALYTICS_LIMIT=15 ANALYTICS_WORKERS=1 ANALYTICS_RETRIES=0 npm run test:analytics -- --project=desktop-1440` | `npm run test:analytics:smoke` |
| Queries | First 15 of dataset | Fixed 15 representative IDs |
| Modules | ON-TYPE + SUGGESTIONS + ON-ENTER | same |
| Tests | 45 | 45 |
| Workers | 1 | 3 (smoke default) |
| Module execution | Sequential (3 Playwright invocations) | Single invocation (modules parallel) |
| Pass / fail | 37 / 8 | 33 / 12 |
| Wall clock (`time -p real`) | **791.31s** | **223.10s** |

Failures are largely strict ON-ENTER title matching / empty suggestions — not profile infrastructure.

## Full Analytics

| Field | Before | After |
| --- | --- | --- |
| Command | Full dataset × 3 modules @ `desktop-1440`, workers 1, sequential modules *(estimated from smoke)* | `ANALYTICS_WORKERS=2 npm run test:analytics` equivalent: direct Playwright 3 specs `--workers 2 --project=desktop-1440` |
| Queries | 50 (complete dataset) | 50 (complete dataset) |
| Tests | 150 | 150 |
| Workers | 1 *(baseline estimate)* | 2 *(measured after)* |
| Pass / fail | n/a (not re-captured) | 124 / 26 |
| Duration | **~43.9m estimated** | **18.2m** (Playwright); wall ~18.2m |

## Optimizations applied

1. Removed duplicate Chromium 1440 project (`desktop-1440-chrome`); canonical project is `desktop-1440`.
2. Safari/WebKit is opt-in via `INCLUDE_SAFARI=1`.
3. Profiles: `test:smoke`, `test:analytics:smoke`, `test:analytics`.
4. `ANALYTICS_WORKERS` configurable (`1`–`4`, default `1`).
5. Analytics uses `fill()`; functional ON-TYPE keeps sequential typing.
6. Dropped broad `networkidle` waits on search open in favor of search-input readiness.
7. Analytics runner can execute all three modules in one Playwright process (parallel by worker).
8. Tags: `@smoke`, `@analytics`, `@responsive`.

**Page reuse:** Shared serial page reuse was tried but Playwright serial mode skips remaining tests after a failure, which broke analytics coverage. Specs stay parallel with per-test pages; speed gains come from `fill()`, wait trimming, and multi-module workers instead.

## Log artifacts

- `reports/baseline-smoke.log`
- `reports/baseline-analytics-smoke.log`
- `reports/after-smoke.log`
- `reports/after-analytics-smoke.log`
- `reports/after-analytics-full.log`
