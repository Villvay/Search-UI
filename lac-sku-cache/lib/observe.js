const { resolveSite, skusMatch } = require('./catalog');

const INPUT_NAME = /What are you looking for\?|Search products/i;

function productIdFromUrl(url) {
  try {
    const match = new URL(url).pathname.match(/\/product\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function queryFromUrl(url) {
  try {
    return new URL(url).searchParams.get('q');
  } catch {
    return null;
  }
}

function pathnameOf(url) {
  try {
    return new URL(url).pathname + new URL(url).search;
  } catch {
    return url;
  }
}

function titlesMatch(heading, title) {
  if (!heading || !title) return false;
  const normalize = (value) =>
    value
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const left = normalize(heading);
  const right = normalize(title);
  if (!left || !right) return false;
  return left === right || left.startsWith(right.slice(0, 48)) || right.startsWith(left.slice(0, 48));
}

function inputLocator(page) {
  return page.getByRole('textbox', { name: INPUT_NAME }).first();
}

async function openHome(page) {
  const site = resolveSite();
  const response = await page.goto(site.url, { waitUntil: 'domcontentloaded' });
  const title = await page.title();
  if (/security checkpoint|just a moment/i.test(title)) {
    throw new Error(`${site.label} is behind a browser checkpoint ("${title}")`);
  }
  await inputLocator(page).waitFor({ state: 'visible', timeout: 30_000 });
  return response ? response.status() : null;
}

async function readSnapshot(page) {
  return page.evaluate(() => {
    const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const main = document.querySelector('main') || document.body;
    const visibleText = clean(main.innerText || '');
    const itemMatch = visibleText.match(/Item\s*#\s*([A-Za-z0-9./_-]+)/i);
    const resultsMatch = visibleText.match(/Search Results for\s+"([^"]+)"/i);
    const headingNode = [...main.querySelectorAll('h1')].find((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 8;
    });
    const input = [...document.querySelectorAll('input')].find((element) => {
      const label = `${element.placeholder || ''} ${element.getAttribute('aria-label') || ''}`;
      const rect = element.getBoundingClientRect();
      return /looking for|search products/i.test(label) && rect.width > 40 && rect.height > 8;
    });
    const suggestionHeadings = [...document.querySelectorAll('h2, h3, h4')]
      .filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (rect.width < 8 || rect.height < 8) return false;
        return /Categories for|Products for|Recent search/i.test(node.textContent || '');
      })
      .map((node) => clean(node.textContent))
      .slice(0, 4);

    return {
      visibleItem: itemMatch ? itemMatch[1] : null,
      heading: headingNode ? clean(headingNode.innerText) : '',
      resultsFor: resultsMatch ? resultsMatch[1] : null,
      noResults: /No Results/i.test(visibleText),
      inputValue: input ? input.value : null,
      suggestionHeadings,
    };
  });
}

/**
 * After Enter, wait until the URL settles on the expected product, a search
 * results URL, or a stable wrong page. Do not wait until the displayed SKU
 * matches — that wait would hide a stale product page.
 */
async function waitForLanding(page, { sku, expectedProductId, previousProductId, urlBefore }) {
  const started = Date.now();
  const maxMs = 12_000;
  let lastUrl = page.url();
  let lastChange = started;

  while (Date.now() - started < maxMs) {
    const url = page.url();
    if (url !== lastUrl) {
      lastUrl = url;
      lastChange = Date.now();
    }
    const stableFor = Date.now() - lastChange;
    const elapsed = Date.now() - started;
    const productId = productIdFromUrl(url);
    const query = queryFromUrl(url);

    if (expectedProductId && productId === String(expectedProductId) && stableFor >= 400) {
      return 'current-product';
    }
    if (
      previousProductId &&
      productId === String(previousProductId) &&
      url === urlBefore &&
      elapsed >= 2800 &&
      stableFor >= 700
    ) {
      return 'stale-previous';
    }
    if (
      expectedProductId &&
      productId &&
      productId !== String(expectedProductId) &&
      url !== urlBefore &&
      stableFor >= 700 &&
      elapsed >= 1200
    ) {
      return 'other-product';
    }
    if (!expectedProductId && productId && url !== urlBefore && stableFor >= 1200 && elapsed >= 1500) {
      return 'product';
    }
    if (query && skusMatch(query, sku) && stableFor >= 3500 && elapsed >= 8000) {
      return 'search';
    }
    await page.waitForTimeout(120);
  }
  return 'timeout';
}

async function searchSku(page, sku) {
  const input = inputLocator(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await input.waitFor({ state: 'visible', timeout: 15_000 });
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active && typeof active.blur === 'function') active.blur();
  });
  await input.click();
  await input.press('ControlOrMeta+a');
  await input.press('Backspace');
  await input.pressSequentially(sku, { delay: 12 });
  const typed = await input.inputValue();
  const urlBefore = page.url();
  await input.press('Enter');
  return { typed, urlBefore };
}

