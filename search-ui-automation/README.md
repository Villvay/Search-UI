# Search UI Automation

Playwright + TypeScript framework for automating the Würth Baer Supply **Search UI** across desktop, tablet, and mobile viewports.

This repository currently contains **Step 1 — framework foundation** only. Search feature suites (on-type, on-enter, suggestions, filters, facets, results, etc.) are intentionally not implemented yet.

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
| `desktop-1440` | 1440 × 900 | Desktop |
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

```bash
# Default: framework validation on desktop 1440×900
npm run test

# On-type search module (all configured viewport projects)
npm run test:on-type

# Suggestions / dropdown module
npm run test:suggestions

# On-enter search module
npm run test:on-enter

# Related Searches module
npm run test:related-searches

# Full Search UI suite (all feature modules + framework validation × all viewports)
# Cleans artifacts, runs tests, writes HTML + JSON + Markdown summary
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
npm run test:responsive   # all specs × all viewports
```

Examples:

```bash
ENV=qa npm run test:on-type
ENV=qa npm run test:suggestions
ENV=qa npm run test:on-enter
ENV=qa npm run test:related-searches
ENV=qa npm run test:search-ui
ENV=qa npm run test:summary
ENV=qa npm run test:related-searches -- --project=desktop-1440
ENV=qa npm run test:related-searches -- --project=mobile-390
ENV=qa npm run test:on-enter -- --project=desktop-1440
ENV=qa npm run test:on-enter -- --project=mobile-390
ENV=qa npm run test:suggestions -- --project=desktop-1440
ENV=qa npm run test:suggestions -- --project=mobile-390
ENV=qa npm run test:desktop
ENV=qa npm run test:mobile
```

## Reporting

- Consolidated HTML: `reports/html/index.html` (`npm run test:report`)
- Machine-readable results: `reports/search-ui-playwright-results.json` (full suite archive)
- Consolidated summary: `reports/search-ui-summary.md` + `reports/search-ui-summary.json` (`npm run test:summary`)
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
- Analytics / semantic search modules
