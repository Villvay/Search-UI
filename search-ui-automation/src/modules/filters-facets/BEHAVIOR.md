# Filters & Facets

Independent SERP module for Würth Baer Supply Search UI filters/facets.

## Discovered QA behavior

| Area | Behavior |
| --- | --- |
| Desktop / tablet | Left `aside` accordion (`data-testid="accordion-filter"`) |
| Mobile | **Filters & sort** opens a dialog with the same accordion |
| Facet groups | Accordion triggers `data-testid="trigger-{Facet}"` |
| Options | `role="checkbox"` buttons `data-testid="checkbox-{Facet}-{Value}"` |
| Apply | **Immediate** — URL updates on toggle (no Apply button) |
| URL | `/search?q=…&filters={"Brand":"Blum, Inc."}` (JSON; arrays for multi-select) |
| Clear all | **Clear all** button removes `filters` param |
| Individual clear | Uncheck the same option checkbox |
| Browser Back | **Not supported** for filter undo — toggles use `history.replaceState` |
| No-result combo | No deterministic empty facet pair on QA (FILTER-013 skipped) |

## Commands

```bash
npm run test:filters
npm run test:filters:responsive
npx playwright test --grep @filters
```

## Tags

- `@filters` — all cases
- `@filters @smoke` — FILTER-001, 002, 004, 005
- `@filters @responsive` — describe-level (runs across viewport projects when selected)
