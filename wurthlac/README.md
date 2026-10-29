# Würth LAC Search UI Automation

Playwright + TypeScript UI automation for the **Würth Louis & Company / Würth LAC** search experience.

This project is independent of the Würth Baer suite in [`../search-ui-automation/`](../search-ui-automation/). It has its own configuration, selectors, test data, reports, and commands.

## 1. Purpose

Verify the storefront search UI on Würth LAC: on-type dropdown, enter-key search, recent searches, filters, search state, input robustness, runtime errors, and sorting availability.

See [`FEATURE-MATRIX.md`](./FEATURE-MATRIX.md) for what was inspected on the live site.

## 2. Folder structure

```text
wurthlac/
├── config/                 # environments, viewports, selectors, cycles
├── src/core/               # SearchPage, SearchBox, dropdown, filters, fixtures
├── src/modules/            # feature modules (data / pages / assertions / tests)
├── tests/                  # framework validation
├── scripts/                # smoke/regression runner + report generators
├── reports/                # WLAC-only artifacts
├── playwright.config.ts
└── README.md
```

## 3. Prerequisites

- Node.js 20+
- npm
- Playwright browsers (`npx playwright install chromium`)

## 4. Installation

```bash
cd wurthlac
cp .env.example .env
npm install
npx playwright install chromium
```

## 5. Environment configuration

| Variable | Purpose |
|---|---|
| `ENV` | `qa` \| `staging` \| `production` (default `qa`) |
| `BASE_URL` | Override the selected environment’s base URL |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Optional bypass when targeting a Vercel preview host |

The suite refuses Würth Baer hosts so a missing override cannot silently run against Baer.

## 6. Configured environments

| ENV | Host |
|---|---|
| `qa` (default) | `https://wurthlac.com` |
| `staging` | Not hard-coded. Set `BASE_URL`. |
| `production` | Not hard-coded. Set `BASE_URL`. |

`wurthlac.com` is the public Louis & Company storefront. It is the configured QA target for this project. Distinct staging/production URLs were not provided and are not invented.

## 7. Smoke

```bash
cd wurthlac
npm run test:smoke
```

Chromium `desktop-1440`, tests tagged `@smoke`.

Headed: `npm run test:smoke:headed`  
Responsive: `npm run test:smoke:responsive`

## 8. Regression

```bash
cd wurthlac
npm run test:regression
```

All applicable functional tests on `desktop-1440`.

Responsive: `npm run test:regression:responsive`

## 9. Responsive execution

```bash
npm run test:responsive
npm run test:desktop
npm run test:tablet
npm run test:mobile
```

Viewports: 1440×900, 1280×800, 1024×768, 768×1024, 390×844, 375×812.

## 10. Cross-browser execution

```bash
npm run test:cross-browser
```

Chromium + Firefox at desktop 1440, `@smoke` only. Safari is opt-in with `INCLUDE_SAFARI=1`.

## 11. Report generation

```bash
npm run test:summary
npm run report
```

Artifacts stay under `wurthlac/reports/` and do not overwrite Baer reports.

| Cycle | JSON | Dashboard | Text |
|---|---|---|---|
| Smoke | `reports/search-ui-smoke-report.json` | `reports/html/search-ui-smoke-dashboard.html` | `reports/search-ui-smoke-summary.txt` |
| Regression | `reports/search-ui-regression-report.json` | `reports/html/search-ui-regression-dashboard.html` | `reports/search-ui-regression-summary.txt` |

## 12. Test tags

| Tag | Use |
|---|---|
| `@smoke` | Daily health check |
| `@responsive` | Viewport-sensitive cases |
| `@filters` / `@sorting` / `@barcode` | Module scripts |

There is no `@regression` tag. Regression runs every test in the cycle module list.

## 13. How to add a new feature module

1. Create `src/modules/<feature>/{data,pages,assertions,tests}`.
2. Keep locators in page objects / core components.
3. Tag smoke cases with `@smoke`.
4. Register the spec path in `config/search-ui-cycles.mjs` if it belongs in smoke or regression.

## 14. How to add new search queries

Edit the module `data/queries.ts` file. Validate the query against `https://wurthlac.com` before treating the outcome as ground truth. Do not copy Baer SKUs or catalog terms without checking the LAC catalog.

## 15. How to investigate failures

1. Open `reports/html/search-ui-smoke-dashboard.html` or the Playwright HTML report.
2. Check `test-results/` screenshots and traces.
3. Re-run the failing spec: `npx playwright test src/modules/<module>/tests/<file>.spec.ts --project=desktop-1440`.

## 16. Known environment limitations

- The Cursor embedded browser did not always expand the dropdown or submit Enter; Playwright Chromium is the execution environment.
- Staging and production hosts are unknown until provided.
- Barcode/SKU lookup API host is unverified.
- Public `wurthlac.com` did not show a Vercel checkpoint during inspection.
- Guest storefront calls to `xcart.wurthlac.com/rest/auth/login-check` return HTTP 401; the runtime suite classifies that as expected guest auth, not a search defect.
- Compact viewports (≤768px) focus the header search field without the desktop idle overlay.

## 17. Unsupported or not yet verified

| Feature | Status |
|---|---|
| Trending now | Not supported on the inspected storefront. Excluded from cycles. |
| Related searches | Not supported. Excluded from cycles. |
| Sorting UI | Absent. SORT-001 documents the absence contract. |
| Barcode API | Not verified. UI scanner control is tested. |
| Analytics, image search, crawler, accuracy | Out of scope for this suite. |

## 18. How to run WLAC and Baer independently

From the repository root:

```bash
npm run wlac:smoke
npm run wlac:regression
npm run baer:smoke
npm run baer:regression
```

Or from each project folder:

```bash
cd wurthlac && npm run test:smoke
cd search-ui-automation && npm run test:smoke
```
