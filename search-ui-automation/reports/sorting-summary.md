# Sorting — validation summary

Generated after implementing and validating the Sorting module against QA
(`https://qa-baersupply.vercel.app`).

## Actual application behavior

| Topic | Finding |
| --- | --- |
| Sorting options | **None** — no dedicated Sort UI on SERP |
| Default state | N/A |
| URL/state | No UI-driven sort param; manual `?sort=` does not reorder visible products |
| Refresh | N/A |
| Desktop | No Sort control |
| Tablet | No Sort control |
| Mobile | **Filters & sort** opens filters-only drawer (no Sort section) |

## Coverage

| Test ID | Scenario | Desktop | Tablet | Mobile | Status |
| --- | --- | --- | --- | --- | --- |
| SORT-001 | Sorting control visibility (documents absence) | ✓ | ✓ | ✓ | Passed |
| SORT-002 | Available options | — | — | — | Skipped |
| SORT-003 | Default state | — | — | — | Skipped |
| SORT-004 | Select option | — | — | — | Skipped |
| SORT-005 | Results update | — | — | — | Skipped |
| SORT-006 | URL/state | — | — | — | Skipped |
| SORT-007 | Change between options | — | — | — | Skipped |
| SORT-008 | Refresh persistence | — | — | — | Skipped |
| SORT-009 | Sorting with query | — | — | — | Skipped |
| SORT-010 | Sorting with filters | — | — | — | Skipped |
| SORT-011 | Mobile sorting | — | — | ✓ | Passed (mobile only) |
| SORT-012 | Tablet sorting | — | ✓ | — | Passed (tablet only) |
| SORT-013 | Navigation after sorting | — | — | — | Skipped |

## Skipped scenarios

| Test ID | Reason | Category |
| --- | --- | --- |
| SORT-002 | No sorting UI / options on QA | Unsupported by application |
| SORT-003 | No sorting UI / default | Unsupported by application |
| SORT-004 | No sorting UI | Unsupported by application |
| SORT-005 | No sorting UI | Unsupported by application |
| SORT-006 | No UI-driven URL sort contract | Unsupported by application |
| SORT-007 | No sorting UI / &lt;2 options | Unsupported by application |
| SORT-008 | No sorting UI | Unsupported by application |
| SORT-009 | No sorting UI | Unsupported by application |
| SORT-010 | No sorting UI (future: shared FiltersPanel) | Unsupported by application |
| SORT-013 | No sorting UI / navigation contract | Unsupported by application |

SORT-011 skips on non-mobile projects; SORT-012 skips on non-tablet projects.

## Execution

### Commands

```bash
npm run test:sorting
npm run test:sorting:responsive
npx playwright test --grep @sorting
```

### Validation runs

| Step | Command | Result | Duration |
| --- | --- | --- | --- |
| 1 | `npx tsc --noEmit` | Pass | — |
| 2 | SORT-001 @ desktop-1440 | 1 passed | ~6s |
| 3 | `npm run test:sorting` | 2 passed, 24 skipped | ~7s |
| 4 | tablet projects | 4 passed, 22 skipped | ~11s |
| 5 | mobile projects | 4 passed, 22 skipped | ~10s |
| 6 | `npm run test:sorting:responsive` | **10 passed, 68 skipped, 0 failed** | ~34s |

### Final responsive totals

- **Tests:** 78 (13 IDs × 6 viewports)
- **Passed:** 10 (SORT-001 × 6, SORT-011 × 2, SORT-012 × 2)
- **Skipped:** 68
- **Failed:** 0
- **Browser:** Chromium (Safari remains opt-in via `INCLUDE_SAFARI=1`)

## Smoke

Only **SORT-001** is tagged `@smoke` (documents current absence without slowing the smoke profile). SORT-004/005 stay non-smoke until a real Sort UI ships.

## Defects

None classified as hard product defects. Mobile **Filters & sort** without Sort UI is a **PRODUCT NOTE** (misleading label; see `BEHAVIOR.md`).
