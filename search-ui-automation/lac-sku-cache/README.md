# SKU cache and navigation

Playwright check for stale search results on Würth LAC and Würth Baer. One Chrome window searches each SKU in order and does not reload between searches, so a leftover product page can show up the way it would for a shopper.

The two stores do not share a catalog. Each site has its own URL, SKU file, and report folder. `SITE` selects which one runs.

| `SITE` | Store | URL | SKU file | Reports |
| --- | --- | --- | --- | --- |
| `wurthlac` | Würth LAC | https://wurthlac.com/ | `data/wurthlac.json` | `reports/wurthlac/` |
| `wurthbaer` | Würth Baer | https://wurthbaersupply.com/ | `data/wurthbaer.json` | `reports/wurthbaer/` |

`data/wurthlac.json` is the 100 LAC products (SKU, product id, and title). `data/wurthbaer.json` is 100 Baer catalog SKUs. Baer rows are SKU strings only. The test reads the product id from the live page and matches the visible `Item #`.

## What a run checks

1. Search each SKU, then record the URL, the visible product, and the search-box text.
2. Press Back and Forward after the 3rd SKU and again near the middle of the list. The product and the search box should match the URL.
3. Search a few SKUs again to see whether a failure comes back.
4. Refresh the last page once, then search again.
5. Record Zod console errors and failed search API responses.

A pass is a product page or a search-results page for the SKU just searched. A high failure is the previous SKU’s product still on screen. A medium failure is an empty or outdated search box, a page still navigating, or a failed search request.

## How Würth Baer runs

From `search-ui-automation`:

```bash
npm run test:sku-cache:baer
```

That sets `SITE=wurthbaer`, which does three things:

1. Opens https://wurthbaersupply.com/ in one Chrome window. The suite uses a normal Chrome user agent so the production checkpoint does not block the browser.
2. Reads `data/wurthbaer.json` from the top and searches those SKUs in that order. It does not use the LAC file.
3. Writes the CSV, JSON summary, and failure screenshots to `reports/wurthbaer/`.

Baer has no stored product ids, so a product page passes when its visible `Item #` matches the SKU that was just typed. A search-results page passes when the URL query is that SKU. The same back, forward, repeat, and refresh checks run as on LAC.

Build the PDF after the run:

```bash
npm run test:sku-cache:baer:pdf
```

The PDF is `reports/wurthbaer/lac-sku-cache-report.pdf`.

Limit the list while trying a shorter run:

```bash
SITE=wurthbaer SKU_LIMIT=10 npm run test:sku-cache:baer
```

## How Würth LAC runs

```bash
npm run test:sku-cache:lac
npm run test:sku-cache:lac:pdf
```

LAC uses `data/wurthlac.json` and writes to `reports/wurthlac/`. Each LAC row includes a product id, so a product URL is also compared with that id.

`npm run test:lac-sku-cache` is the same LAC command.

## Versions

`versions.json` is the record of module and dataset versions. Each dataset keeps every version and the date it was created. A run does not change those rows. When a run finishes, it appends itself under `runs` with its own created time and the dataset version it used.

Current datasets:

| Site | Version | Created |
| --- | --- | --- |
| Module | 1.0.0 | 2026-09-30 |
| `wurthlac` | 1.0.0 | 2026-09-30 |
| `wurthbaer` | 1.0.0 | 2026-10-28 |

When a SKU file changes, add a new object under that site’s `versions` array, set `latest` to the new version, and set `createdAt` to the day the file was created. Leave the older version in the list.

## Overrides

| Variable | Effect |
| --- | --- |
| `SITE` | `wurthlac` (default) or `wurthbaer` |
| `SKU_LIMIT` | Use only the first N SKUs from that site’s file |
| `SKU_DATASET` | Use a different JSON file for this run |
| `LAC_BASE_URL` | Use a different URL for the selected site |
| `LAC_REPORT_DIR` | Write reports somewhere else |

Run the commands from `search-ui-automation`. Chrome must be installed. The browser stays headless.
