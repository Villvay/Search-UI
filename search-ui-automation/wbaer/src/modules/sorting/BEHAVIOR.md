# Sorting

Independent SERP module for Würth Baer Supply Search UI sorting.

Target: `https://qa-baersupply.vercel.app`  
Inspected: 2026-09-02 (desktop-1440, tablet-768, mobile-390)  
Evidence: `reports/sorting-inspect.json`, `reports/sorting-inspect-deep.json`

## Verdict

**QA does not expose a dedicated sorting control on the Search Results Page.**

| Surface | Sorting UI |
| --- | --- |
| Desktop (1440 / 1280) | **Absent** — no Sort combobox/select/menu/buttons |
| Tablet (1024 / 768) | **Absent** |
| Mobile (390 / 375) | **Absent** as a Sort control. Trigger **Filters & sort** opens a **filters-only** drawer (no Sort heading/options) |

## What was checked

- Role/name locators: `Sort`, `Sort by`, `Order by`, combobox/listbox/select
- `data-testid` containing `sort`
- Visible leaf text: sort / order by / relevance / price / newest
- Product-grid toolbar around `container-productGrid`
- Mobile dialog contents under **Filters & sort**
- Manual URL params (`?sort=…`, `sortBy`, `orderBy`) — retained in the address bar but **do not change** first-page product order / titles

## Discovered options

_None_ (no UI options to list).

## Default / URL / Apply

| Topic | Finding |
| --- | --- |
| Default option | N/A — no control |
| Apply button | N/A |
| Immediate apply | N/A |
| URL contract | No UI-driven sort param; inventing a contract is out of scope |
| Refresh persistence | N/A |
| Browser Back | N/A (no UI-driven sort history) |

## Classification

| Finding | Type |
| --- | --- |
| No sorting control on SERP | **UNSUPPORTED FEATURE** / current product state |
| Mobile label **Filters & sort** without Sort UI | **PRODUCT NOTE** (misleading label; not treated as a hard defect in this suite) |

When sorting ships, set `SORTING_BEHAVIOR.sortingUiPresent = true`, record options in `discoveredOptions`, and unskip SORT-002+.

## Commands

```bash
npm run test:sorting
npm run test:sorting:responsive
npx playwright test --grep @sorting
```

## Tags

- `@sorting` — all cases
- `@sorting @smoke` — SORT-001 only (004/005 when UI ships)
- `@sorting @responsive` — describe-level
