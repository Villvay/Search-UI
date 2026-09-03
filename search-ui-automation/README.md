# Search UI Automation

Playwright + TypeScript framework for automating the Würth Baer Supply **Search UI** across desktop, tablet, and mobile viewports.

This repository contains a Playwright + TypeScript Search UI automation framework with modular feature suites (on-type, suggestions, on-enter, related-searches), analytics coverage, and fast execution profiles.

## Target application

| Environment | Default base URL |
|---|---|
| QA | `https://qa-baersupply.vercel.app` |
| Staging | `https://wurthbaersupply.com` (override with `BASE_URL` if needed) |
| Production | `https://shop.wurthbaerusa.com` |

Inspected Search entry points:

- Global search input in the site header (home and other pages)
- Search results route: `/search?q=...` (feature tests later)

## Project setup

```bash
cd search-ui-automation
cp .env.example .env
npm install
npx playwright install chromium
```

### Dependencies

- `@playwright/test` — browser automation and test runner
- `typescript` — typed page objects and config
- `dotenv` — local environment loading
- `@types/node` — Node typings for config scripts

## Environment configuration

Select the environment without changing test code:

```bash
ENV=qa npm run test
ENV=staging npm run test
ENV=production npm run test
```

Optional overrides (via `.env` or shell):

| Variable | Purpose |
|---|---|
| `ENV` | `qa` \| `staging` \| `production` (default `qa`) |
| `BASE_URL` | Override the selected environment’s base URL |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Bypass Vercel Deployment Protection when required |

Do not commit credentials or bypass secrets. Keep them in `.env` (gitignored) or CI secrets.

## Viewport configuration

Defined in `config/viewports.ts` and wired as Playwright projects:

| Project | Size | Category |
|---|---|---|
| `desktop-1440` | 1440 × 900 | Desktop (canonical Chromium) |
| `desktop-1440-firefox` | 1440 × 900 | Desktop Firefox |
| `desktop-1440-safari` | 1440 × 900 | Desktop Safari/WebKit — **only when `INCLUDE_SAFARI=1`** |
| `desktop-1280` | 1280 × 800 | Desktop |
| `tablet-1024` | 1024 × 768 | Tablet |
| `tablet-768` | 768 × 1024 | Tablet |
| `mobile-390` | 390 × 844 | Mobile |
| `mobile-375` | 375 × 812 | Mobile |

The **same** test files run against whichever projects you select. Do not duplicate specs per viewport.

## Project structure

