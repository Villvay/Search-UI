# Search Dropdown + Suggestions — discovered behavior

Target: Würth Baer Supply QA (`https://qa-baersupply.vercel.app`)

Inspection: live Playwright probes (desktop 1440×900 and mobile 375×812).

## Structure

| Area | Observed |
|---|---|
| Dropdown panel | Visible `div` with classes including `relative z-50 rounded-[1.25rem] border ... shadow-md` |
| Idle (empty focus) | **"Trending now"** heading (observed as level 4) + trending term **buttons** named by term text (e.g. `makita`) |
| Active query (≥2 chars) | `[data-search-column="suggestions"]` with `[data-search-suggestion]` **buttons** |
| Results column | `[data-search-column="results"]` with product **links** (`a[href]`), often including image + `Item # …` |
| Headings in active UI | e.g. Categories / Brands (section labels); tabs All/Products/Catalogs/Resources may appear when results populate |
| Clear control | Button named **Clear search** when input has text |
| Empty match state | **"No Suggestions to Display"** (and often **"No Products Found"** in results) |

## Suggestion item contract

- Element: `button[data-search-suggestion]`
- Attribute formats observed:
  - `PRODUCT_TYPE:hinge`
  - `PRODUCT_TYPE:hinge:broad`
  - `BRAND:blum`
  - `BRAND_PT:blum hinges:broad`
  - `SKU:blu111c`
- **Hidden duplicate nodes** can exist in the DOM; always use the **visible** suggestions column.

## Selection behavior

| Action | Result |
|---|---|
| Click suggestion (e.g. PRODUCT_TYPE:hinge) | Navigate to `/search?q=…` with `route` PLP filter JSON; input shows query text |
| Click product result link | Navigate to PDP `/product/...` |
| Clear search | Returns to trending/idle dropdown |

## Keyboard

| Key | Observed |
|---|---|
| Escape | Closes active suggestion columns; input value retained; idle/trending can return while focused |
| ArrowUp / ArrowDown | **Not reliably supported** for moving focus/`aria-selected` onto suggestion buttons during inspection |
| Enter after ArrowDown | **Not automated** as suggestion-selection (no reliable highlight contract); plain Enter search belongs to ON-ENTER |
| Tab | Moves focus away from the input; not used as suggestion selection |

## Layout

- Desktop: dropdown sits under the header search; not clipped horizontally in 1440×900 probes.
- Mobile: same DOM contract; assert usability (visible, clickable, not fully outside viewport) rather than pixel-perfect geometry.

## Synchronization

- Debounce ≈ 300ms then `/suggestions?query=…`
- Columns can take **~1s+** after network; prefer locator + response waits over fixed sleeps.
