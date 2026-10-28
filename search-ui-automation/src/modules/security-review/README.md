# Security review module

Passive, read-only security assessment of a storefront. It browses a few public pages, inspects headers/cookies/TLS, probes well-known files, watches network/console traffic, and writes a team-ready HTML + JSON report.

It does **not** brute-force logins, bypass authentication, send destructive requests, or exploit findings.

## What it covers

| Area | What is observed |
|---|---|
| Broken links / assets | Failed CSS/JS/image/font requests on visited pages |
| Client-side security | Secret-like strings in HTML/JS, source maps, leftover debug text |
| HTTP headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-* |
| Cookies | `Secure`, `HttpOnly`, `SameSite` on cookies set while browsing |
| Auth surface | Public probes of `/admin`, `/login`, `/sign-in`, `/my-account`, `/checkout` (GET only) |
| Network | Mixed content, sensitive query params, unauthenticated APIs, CORS `*` |
| Console | JavaScript errors |
| Forms | Password field method / autocomplete (no form submit) |
| SSL/TLS | Certificate trust and HTTP→HTTPS redirect |
| Sensitive files | `robots.txt`, `sitemap.xml`, `.env`, `.git/config`, `security.txt`, favicon |
| Performance | High script counts during the short browse |

## Configure the website URL

The module never requires a code change to switch hosts. Resolution order:

1. `--url=` on the CLI
2. `SECURITY_REVIEW_BASE_URL`
3. `BASE_URL`
4. The URL for `ENV=qa|staging|production` in `config/environments.ts`

```bash
cd search-ui-automation

# Default QA host from ENV (qa → https://qa-baersupply.vercel.app)
npm run test:security-review

# Any website
npm run test:security-review -- --url=https://next-baersupply.vercel.app
npm run test:security-review -- --url=https://wurthbaersupply.com --fail-on=none

# Same thing via env vars
BASE_URL=https://next-baersupply.vercel.app npm run test:security-review
ENV=production npm run test:security-review
```

## Commands

```bash
npm run test:security-review
npm run test:security-review -- --headed
npm run test:security-review -- --open
npm run test:security-review -- --url=https://example.com --max-pages=12 --paths=/cart,/sign-in,/search
npm run test:security-review -- --fail-on=none
```

`--fail-on` controls whether Playwright **fails the run** after the report is written:

| Value | Fail when confirmed findings include |
|---|---|
| `none` | Never fail (report-only) |
| `critical` | Critical |
| `high` (default) | Critical or High |
| `medium` | Medium and above |
| `all` | Any Low+ finding |

## Environment variables

| Variable | Purpose |
|---|---|
| `SECURITY_REVIEW_BASE_URL` / `--url=` | Target origin |
| `BASE_URL` / `ENV` | Framework fallbacks |
| `SECURITY_REVIEW_PATHS` / `--paths=` | Extra paths to browse (comma-separated) |
| `SECURITY_REVIEW_MAX_PAGES` | Max pages to open in the browser (default `8`) |
| `SECURITY_REVIEW_MAX_SCRIPTS` | Max JS files to download for secret/source-map scan (default `12`) |
| `SECURITY_REVIEW_FAIL_ON` | `none` \| `critical` \| `high` \| `medium` \| `all` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Optional QA checkpoint bypass (same as other modules) |

Keep volume low. This is a review, not a crawler. Use the broken-links module for deep link walks.

## Reports

After a run:

- `reports/security-review.html` — shareable report (Print → Save as PDF)
- `reports/security-review.json` — machine-readable findings
- `reports/playwright-results.security-review.json` — Playwright result file

Open the HTML file in a browser, or pass `--open`.

## Scope rules

- GET/HEAD/browser navigation only
- No login brute force, privilege escalation, or payload injection
- No high-concurrency crawling
- Potential issues that cannot be confirmed are labelled in the HTML report

## Layout

```text
src/modules/security-review/
├── README.md
├── config.ts
├── types.ts
├── tls.ts
├── scan.ts
├── runReview.ts
├── report.ts
└── tests/security-review.spec.ts
```

The Playwright project lives in `playwright.security-review.config.ts` so this module does not run with the Search UI smoke/regression suites.