```text
search-ui-automation/
├── src/
│   ├── core/
│   │   ├── pages/          # BasePage, SearchPage (minimal)
│   │   ├── components/     # SearchBox and shared UI pieces
│   │   ├── fixtures/       # Playwright fixtures
│   │   ├── assertions/     # Shared non-feature assertions
│   │   └── utils/          # Small shared helpers
│   ├── modules/            # Future independent feature modules
│   └── test-data/          # Data separated from test logic
├── tests/                  # Specs (framework validation only in Step 1)
├── config/                 # Environments, viewports, selector notes
├── reports/                # HTML report output
├── playwright.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## How to run tests

### Execution profiles (fast path)

| Profile | Command | Scope |
|---|---|---|
| **Smoke** | `npm run test:smoke` | Chromium `desktop-1440`, `@smoke` critical paths (ON-TYPE / SUGGESTIONS / ON-ENTER) |
| **Analytics smoke** | `npm run test:analytics:smoke` | Chromium `desktop-1440`, **15** representative queries from the full analytics dataset × 3 modules |
| **Full analytics** | `npm run test:analytics` | Chromium `desktop-1440`, **complete** analytics dataset (currently Non-SKU top **50**) × 3 modules |
| **Batched analytics** | `npm run test:analytics:batched` | New SKU/Non-SKU top-50 dataset (**200** rows); **Browser/Viewport → all queries × 3 modules** on one page before next viewport |

Recommended tiers:

```text
PR       → npm run test:smoke
Daily    → npm run test:analytics:smoke
Nightly  → npm run test:nightly   # @responsive + @analytics across configured projects
Release  → npm run test:search-ui + Firefox (test:desktop-1440:browsers)
Safari   → INCLUDE_SAFARI=1 … (opt-in only)
```

### Tags

```bash
npx playwright test --project=desktop-1440 --grep @smoke
npx playwright test --project=desktop-1440 --grep @analytics
npx playwright test --grep @responsive
```

### Environment variables

| Variable | Purpose |
|---|---|
| `INCLUDE_SAFARI=1` | Register `desktop-1440-safari` (WebKit). **Off by default** — QA Vercel checkpoint blocks WebKit. |
| `ANALYTICS_WORKERS=1..4` | Parallel workers for analytics runner (default `1`; smoke defaults to `3`). For **batched**, shards by **viewport/project**, not by query. |
| `ANALYTICS_DATASET` | `default` / `queries-50` (existing) or `top50-sku-nonsku` (new PDF dataset; batched default) |
| `ANALYTICS_MODULES` | Batched module filter: `on-type`, `suggestions`, `on-enter` (comma-separated; default all three) |
| `ANALYTICS_PROFILE=smoke` | Use the fixed 15-ID subset from `smoke-query-ids.json` (same dataset file) |
| `ANALYTICS_LIMIT` / `ANALYTICS_IDS` | Optional filters on top of the profile |
| `ANALYTICS_CATEGORY` / `ANALYTICS_LIST` | Optional filters on the new SKU/Non-SKU dataset |
| `ANALYTICS_SEQUENTIAL=1` | Run analytics modules one-by-one (lower disk use; legacy runner only) |
| `SKU_DATASET` | Path to SKU list JSON `{ "skus": [...] }` or catalog NDJSON for `npm run test:sku-plp` |
| `SKU_LIMIT` | Cap unique SKUs loaded from the dataset |
| `SKU_CACHE_SEQUENCES=0` | Disable A→B→C→A sequence expansion (run file order only) |
| `ENV` / `BASE_URL` / `VERCEL_AUTOMATION_BYPASS_SECRET` | Target app + protection bypass |

Examples:

```bash
INCLUDE_SAFARI=1 npm run test
ANALYTICS_WORKERS=2 npm run test:analytics
ANALYTICS_WORKERS=4 npm run test:analytics:smoke

# Viewport-batched (new dataset): one page per viewport runs all queries
ANALYTICS_WORKERS=1 npm run test:analytics:batched -- --project=desktop-1440
ANALYTICS_WORKERS=2 npm run test:analytics:batched
```

Safari is **not** included in normal runs (`npm run test`, full suite, analytics). Chromium and Firefox projects remain available; Firefox is used by `test:desktop-1440:browsers`.

Canonical desktop Chromium project is **`desktop-1440`** (1440×900). The former duplicate `desktop-1440-chrome` project was removed.

### Module and suite commands

```bash
# Default: framework validation on desktop 1440×900
npm run test

# On-type / suggestions / on-enter / related-searches modules
npm run test:on-type
npm run test:suggestions
npm run test:on-enter
npm run test:related-searches
npm run test:filters
npm run test:filters:responsive
npm run test:sorting
npm run test:sorting:responsive
npm run test:sku-plp

# Full Search UI suite (feature modules + framework validation × viewports)
npm run test:search-ui

# Open last HTML report / regenerate summary from latest JSON
npm run test:report
npm run test:summary

