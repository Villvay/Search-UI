# Search UI Automation

Parent folder for the two independent Playwright Search UI suites:

| Site | Folder | Default host |
|---|---|---|
| Würth Baer Supply | [`wbaer/`](./wbaer/) | See that folder’s README |
| Würth LAC / Louis & Company | [`wlac/`](./wlac/) | `https://wurthlac.com` |

Each suite has its own config, selectors, test data, reports, and npm scripts. Do not run one suite against the other site.

From the repository root:

```bash
npm run baer:smoke
npm run baer:regression

npm run wlac:smoke
npm run wlac:regression
```

Or from this folder:

```bash
npm run test:smoke --prefix wbaer
npm run test:regression --prefix wbaer

npm run test:smoke --prefix wlac
npm run test:regression --prefix wlac
```
