import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://qa-baersupply.vercel.app';
const out = {};
const save = () =>
  fs.writeFileSync('reports/on-enter-inspect.json', JSON.stringify(out, null, 2));

const input = (page) =>
  page.getByRole('textbox', { name: 'What are you looking for?' }).first();

async function home(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1800);
}

async function typeQuery(page, q) {
  await input(page).click();
  await input(page).fill('');
  if (q.length) {
    await page.keyboard.type(q, { delay: 25 });
  }
}

async function snapshotResults(page, label) {
  const data = await page.evaluate(() => {
    const vis = (el) =>
      !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')]
      .filter(vis)
      .map((h) => ({ level: h.tagName, text: (h.textContent || '').trim() }))
      .filter((h) => h.text)
      .slice(0, 20);
    return {
      url: location.href,
      pathname: location.pathname,
      search: location.search,
      q: new URL(location.href).searchParams.get('q'),
      route: new URL(location.href).searchParams.get('route'),
      headings,
      hasNoResults: [...document.querySelectorAll('h1,h2,h3')].some(
        (h) => vis(h) && /^No Results$/i.test((h.textContent || '').trim()),
      ),
      hasSearchResultsFor: [...document.querySelectorAll('h1,h2,h3')].some(
        (h) => vis(h) && /Search Results for/i.test(h.textContent || ''),
      ),
      hasProductsTab: [...document.querySelectorAll('[role="tab"],button')].some(
        (el) => vis(el) && /^Products$/i.test((el.textContent || '').trim()),
      ),
      pageOf: /page \d+ of \d+/i.test(document.body.innerText || ''),
      noResultsMessage: /couldn't find any results matching your search/i.test(
        document.body.innerText || '',
      ),
      suggestionsVisible: !!document.querySelector(
        '[data-search-column="suggestions"]',
      )?.getClientRects().length,
    };
  });
  const inputValue = await input(page).inputValue().catch(() => null);
  out[label] = { ...data, inputValue };
  save();
  return out[label];
}

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();

const navLog = [];
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) {
    navLog.push({ t: Date.now(), url: frame.url() });
  }
});
const reqLog = [];
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('/search') && !/\.(js|css|png|jpg|svg|woff)/i.test(u)) {
    reqLog.push({ method: req.method(), url: u.slice(0, 180) });
  }
});

try {
  // Valid Enter with dropdown likely open
  await home(page);
  await typeQuery(page, 'hinge');
  await page
    .locator('[data-search-column="suggestions"]')
    .locator('visible=true')
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => null);
  out.beforeEnterValid = {
    url: page.url(),
    suggestionsVisible: await page
      .locator('[data-search-column="suggestions"]')
      .locator('visible=true')
      .isVisible()
      .catch(() => false),
    input: await input(page).inputValue(),
  };
  save();
  await input(page).press('Enter');
  await page.waitForURL((url) => url.pathname === '/search', { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await snapshotResults(page, 'afterEnterValid');

  // Empty Enter
  await home(page);
  await input(page).click();
  await input(page).fill('');
  const urlBeforeEmpty = page.url();
  await input(page).press('Enter');
  await page.waitForTimeout(1500);
  out.afterEnterEmpty = {
    urlBefore: urlBeforeEmpty,
    urlAfter: page.url(),
    navigated: page.url() !== urlBeforeEmpty,
    input: await input(page).inputValue(),
  };
  save();

  // Whitespace Enter
  await home(page);
  await typeQuery(page, '   ');
  const urlBeforeWs = page.url();
  await input(page).press('Enter');
  await page.waitForTimeout(1500);
  out.afterEnterWhitespace = {
    urlBefore: urlBeforeWs,
    urlAfter: page.url(),
    navigated: page.url() !== urlBeforeWs,
    input: await input(page).inputValue(),
    q: (() => {
      try {
        return new URL(page.url()).searchParams.get('q');
      } catch {
        return null;
      }
    })(),
  };
  save();

  // No result
  await home(page);
  await typeQuery(page, 'zzzznonexistentproduct12345');
  await input(page).press('Enter');
  await page.waitForURL((url) => url.pathname === '/search', { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await snapshotResults(page, 'afterEnterNoResult');

  // Numeric / alpha / special / long
  for (const q of ['12345', 'BLU111C', 'hinge@#$', 'a'.repeat(80), 'screw']) {
    await home(page);
    await typeQuery(page, q);
    await input(page).press('Enter');
    await page
      .waitForURL((url) => url.pathname === '/search', { timeout: 20_000 })
      .catch(() => null);
    await page.waitForTimeout(1200);
    await snapshotResults(page, `enter_${q.slice(0, 20)}`);
  }

  // Replace query A -> B
  await home(page);
  await typeQuery(page, 'screw');
  await input(page).press('Enter');
  await page.waitForURL((url) => url.pathname === '/search', { timeout: 20_000 });
  await page.waitForTimeout(1000);
  const afterA = {
    url: page.url(),
    q: new URL(page.url()).searchParams.get('q'),
    input: await input(page).inputValue(),
  };
  await input(page).click();
  await input(page).fill('');
  await page.keyboard.type('blum', { delay: 25 });
  await input(page).press('Enter');
  await page.waitForURL(
    (url) =>
      url.pathname === '/search' &&
      (url.searchParams.get('q') || '').toLowerCase() === 'blum',
    { timeout: 20_000 },
  );
  await page.waitForTimeout(1000);
  out.replaceAB = {
    afterA,
    afterB: {
      url: page.url(),
      q: new URL(page.url()).searchParams.get('q'),
      input: await input(page).inputValue(),
    },
  };
  save();

  // Multiple Enter presses
  await home(page);
  navLog.length = 0;
  reqLog.length = 0;
  await typeQuery(page, 'hinge');
  await input(page).press('Enter');
  await input(page).press('Enter');
  await input(page).press('Enter');
  await page.waitForTimeout(2500);
  out.multiEnter = {
    navCount: navLog.filter((n) => n.url.includes('/search')).length,
    navUrls: navLog.map((n) => n.url).slice(0, 10),
    searchApiReqs: reqLog.slice(0, 15),
    finalUrl: page.url(),
    input: await input(page).inputValue(),
  };
  save();

  // Mobile
  await page.setViewportSize({ width: 375, height: 812 });
  await home(page);
  let usedToggle = false;
  if (!(await input(page).isVisible().catch(() => false))) {
    const btn = page.getByRole('button', { name: 'Search', exact: true }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      usedToggle = true;
    }
  }
  await typeQuery(page, 'hinge');
  await input(page).press('Enter');
  await page.waitForURL((url) => url.pathname === '/search', { timeout: 20_000 });
  await page.waitForTimeout(1200);
  out.mobileEnter = {
    usedToggle,
    ...(await snapshotResults(page, 'mobileEnterTemp')),
  };
  delete out.mobileEnterTemp;
  out.mobileEnter = {
    usedToggle,
    url: page.url(),
    q: new URL(page.url()).searchParams.get('q'),
    input: await input(page).inputValue(),
    hasSearchResultsFor: await page
      .getByRole('heading', { name: /Search Results for/i })
      .isVisible()
      .catch(() => false),
    hasNoResults: await page
      .getByRole('heading', { name: 'No Results', exact: true })
      .isVisible()
      .catch(() => false),
  };
  save();
} catch (error) {
  out.error = String(error);
  save();
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}

console.log(JSON.stringify(out, null, 2));
