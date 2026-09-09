# Your Recent Searches — discovered behavior

Target: Würth Baer Supply QA (`https://qa-baersupply.vercel.app`)

Inspection: live Playwright probes (desktop 1440×900), Sep 2026.

## Flow

```text
Empty search focus (with local history)
  → dropdown opens
  → "Your recent searches" section (above Trending now)
  → up to 5 query rows
```

```text
No history → section is absent (no empty-state copy); Trending now may still show
```

## Storage mechanism

| Mechanism | Used? |
|---|---|
| **localStorage** | **Yes** — key `recentSearches` |
| sessionStorage | No (unrelated keys only) |
| cookies | No recent-search payload |
| IndexedDB | No |
| Backend / recent API | No requests observed |
| Auth-account history | Not observed for this feature |

### `localStorage.recentSearches`

- **Serialization:** JSON array of strings, e.g. `["dup-c","dup-e","dup-d","dup-b","dup-a"]`
- **Order:** **newest first** (index `0` = latest)
- **Maximum:** **5** entries (6th search drops the oldest)
- **Written when:** user submits a search (Enter → `/search?q=…`). **Not** written on type-only, and **not** written by direct `goto('/search?q=…')` alone
- **Deduplication:** re-searching an existing term **moves it to index 0**; no duplicate rows
- **Remove:** updates array in place (item removed; order of others preserved)
- **Persistence:** survives dropdown close/reopen, in-app navigation, and **full page refresh** (same browser profile/origin)
- **Isolation:** new Playwright browser context starts with empty history (not shared). Not tied to signed-in account in QA probes

Test setup/cleanup should only touch the `recentSearches` key (do not wipe unrelated localStorage).

## DOM / selectors

| Element | Observed |
|---|---|
| Label | `<h4 class="text-sm font-semibold text-black">Your recent searches</h4>` |
| List | Following-sibling `<ol>` (not `<ul>`) |
| Row | `<li class="flex flex-row items-center …">` |
| Query control | `<button type="button">` with clock icon + `<span>{query}</span>` |
| Remove control | Sibling `<button>` with X icon + `<span class="sr-only">Remove recent search "{query}"</span>` |
| data-* | None on recent rows |
| Duplicates | Hidden mobile/desktop clones may exist — prefer **visible** locators scoped under the section |

Trending Now uses a separate following `ul` of chips — never select those as recent items.

## Navigation on query click

- URL: `/search?q=<query>` (URL-decoded `q` matches chip text)
- **No** `route=` param (unlike some suggestion clicks)
- Search input value matches selected query

## User-specific (RECENT-012)

Product copy says history is user-specific. On QA, storage is **browser localStorage**, not verified server-side per account. No safe dual test accounts are configured in this automation env (`.env.example` has no credentials). **RECENT-012 is skipped/unsupported** for authenticated User A vs User B. Optional note: a fresh browser context does not see another context’s `recentSearches`.

## Out of scope

Trending Now / Suggestions module changes, ON-TYPE, ON-ENTER, filters, sorting, analytics, relevance scoring.
