# Runtime Errors — Console & Network Monitoring

Target: Würth Baer Supply QA (`https://qa-baersupply.vercel.app`)

Step 6 quality-monitoring module. Does not replace functional module assertions.

## Purpose

Attach per-page listeners and classify browser/runtime signals while exercising Search UI flows:

| Signal | Playwright event |
|---|---|
| Console errors | `console` (`type === 'error'`) |
| Console warnings | `console` (`type === 'warning'`) — recorded, do not fail by default |
| Uncaught JS | `pageerror` |
| Transport failures | `requestfailed` |
| HTTP 4xx/5xx | `response` |

## Search endpoints observed (QA)

First-party Search API host: `search-api-wurthbaer-qa.search-villvay.workers.dev`

| Flow | Endpoints |
|---|---|
| Empty focus / Trending | `GET /trending?size=8` |
| On-type / Suggestions | `GET /suggestions?query=…` |
| Enter / SRP | `GET /multisearch?query=…`, document `/search?q=…` |
| Filters | SERP URL `filters` param + same multisearch refresh (no separate facet API observed) |
| Recent Searches | **localStorage only** — no recent/history API |

Storefront origin: `qa-baersupply.vercel.app` (and env `BASE_URL`).

## Classification

```text
UNEXPECTED — fail the test (Search UI / first-party / unclassified page errors)
EXPECTED   — known application defects under observation (still reported)
IGNORED    — third-party / analytics / accessibility widget noise
```

### IGNORED hosts / patterns (QA noise)

- `cdn.acsbapp.com` (accessibility widget 404 config)
- `connect.facebook.net`, `facebook.com`, `api.hubapi.com`, `hs-analytics`, `hs-scripts`
- `core.service.elfsight.com`, `elfsightcdn.com`
- `google-analytics.com`, `googletagmanager.com`, `doubleclick.net`
- `providesupport.com`, CallRail / Clarity / Bing tracking hosts
- Browser console echoes: `Failed to load resource: the server responded with a status of 404`

### EXPECTED (known application defect — not hidden)

QA consistently emits **React minified error #418** (hydration mismatch) as a `pageerror` on load. This is treated as **EXPECTED** with reason documented here so the monitor stays actionable for Search API regressions, while the defect remains visible in reports (`expected` counts + annotations). It is **not** third-party noise.

Do not expand EXPECTED casually — prefer failing UNEXPECTED Search API / first-party failures.

## Strictness

```text
RUNTIME_ERRORS_STRICT=1
```

When set, EXPECTED application defects (e.g. React #418) are treated as failing UNEXPECTED.

## Isolation

- Collector attaches to a single Playwright `Page`
- Reset/detach per test — no cross-worker globals
- Does not import functional modules (on-type, suggestions, …)
- Reuses `SearchPage` / `SearchBox` / `FiltersPanel` from `src/core/`

## Out of scope

Zod schemas, cache modules, security/malformed-input suites, state-contamination suites.
