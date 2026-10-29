# Würth LAC Search UI — feature discovery

Inspected live against `https://wurthlac.com/` on 2026-10-29 (desktop 1440×900).

| Feature | Classification | Evidence |
|---|---|---|
| Search input | Supported and verified | `textbox` named “What are you looking for?”, `input[name=query]`, Clear search, Search button, image search, barcode scanner |
| On-type dropdown | Supported and verified | Active query renders `[data-search-column=results]` with Products / Catalogs / Resources tabs, “Categories for …”, “Products for …” |
| Query suggestion chips | Not supported | No `[data-search-column=suggestions]` and no `[data-search-suggestion]` |
| Enter / SERP | Supported and verified | `/search?q=hinge`, heading `Search Results for "hinge"`, Products / Catalogs / Resources tabs, `a.product-title`, pagination `Page 1 of 76` |
| Empty / no-result SERP | Supported and verified | `qwertyuiopasdfghjklzxcvbnm-nomatch-probe` → heading `No Results` and “We couldn't find any results matching your search. Please try again.” |
| Trending now | Not supported | Idle dropdown showed recent searches + “Our search bar just got smarter”; no “Trending now” heading |
| Recent searches | Supported and verified | Heading “Your recent searches”, remove buttons, `localStorage.recentSearches` |
| Filters | Supported and verified | Desktop aside “Filters”; mobile “Filters & sort” dialog; facets Brand, Category, Product Type, …; checkbox “Blum, Inc.”; URL `filters={"Brand":"Blum, Inc."}` |
| Sorting | Not supported | No Sort combobox/select on the inspected SERP. SORT-001 documents absence. |
| Related searches | Not supported | No Related Searches section on SERP or as suggestion chips |
| Barcode scanner UI | Supported and verified | Header button “Open barcode scanner” |
| Barcode / SKU API | Not established | Scanner opens a camera dialog (“Product Barcode Scan” / “Ready to scan”). No barcode lookup HTTP endpoint fired. Baer `/barcode` API must not be reused. |
| Staging / production hosts | Requiring additional information | Only `https://wurthlac.com` is configured as the default QA host |

## Differences from Würth Baer

- Dropdown is a results panel (products + categories + tabs), not query-suggestion chips.
- Filters use an `aside` with named buttons/checkboxes, not `data-testid="accordion-filter"`.
- No Trending now, no Related Searches, no sort control on the inspected storefront.
- Header also includes image search and barcode scanner controls.
- On mobile and tablet (≤768px), focusing the empty search field does not open the desktop idle overlay; the compact header input is focused instead.
