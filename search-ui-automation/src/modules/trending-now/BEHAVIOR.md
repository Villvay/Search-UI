# Trending Now — discovered behavior

Target: Würth Baer Supply QA (`https://qa-baersupply.vercel.app`)

Inspection: live Playwright probes (desktop 1440×900; mobile via SearchBox toggle).

## Flow

```text
Empty search bar → focus/click
  → dropdown opens
  → "Trending now" section
  → trending query buttons
```

```text
Click trending button
  → /search?q=<selected-term>
  → search input shows selected term
  → SERP products load (when the term has results)
```

## Structure

| Area | Observed |
|---|---|
| Heading | `<h4>` **"Trending now"** (accessible heading role, exact name) |
| List | Following-sibling `<ul class="flex flex-row flex-wrap …">` |
| Items | `<li><button type="button">…</button></li>` — **not** links; no `data-*` attrs; no `href` |
| Count | Dynamic (API `/trending?size=8`); inspection saw **8** chips — do not hard-code count in tests |
| Sample terms (ephemeral) | e.g. `makita`, `facets`, `closet rod`, `blum`, SKUs |

## Navigation contract (vs Suggestions)

| Action | URL |
|---|---|
| Trending Now click | `/search?q=<term>` — **no** `route=` param |
| Suggestion (product-type/brand) click | Often `/search?q=…&route=…` (PLP filter JSON) |

## SERP after selection

- Pathname `/search`, query param `q` matches selected chip text (URL-decoded).
- Header search input value equals selected term.
- Products appear as `a.product-title` when the term has catalog hits (e.g. `makita` → dozens of products).
- Heading text may include “Search Results for …” — prefer products / products tab over brittle heading copy when timing varies.

## Viewports

- **Desktop / tablet**: header search input visible; focus/click opens trending.
- **Mobile**: search may be behind **Open search** (or equivalent); use `SearchBox.ensureVisible()` then focus. Same heading + button DOM contract once the input is open.

## Focus note

Clicking/focusing the empty search opens Trending Now. After the idle dropdown paints, `document.activeElement` may not remain on the search `<input>` (observed as `BODY`). Tests treat a successful open (empty input + visible Trending Now) as the focus/click contract rather than asserting `toBeFocused()`.

## Out of scope for this module

Recent Searches, suggestion ranking, analytics events, filters, sorting, pagination, ON-TYPE / ON-ENTER.
