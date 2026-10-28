# Security review

Standalone passive, read-only security assessment of a storefront. It browses a few public pages, inspects headers/cookies/TLS, probes well-known files, watches network/console traffic, and writes a team-ready HTML + JSON report.

This module is the top-level `security-review` folder, next to `search-ui-automation`. It does **not** run with Search UI smoke/regression suites.

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

## Setup

```bash
cd security-review
cp .env.example .env
npm install
npx playwright install chromium
```

System Chrome is used by default (`PW_CHANNEL=chrome`). Install Playwright Chromium only if you want the bundled browser.

## Configure the website URL

The module never requires a code change to switch hosts. Resolution order:

1. `--url=` on the CLI
2. `SECURITY_REVIEW_BASE_URL`
3. `BASE_URL`
4. The URL for `ENV=qa|staging|production`

```bash
cd security-review

# Default QA host from ENV (qa → https://qa-baersupply.vercel.app)
npm test

# Any website
npm test -- --url=https://next-baersupply.vercel.app
npm test -- --url=https://wurthbaersupply.com --fail-on=none

# Same thing via env vars
BASE_URL=https://next-baersupply.vercel.app npm test
ENV=production npm test
```

## Commands

```bash
npm test
npm test -- --headed
npm run test:open
npm test -- --url=https://example.com --max-pages=12 --paths=/cart,/sign-in,/search
npm test -- --fail-on=none
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
| `BASE_URL` / `ENV` | Fallbacks (`qa`, `staging`, `production`) |
| `SECURITY_REVIEW_PATHS` / `--paths=` | Extra paths to browse (comma-separated) |
| `SECURITY_REVIEW_MAX_PAGES` | Max pages to open in the browser (default `8`) |
| `SECURITY_REVIEW_MAX_SCRIPTS` | Max JS files to download for secret/source-map scan (default `12`) |
| `SECURITY_REVIEW_FAIL_ON` | `none` \| `critical` \| `high` \| `medium` \| `all` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Optional QA checkpoint bypass |

Keep volume low. This is a review, not a crawler.

## Reports

After a run:

- `reports/security-review.html` — shareable report (Print → Save as PDF)
- `reports/security-review.json` — machine-readable findings
- `reports/playwright-results.json` — Playwright result file

Open the HTML file in a browser, or pass `--open` / `npm run test:open`.

## Scope rules

- GET/HEAD/browser navigation only
- No login brute force, privilege escalation, or payload injection
- No high-concurrency crawling
- Potential issues that cannot be confirmed are labelled in the HTML report

## Layout

```text
security-review/
├── README.md
├── package.json
├── playwright.config.ts
├── scripts/run.mjs
└── src/
    ├── config.ts
    ├── env.ts
    ├── types.ts
    ├── tls.ts
    ├── scan.ts
    ├── runReview.ts
    ├── report.ts
    └── tests/security-review.spec.ts
```
