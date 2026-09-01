# On-Enter search — discovered application behavior

Target: Würth Baer Supply QA (`https://qa-baersupply.vercel.app`)

Inspection: live Playwright probes (desktop 1440×900 and mobile 375×812).

## Happy path

1. Focus search input
2. Type a query (suggestions dropdown may appear)
3. Press **Enter**
4. Browser navigates to:

```text
/search?q=<submitted-query>
```

5. Search input **retains** the submitted query
6. Results page shows heading:

```text
Search Results for "<query>"
```

7. **Products** tab and pagination text like `page X of Y` may appear when products exist

### Important distinction vs suggestion click

| Action | URL shape |
|---|---|
| **Enter** (normal search) | `/search?q=hinge` — **no** `route` param |
| Suggestion click (Step 3) | `/search?q=hinge&route={...PLP filter...}` |

ON-ENTER validates normal Enter search only. It does **not** assert suggestion selection via Enter (Step 3 found no reliable highlight contract).

Enter still executes normal search when the suggestions dropdown is open (ENTER-013).

## Empty / whitespace / no-result

| Input | Observed |
|---|---|
| Empty (`""`) | **No navigation** — remains on current page |
| Whitespace (`"   "`) | Navigates to `/search?q=+++` (param value is three spaces) and shows **No Results** empty state |
| `zzzznonexistentproduct12345` | `/search?q=…` with **No Results** heading + “We couldn't find any results matching your search…” |

The no-results message can appear in more than one region (e.g. Products panel and `main`). Assertions should scope to `main`.

## Other query shapes

| Query | Observed |
|---|---|
| Numeric (`12345`) | `/search?q=12345` + Search Results heading |
| Alphanumeric non-SKU (`abc123`) | `/search?q=abc123` + Search Results heading |
| Special (`hinge@#$`) | `/search?q=hinge@%23$` + Search Results heading |
| Long (80× `a`) | `/search?q=aaa…` + Search Results heading |
| Exact SKU (`BLU111C`) | May land on `/search` briefly, then **redirect to PDP** `/product/...` — not covered as SERP Enter |

## Repeated Enter

Pressing Enter multiple times rapidly after typing a query produced **one** navigation to `/search?q=…` (additional RSC fetches may occur). Assert final URL/state, not brittle request counts. Not automated as a separate brittle test.

## Replace query

From results for Query A, clear/type Query B and press Enter → URL and input update to Query B.

## Mobile

Same Enter → `/search?q=…` contract. Search input may require the header **Search** button on some narrow layouts (core `SearchBox.ensureVisible()` handles this).

## Loading

No stable, assertable full-page loading indicator was observed for Enter search. Prefer URL + results-heading / empty-state locators.

## Environment note

QA preview can intermittently show **Vercel Security Checkpoint** (“Failed to verify your browser”). That is environmental, not Enter-behavior failure.
