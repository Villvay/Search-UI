# Search Input Robustness — Observed Behavior

Inspection target: `https://qa-baersupply.vercel.app` (QA).  
This module validates unusual search input as **data**. It is not a penetration test or security certification.

Status labels: **OBSERVED** | **EXPECTED** | **UNKNOWN** | **NOT TESTABLE**

---

## 1. Maximum accepted input length

| Status | Detail |
| --- | --- |
| **OBSERVED** | No HTML `maxlength` attribute (`maxLength` prop effectively unlimited / `-1`). |
| **OBSERVED** | Fresh sessions accept at least **100 / 500 / 1000 / 2000** characters via `fill`, navigate to `/search`, and preserve full length in decoded `q`. |
| **UNKNOWN** | Hard server or gateway limit above 2000 (not probed beyond 2000 by design). |

Contract asserted: `SEARCH_INPUT_ROBUSTNESS_BEHAVIOR.observedAcceptedLongLength = 2000`, `htmlMaxLength = null`.

---

## 2. Whitespace behavior

| Status | Detail |
| --- | --- |
| **OBSERVED** | Leading/trailing spaces **preserved** (not trimmed): `" hinge "` → input and `q` = `" hinge "` (URL shows `q=+hinge+`). |
| **OBSERVED** | Multiple internal spaces preserved: `"hinge   screw"` → `q` keeps three spaces. |
| **EXPECTED** | Tests assert preservation; they do **not** normalize whitespace in comparisons. |

---

## 3. Special-character behavior

| Status | Detail |
| --- | --- |
| **OBSERVED** | Characters such as `& / - _ . : + = ? #` are accepted as query text. |
| **OBSERVED** | Browser/URL encoding applies (e.g. `&` → `%26`); decoded `URLSearchParams` `q` matches the typed string. |
| **EXPECTED** | No crash, no unrelated redirect; results may be empty. |

---

## 4. Unicode behavior

| Status | Detail |
| --- | --- |
| **OBSERVED** | `café`, `naïve`, `Müller`, `東京`, `中文` retained in input and decoded `q`. |
| **OBSERVED** | Percent-encoding in the raw URL (e.g. `caf%C3%A9`, `%E6%9D%B1%E4%BA%AC`). |
| **EXPECTED** | Page remains usable; results not required for every term. |

---

## 5. Emoji behavior

| Status | Detail |
| --- | --- |
| **OBSERVED** | `🔧`, `🔩`, `hinge 🔧` accepted; URL encodes emoji; decoded `q` matches. |
| **OBSERVED** | No crash / unexpected navigation during inspection. |

---

## 6. URL encoding behavior

| Status | Detail |
| --- | --- |
| **OBSERVED** | Validation uses `URL` → `URLSearchParams` → `q`, never raw URL string equality. |
| **OBSERVED** | Typed percent-sequences stay **literal**: typing `hinge%20screw` yields decoded `q === "hinge%20screw"` (raw URL may show `%2520`). |
| **OBSERVED** | Some characters (e.g. `?` in `hinge?screw`) may appear unescaped in the raw URL string; decoded `q` still matches the typed value. |
| **EXPECTED** | Tests do not auto-decode typed `%XX` before comparison. |

---

## 7. HTML handling

| Status | Detail |
| --- | --- |
| **OBSERVED** | Strings like `<b>hinge</b>`, `<img src=x>`, `<div>hinge</div>` are treated as text. |
| **OBSERVED** | No `img[src=x]` injection into the document from the query. |
| **OBSERVED** | SERP heading can show literal tags in text (not rendered as HTML elements). |
| **EXPECTED** | No assertion against a specific sanitizer library. |

---

## 8. JavaScript-like input handling

| Status | Detail |
| --- | --- |
| **OBSERVED** | Harmless data strings `<script>alert(1)</script>`, `javascript:alert(1)`, `"><script>alert(1)</script>` navigate as query text. |
| **OBSERVED** | No dialog during inspection; Playwright dialog listener fails the test if one appears. |
| **EXPECTED** | No JS execution from the query string; query remains data. |

---

## 9. Empty input behavior

| Status | Detail |
| --- | --- |
| **OBSERVED** | Clear + Enter does **not** navigate (stays on home) — aligned with ON-ENTER. |
| **EXPECTED** | `emptyEnterNavigates = false`. Lightweight check that Trending Now can still appear on empty focus when the product shows it. |

---

## 10. Whitespace-only behavior

| Status | Detail |
| --- | --- |
| **OBSERVED** | `"     "` (spaces) **does** navigate to `/search?q=+++++` (decoded spaces). |
| **OBSERVED** | Typically **No Results**; not treated as identical to empty Enter. |
| **EXPECTED** | `whitespaceOnlyNavigates = true`. |

---

## 11. Long-input behavior

| Status | Detail |
| --- | --- |
| **OBSERVED** | 100–2000 character deterministic strings accepted without truncation on a fresh page. |
| **OBSERVED** | Reports use `length=N` rather than dumping the full string. |
| **UNKNOWN** | Layout polish for extremely long headings beyond readability. |

---

## 12. Actual application defects

| Status | Detail |
| --- | --- |
| **UNKNOWN** | None confirmed from input-robustness inspection alone at module creation. |
| **EXPECTED** | If a dialog, DOM injection, crash, or unexpected runtime error appears, keep the failing assertion and document Input / Expected / Actual / Reproduction / Evidence / Likely cause. |

Related known defect outside this module: CACHE-005 (history back URL vs SERP UI desync) — not re-tested here.

---

## 13. Environment limitations

| Status | Detail |
| --- | --- |
| **OBSERVED** | QA Vercel protection bypass header required in automation env. |
| **NOT TESTABLE** | Intentional exploit / SQL injection / auth bypass (out of scope). |
| **NOT TESTABLE** | Megabyte payloads and API flooding (explicitly forbidden). |
| **UNKNOWN** | Production may differ from QA encoding or limits. |

---

## SearchBox / ON-TYPE / ON-ENTER notes

- Core `SearchBox` uses accessible role + placeholder; `fill` / Enter; no maxlength enforcement in the component wrapper.
- ON-ENTER empty: no navigation; whitespace Enter → No Results SERP (this module re-asserts that contract lightly).
- Runtime: reuses `RuntimeErrorCollector` from `runtime-errors` (INPUT-017); does not create a second collector implementation.
