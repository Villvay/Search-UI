# Cache & Search State Validation — discovered behavior

Target: Würth Baer Supply QA (`https://qa-baersupply.vercel.app`)

Inspection: live Playwright probes (desktop 1440×900), Sep 2026.

## Summary labels

| Area | Status |
|---|---|
| Service worker / Cache API | **OBSERVED** — none registered; `caches.keys()` empty |
| Search API HTTP cache | **OBSERVED** — `/trending`, `/suggestions`, `/multisearch` respond `Cache-Control: no-cache` |
| Storefront `/search` RSC | **OBSERVED** — `public, max-age=0, must-revalidate` (+ `Age` / Vary on RSC) |
| Same-page query A→B | **OBSERVED** — URL/`q`/input update to B; heading becomes `Search Results for "B"` when settled |
| Suggestions A→B | **OBSERVED** — suggestion texts change with query; hinge* vs blum* |
| SERP refresh | **OBSERVED** — reload keeps `q`, input, and heading for QUERY_A |
| Filters on new Enter search | **OBSERVED** — `filters` param cleared when searching a new `q` via Enter |
| Filter persistence on refresh | **EXPECTED** (filters module) — refresh keeps filters when URL includes them |
| Direct `/search?q=` transitions | **OBSERVED** — state follows new `q` |
| Clear search | **OBSERVED** — suggestions hide; Trending now returns; input empty |
| Fresh browser context | **OBSERVED** — no SERP/query contamination (Recent Searches localStorage is out of scope here) |
| Back / forward | **OBSERVED DEFECT** — see below |

## Back / forward (stale SPA state)

Flow inspected:

```text
search hinge → search screw → goBack() → goForward()
```

| Step | URL `q` | Input | Heading | Products |
|---|---|---|---|---|
| On screw | screw | screw | Search Results for "screw" | screw-related |
| After **goBack** | **hinge** | **screw** (stale) | **Search Results for "screw"** (stale) | **screw products** (stale) |
| After goForward | screw | screw | Search Results for "screw" | screw-related |

**EXPECTED:** After back, URL/UI/results should agree on `hinge` (or the app should not change the URL without updating UI).

**ACTUAL:** History URL updates to `q=hinge` while React UI remains on screw. Likely **client-side routing / React state** out of sync with History API — **not** HTTP browser cache (Search API is `no-cache`; no service worker).

`CACHE-005` asserts URL↔UI synchronization after back/forward and **must fail** while this defect remains. Do not weaken the assertion to greenwash.

## Distinguishing queries

Use `hinge`, `blum`, `screw` — suggestions and SERP headings differ when UI has settled.

Primary readiness signals:

1. URL pathname `/search` + `q` param
2. Visible search input value
3. Heading `Search Results for "<query>"` (or No Results)
4. Optional: Products tab / product-title presence (not exact SKU lists)

## Out of scope

Recent Searches localStorage deep tests, Zod, security/injection, OS cache, session-storage deep suites.