function describePage(url, snap) {
  const productId = productIdFromUrl(url);
  const query = queryFromUrl(url);
  let label;
  if (productId) label = `PLP /product/${productId}`;
  else if (query) label = `SRP q=${query}`;
  else label = `Other ${pathnameOf(url)}`;
  if (snap.visibleItem) label += ` | Item # ${snap.visibleItem}`;
  else if (snap.heading) label += ` | ${snap.heading.slice(0, 80)}`;
  return label;
}

function showsRecord(url, snap, record) {
  if (!record) return false;
  const productId = productIdFromUrl(url);
  if (record.productId && productId === String(record.productId)) return true;
  if (skusMatch(snap.visibleItem, record.sku)) return true;
  if (titlesMatch(snap.heading, record.title)) return true;
  return false;
}

function suggestionQuery(heading) {
  const match = heading.match(/(?:for|search)\s+"([^"]+)"/i);
  return match ? match[1] : null;
}

function isNoise(message) {
  return /favicon|googletagmanager|google-analytics|doubleclick|facebook|hotjar|accessibe|acsbapp|fonts\.g|fontawesome|\.woff|pixel|bat\.bing|search-villvay\.workers\.dev|hsforms\.net|hubspot|\/rest\/auth\/login-check|Failed to load resource: the server responded with a status of 40[14] \([^)]*\)/i.test(
    message,
  );
}

function classifySearch({ sku, record, previous, url, snap, landing, consoleErrors, networkErrors }) {
  const expectedPage = record.productId
    ? `PLP /product/${record.productId}`
    : 'PLP or SRP';
  const actualPage = describePage(url, snap);
  const currentShown = showsRecord(url, snap, record);
  const previousShown = showsRecord(url, snap, previous);
  const urlIsCurrent = productIdFromUrl(url) === String(record.productId);
  const queryIsCurrent = skusMatch(queryFromUrl(url), sku);
  const inputStale = snap.inputValue != null && !skusMatch(snap.inputValue, sku);
  const staleSuggestion = (snap.suggestionHeadings || []).find((heading) => {
    const query = suggestionQuery(heading);
    return query && !skusMatch(query, sku);
  });
  const relevantConsole = (consoleErrors || []).filter((message) => !isNoise(message));
  const relevantNetwork = (networkErrors || []).filter((message) => !isNoise(message));
  const zod = relevantConsole.find((message) => /zod/i.test(message));

  const issues = [];
  let severity = '';
  let signature = 'ok';

  const urlChangedContentStale =
    Boolean(previous) &&
    !skusMatch(previous.sku, sku) &&
    urlIsCurrent &&
    (skusMatch(snap.visibleItem, previous.sku) || titlesMatch(snap.heading, previous.title));

  if (previous && previousShown && !currentShown) {
    severity = 'High';
    signature = 'previous-product';
    issues.push(
      `High: previous SKU ${previous.sku} is displayed after searching ${sku}`,
    );
  } else if (urlChangedContentStale) {
    severity = 'High';
    signature = 'url-content-mismatch';
    issues.push(
      `High: URL changed to the current product but the displayed content is still ${previous ? previous.sku : 'a previous search'}`,
    );
  } else if (!currentShown && !snap.noResults && landing === 'timeout') {
    severity = 'Medium';
    signature = 'navigation-timeout';
    issues.push(`Medium: navigation did not settle on ${sku}`);
  } else if (!currentShown && snap.noResults) {
    signature = 'no-results';
    issues.push(`No results displayed for ${sku}`);
  } else if (!currentShown) {
    severity = 'High';
    signature = 'unexpected-page';
    issues.push(`High: displayed page is not ${sku}`);
  }

  if (currentShown && inputStale) {
    if (!severity) severity = 'Medium';
    if (signature === 'ok') signature = 'stale-input';
    issues.push(`Medium: search input still shows "${snap.inputValue}" after searching ${sku}`);
  }
  if (staleSuggestion) {
    if (!severity || severity === 'Low') severity = 'Medium';
    if (signature === 'ok') signature = 'stale-suggestions';
    issues.push(`Medium: suggestion panel still shows "${staleSuggestion}"`);
  }
  if (zod) {
    if (!severity) severity = 'Medium';
    issues.push(`Medium: Zod validation error: ${zod.slice(0, 180)}`);
  }
  if (relevantNetwork.length) {
    if (!severity) severity = 'Medium';
    issues.push(
      `Medium: failed request ${relevantNetwork.slice(0, 2).join(' | ').slice(0, 220)}`,
    );
  }

  const failed = issues.length > 0 && (severity === 'High' || severity === 'Medium' || severity === 'Low' || !currentShown);
  const status = failed ? 'Fail' : 'Pass';
  const details = [];
  if (status === 'Fail') {
    details.push(
      `Previous SKU: ${previous ? `${previous.sku} (product ${previous.productId || 'n/a'})` : 'none'}. Current SKU: ${sku} (product ${record.productId || 'n/a'}).`,
    );
    details.push(`Landing signal: ${landing}. URL: ${url}`);
    if (snap.inputValue != null) details.push(`Input: "${snap.inputValue}".`);
    if (snap.heading) details.push(`Heading: ${snap.heading.slice(0, 140)}.`);
    if (!queryIsCurrent && queryFromUrl(url)) details.push(`URL query: ${queryFromUrl(url)}.`);
  }
  if (relevantConsole.length) details.push(`Console: ${relevantConsole.slice(0, 2).join(' || ').slice(0, 300)}`);
  if (relevantNetwork.length) details.push(`HTTP: ${relevantNetwork.slice(0, 2).join(' || ').slice(0, 300)}`);

  return {
    SKU: sku,
    'Search query': sku,
    'Expected page': expectedPage,
    'Actual page': actualPage,
    'Cache issue': issues.filter((issue) => /^(High|Medium|Low):/.test(issue)).join(' '),
    'Error details': details.join(' '),
    Status: status,
    severity,
    signature,
    kind: 'search',
    url,
    consoleErrors: relevantConsole,
    networkErrors: relevantNetwork,
  };
}

