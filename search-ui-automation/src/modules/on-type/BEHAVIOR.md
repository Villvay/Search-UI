# On-type search — discovered application behavior

Target: Würth Baer Supply QA (`https://qa-baersupply.vercel.app`)

Inspection method: live Playwright probes on desktop (1440×900) and mobile (375×812).

## Summary

| Topic | Observed behavior |
|---|---|
| Minimum characters | **2**. `"h"` stays idle; `"hi"` activates autocomplete |
| Debounce | **~300ms** (WBS `debounceLength: 300`) then `/suggestions?query=...` |
| Focus empty | Dropdown opens with **"Trending now"** idle content |
| Active on-type UI | `[data-search-column="suggestions"]` (+ often `results`) |
| Clear input | Returns to trending idle; suggestion columns removed |
| No matches | `"No Suggestions to Display"` / `"No Products Found"` messaging |
| Loading spinner | Not reliably observable as a stable assertion target |
| Desktop vs mobile | Same input + dropdown contract; Search toggle may still be needed on some narrow layouts |
| Header vs mobile search | Same accessible input name / component family |

## Notes for assertions

- Assert **UI state transitions** (idle ↔ active), not suggestion ranking/content quality.
- Suggestion content/order belongs to a future SUGGESTIONS module.
