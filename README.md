# Search-UI

Playwright + TypeScript automation for Würth search storefronts.

This repository contains **two independent Search UI projects**:

| Site | Project folder | Default host |
|---|---|---|
| Würth Baer Supply | [`search-ui-automation/`](./search-ui-automation/) | See that folder’s README |
| Würth LAC / Louis & Company | [`wurthlac/`](./wurthlac/) | `https://wurthlac.com` |

Do not run one suite against the other site. Reports and artifacts are isolated per folder.

```bash
npm run baer:smoke
npm run baer:regression

npm run wlac:smoke
npm run wlac:regression
```

## Other folders

- [`barcode_navigation_validation/`](./barcode_navigation_validation/) — Barcode → PLP navigation validation for Würth Baer and Würth LAC. See that folder’s README for separate Baer and WLAC run instructions.
- [`security-review/`](./security-review/) — Passive, read-only storefront security review. See that folder’s README for setup and run instructions.
- [`lac-sku-cache/`](./lac-sku-cache/) — SKU cache comparison that runs Würth LAC and Würth Baer from separate catalogs.
