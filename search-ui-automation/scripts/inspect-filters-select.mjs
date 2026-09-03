import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const BASE = (process.env.BASE_URL || 'https://qa-baersupply.vercel.app').replace(
  /\/$/,
  '',
);
const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const headers = secret
  ? {
      'x-vercel-protection-bypass': secret,
      'x-vercel-set-bypass-cookie': 'samesitenone',
    }
  : {};

function withBypass(url) {
  if (!secret) return url;
  const u = new URL(url);
  u.searchParams.set('x-vercel-protection-bypass', secret);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
  return u.toString();
}

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: headers,
  })
).newPage();

const reqs = [];
page.on('request', (r) => {
  const u = r.url();
  if (/search|facet|filter|plp|products/i.test(u) && !/\.(js|css|png|jpg|svg|woff)/i.test(u)) {
    reqs.push(u.slice(0, 200));
  }
});

await page.goto(withBypass(`${BASE}/search?q=hinges`), {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
await page.waitForTimeout(2500);

await page.getByTestId('trigger-Brand').click();
await page.waitForTimeout(500);

const content = page.getByTestId('content-Brand');
await content.waitFor({ state: 'visible' });

const optionInfo = await content.evaluate((root) => {
  const nodes = [...root.querySelectorAll('button, a, label, input, [role="checkbox"], li, div')];
  return nodes
    .filter((el) => /Blum/i.test(el.textContent || ''))
    .slice(0, 8)
    .map((el) => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      ariaChecked: el.getAttribute('aria-checked'),
      dataState: el.getAttribute('data-state'),
      testId: el.getAttribute('data-testid'),
      className: String(el.className || '').slice(0, 140),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
      outer: el.outerHTML.slice(0, 350),
    }));
});
console.log('optionInfo', JSON.stringify(optionInfo, null, 2));

const beforeProducts = await page.locator('a.product-title').count();
const beforeUrl = page.url();

// Prefer checkbox-like or button option
const blumOption = content.getByRole('checkbox', { name: /Blum/i }).or(
  content.getByRole('button', { name: /Blum/i }),
).or(content.locator('label', { hasText: /Blum/i })).first();

console.log('locator count attempts...');
await content.getByText(/Blum,\s*Inc/i).first().click();
await page.waitForTimeout(3500);

const after = {
  beforeUrl,
  afterUrl: page.url(),
  beforeProducts,
  afterProducts: await page.locator('a.product-title').count(),
  params: Object.fromEntries(new URL(page.url()).searchParams.entries()),
  reqs: [...new Set(reqs)].slice(-15),
  selectedInBrand: await content.evaluate((root) => {
    return [...root.querySelectorAll('[data-state], [aria-checked], input')]
      .map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        dataState: el.getAttribute('data-state'),
        ariaChecked: el.getAttribute('aria-checked'),
        checked: el instanceof HTMLInputElement ? el.checked : null,
        testId: el.getAttribute('data-testid'),
      }))
      .filter(
        (x) =>
          x.dataState === 'checked' ||
          x.dataState === 'on' ||
          x.ariaChecked === 'true' ||
          x.checked === true,
      );
  }),
  clearButtons: await page
    .locator('button')
    .evaluateAll((btns) =>
      btns
        .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((t) => /clear|reset|remove/i.test(t)),
    ),
  heading: await page
    .getByRole('heading', { name: /Search Results for/i })
    .first()
    .innerText()
    .catch(() => null),
};

fs.writeFileSync(
  path.join(root, 'reports', 'filters-facets-select.json'),
  JSON.stringify({ optionInfo, after }, null, 2),
);
console.log(JSON.stringify(after, null, 2));
await browser.close();
