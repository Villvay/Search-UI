# Related Searches — discovered application behavior

Target: Würth Baer Supply QA (`https://qa-baersupply.vercel.app`)

## Verdict (updated)

**Related Searches appear only inside the header search suggestions dropdown.**

They are **not** rendered as a separate section on the Search Results Page (SERP).

| Surface | Related Searches |
|---|---|
| Suggestions dropdown (typed query ≥ 2 chars) | **Present** — suggestion buttons |
| SERP (`/search?q=…`) | **Absent** |
| Idle “Trending now” dropdown | Not Related Searches (different idle state) |

## Dropdown contract

When the user focuses search and types a valid query (≥ 2 characters):

1. Suggestions API: `/suggestions?query=<q>`
2. Column: `[data-search-column="suggestions"]`
3. Related Search items: visible `button[data-search-suggestion]`
4. Attribute examples: `PRODUCT_TYPE:hinge`, `BRAND:blum`, `SKU:blu111c`
5. Display labels may repeat; uniqueness is via `data-search-suggestion` (not visible text)

## Interaction

| Action | Result |
|---|---|
| Click a Related Search item | Navigate to `/search?q=<label>` and typically includes a `route` PLP filter |
| Input after click | Shows the selected Related Search text |
| No-match query | “No Suggestions to Display” (empty Related Searches state) |

## Distinction from other modules

| Module | Owns |
|---|---|
| SUGGESTIONS | Full dropdown (trending, results column, Escape, suggestion *types*, layout) |
| RELATED SEARCHES | Related Search **list** in the suggestions column: visibility, text, count, click → search |
| ON-ENTER | Enter-key normal search (**no** `route` param) |

This module must **not** import `src/modules/suggestions/`. It reuses `src/core/` (`SearchPage`, `SearchBox`, `SearchDropdown`).

## Synchronization

- Debounce ≈ 300ms then suggestions response
- Wait for visible suggestions column / items (or empty-state copy)
- Prefer locator + response waits — no `waitForTimeout`