function classifyHistory({ action, previous, current, before, after, consoleErrors }) {
  const urlChanged = before.url !== after.url;
  const contentSame =
    before.snap.visibleItem &&
    after.snap.visibleItem &&
    skusMatch(before.snap.visibleItem, after.snap.visibleItem) &&
    before.snap.heading === after.snap.heading;
  const inputSame =
    before.snap.inputValue != null &&
    after.snap.inputValue != null &&
    skusMatch(before.snap.inputValue, after.snap.inputValue);

  let severity = '';
  let cacheIssue = '';
  const details = [
    `Previous SKU: ${previous ? previous.sku : 'none'}. Current SKU: ${current ? current.sku : 'none'}.`,
    `Action: ${action}. URL before: ${before.url}. URL after: ${after.url}.`,
  ];

  if (!urlChanged) {
    severity = 'Medium';
    cacheIssue = `Medium: browser ${action} did not change the page`;
  } else if (contentSame && before.snap.heading) {
    severity = 'High';
    cacheIssue = `High: browser ${action} changed the URL but the displayed product stayed ${before.snap.visibleItem || before.snap.heading}`;
  } else if (inputSame && before.snap.inputValue && !skusMatch(before.snap.inputValue, after.snap.visibleItem || '')) {
    severity = 'Medium';
    cacheIssue = `Medium: browser ${action} left the search input on "${after.snap.inputValue}"`;
    details.push(`Displayed Item #: ${after.snap.visibleItem || 'none'}. Heading: ${(after.snap.heading || '').slice(0, 120)}.`);
  }

  const relevantConsole = (consoleErrors || []).filter((message) => !isNoise(message) && /zod/i.test(message));
  if (relevantConsole.length && !severity) {
    severity = 'Low';
    cacheIssue = `Low: console error during ${action}`;
    details.push(`Console: ${relevantConsole[0].slice(0, 180)}`);
  }

  return {
    SKU: current ? current.sku : '',
    'Search query': action,
    'Expected page': `History ${action} updates the displayed page with the URL`,
    'Actual page': describePage(after.url, after.snap),
    'Cache issue': cacheIssue,
    'Error details': severity ? details.join(' ') : '',
    Status: severity ? 'Fail' : 'Pass',
    severity,
    signature: severity ? `history-${action}` : 'ok',
    kind: action,
    url: after.url,
    consoleErrors: relevantConsole,
    networkErrors: [],
  };
}

module.exports = {
  productIdFromUrl,
  queryFromUrl,
  openHome,
  readSnapshot,
  waitForLanding,
  searchSku,
  describePage,
  showsRecord,
  classifySearch,
  classifyHistory,
  isNoise,
  titlesMatch,
};