# Headed / debug (framework validation)
npm run test:headed
npm run test:debug
```

### Viewport commands

```bash
npm run test:desktop      # 1440×900 + 1280×800
npm run test:tablet       # 1024×768 + 768×1024
npm run test:mobile       # 390×844 + 375×812
npm run test:responsive   # specs tagged @responsive
```

Examples:

```bash
ENV=qa npm run test:smoke
ENV=qa npm run test:analytics:smoke
ENV=qa npm run test:analytics
ENV=qa ANALYTICS_WORKERS=2 npm run test:analytics
ENV=qa INCLUDE_SAFARI=1 npm run test:on-type -- --project=desktop-1440-safari
ENV=qa npm run test:search-ui
ENV=qa npm run test:sku-plp
SKU_LIMIT=5 ENV=qa npm run test:sku-plp
```

Runtime before/after measurements for the fast profiles live in [`reports/runtime-comparison.md`](./reports/runtime-comparison.md).

## Reporting

- Consolidated HTML: `reports/html/index.html` (`npm run test:report`)
- Machine-readable results: `reports/search-ui-playwright-results.json` (full suite archive)
- Consolidated summary: `reports/search-ui-summary.md` + `reports/search-ui-summary.json` (`npm run test:summary`)
- SKU → PLP cache: `reports/sku-plp/sku_search_results.json` + `.md` (`npm run test:sku-plp`)
- Failure screenshots/traces: captured on **module-level** runs (`screenshot: only-on-failure`, `trace: on-first-retry`)
- Full-suite runs disable screenshots/traces to avoid disk exhaustion (`ENOSPC`)

Full Search UI workflow:

```bash
ENV=qa npm run test:search-ui
# → cleans artifacts
# → runs ON-TYPE / SUGGESTIONS / ON-ENTER / RELATED SEARCHES (+ framework validation)
#   across all six viewports
# → writes Markdown/JSON summary + HTML report
```

## Selector decisions (Step 1)

Preference order: `data-testid` → role/name → semantic attributes → CSS → XPath.

| Element | Decision | Reason |
|---|---|---|
| Search input | `getByRole('textbox', { name: 'What are you looking for?' }).first()` | No `data-testid` on the input; placeholder-backed accessible name is stable |
| Open search (narrow layouts) | `getByRole('button', { name: 'Search', exact: true })` | Used only when the input is not yet visible |
| Fallback (documented only) | `input[name="query"]` | Present on the live DOM; not preferred over role/name |

Also observed:

- Site exposes `data-testid` on other widgets (product cards, cart actions), but **not** on the search input
- Auth is optional for basic input interaction
- No blocking cookie/consent dialog was observed during foundation inspection
- Preview hosts may require `VERCEL_AUTOMATION_BYPASS_SECRET`

## Architecture principles

1. Feature modules must be independent (no cross-feature imports).
2. Feature modules may use shared code from `src/core/` only.
3. Never put feature-specific business logic into core.
4. Do not grow `SearchPage` into a mega page object — add modules later.
5. Do not duplicate the same test per viewport — use projects.
6. Keep test data in `src/test-data/`, separate from assertions/flow.
7. Tests must remain independently executable.
8. Add abstractions only when they solve a real reuse problem.

## Step 1 scope

Included:

- Playwright + TypeScript foundation
- Environment + viewport configuration
- `BasePage`, `SearchPage`, `SearchBox`
- Framework validation test (open → type → clear)

## Step 2 scope

Included:

- Independent `src/modules/on-type/` module
- On-type UI state tests (threshold, incremental typing, clear, replace, rapid, edge inputs)
- `npm run test:on-type`

## Step 3 scope

Included:

- Independent `src/modules/suggestions/` module
- Core `SearchDropdown` component
- Dropdown / suggestion / product-result / Escape / responsive layout tests
- `npm run test:suggestions`

## Step 4 scope

Included:

- Independent `src/modules/on-enter/` module
- Enter-key normal search navigation and SERP/empty-state validation
- `npm run test:on-enter`
- Core `SearchBox.pressEnter()` helper (shared submit primitive)

## Step 5 scope

Included:

- Independent `src/modules/related-searches/` module
- Related Searches live in the **suggestions dropdown** (not SERP)
- Visibility / content / click-navigation / empty-state / SERP-absence checks
- `npm run test:related-searches`
- Core `SearchPage.openSearchResults()` remains available for SERP absence checks

Not included (later steps):

- Filters, facets, sorting, pagination, results UI regression
- SKU analytics dataset (add when provided — do not invent queries)

Analytics (Non-SKU top 50) and execution profiles (`test:smoke`, `test:analytics:smoke`, `test:analytics`) are included — see **Execution profiles** above.
