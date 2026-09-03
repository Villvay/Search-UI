/**
 * Deep Sorting probe — dump SERP chrome near products for any order/sort UI.
 */
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const BASE = (process.env.BASE_URL || 'https://qa-baersupply.vercel.app').replace(/\/$/, '');
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

await page.goto(withBypass(`${BASE}/search?q=hinges`), {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
await page.waitForTimeout(3000);

const dump = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const vis = (el) =>
    !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  const main = document.querySelector('main') || document.body;
  const allButtons = [...main.querySelectorAll('button, a, [role="button"], select, [role="combobox"], [role="listbox"]')]
    .filter(vis)
    .map((el) => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      testId: el.getAttribute('data-testid'),
      ariaLabel: el.getAttribute('aria-label'),
      name: el.getAttribute('name'),
      text: text(el).slice(0, 100),
    }))
    .filter((x) => x.text || x.ariaLabel || x.testId)
    .slice(0, 120);

  const allTestIds = [...document.querySelectorAll('[data-testid]')]
    .map((el) => el.getAttribute('data-testid'))
    .filter(Boolean);
  const uniqueTestIds = [...new Set(allTestIds)].filter((id) =>
    /sort|order|relev|rank|arrang|filter|product|grid|toolbar|select|dropdown|menu/i.test(id),
  );

  const nearProducts = (() => {
    const grid = document.querySelector('[data-testid="container-productGrid"]') ||
      document.querySelector('[class*="product"]');
    if (!grid) return null;
    const parent = grid.parentElement;
    return {
      gridTestId: grid.getAttribute('data-testid'),
      parentHtml: parent?.innerHTML?.slice(0, 2500) || null,
      prevSibling: parent?.previousElementSibling
        ? {
            tag: parent.previousElementSibling.tagName,
            testId: parent.previousElementSibling.getAttribute('data-testid'),
            text: text(parent.previousElementSibling).slice(0, 300),
          }
        : null,
      toolbarCandidates: [...(parent?.querySelectorAll('button, select, [role="combobox"]') || [])]
        .filter(vis)
        .map((el) => ({
          tag: el.tagName,
          testId: el.getAttribute('data-testid'),
          text: text(el).slice(0, 120),
          ariaLabel: el.getAttribute('aria-label'),
        }))
        .slice(0, 40),
    };
  })();

  // Look for any text containing Sort / Order / Relevance anywhere visible
  const textHits = [...document.querySelectorAll('body *')]
    .filter(vis)
    .filter((el) => {
      const t = text(el);
      return (
        el.children.length === 0 &&
        /^(sort|order by|relevance|best match|featured|popular|price|newest|oldest)/i.test(t)
      );
    })
    .map((el) => ({
      tag: el.tagName,
      text: text(el),
      parentTestId: el.closest('[data-testid]')?.getAttribute('data-testid') || null,
    }))
    .slice(0, 40);

  // Check URL param names known for sort on similar sites
  const params = Object.fromEntries(new URL(location.href).searchParams.entries());

  // Scan network-ish: any select with options
  const allSelects = [...document.querySelectorAll('select')].map((sel) => ({
    visible: vis(sel),
    testId: sel.getAttribute('data-testid'),
    options: [...sel.options].map((o) => text(o)),
  }));

  return {
    params,
    uniqueTestIds,
    allButtons,
    nearProducts,
    textHits,
    allSelects,
    bodySnippet: text(document.body).slice(0, 1500),
  };
});

// Also try drawer-slides query and check if sort appears with filters active
await page.goto(
  withBypass(
    `${BASE}/search?q=hinges&filters=${encodeURIComponent(JSON.stringify({ Brand: 'Blum, Inc.' }))}`,
  ),
  { waitUntil: 'domcontentloaded', timeout: 60_000 },
);
await page.waitForTimeout(3000);
const withFilter = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const vis = (el) =>
    !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  return {
    url: location.href,
    params: Object.fromEntries(new URL(location.href).searchParams.entries()),
    buttons: [...document.querySelectorAll('button')]
      .filter(vis)
      .map((b) => text(b))
      .filter((t) => /sort|order|relev|price|best|featured/i.test(t))
      .slice(0, 30),
    textHits: [...document.querySelectorAll('body *')]
      .filter(vis)
      .filter((el) => el.children.length === 0 && /sort|order by|relevance/i.test(text(el)))
      .map((el) => text(el))
      .slice(0, 20),
  };
});

// Accessibility snapshot of toolbar area
const a11y = await page
  .getByRole('main')
  .ariaSnapshot({ timeout: 10_000 })
  .catch((e) => String(e));

const out = { dump, withFilter, a11ySnippet: String(a11y).slice(0, 8000) };
fs.writeFileSync(
  path.join(root, 'reports', 'sorting-inspect-deep.json'),
  JSON.stringify(out, null, 2),
);
console.log(JSON.stringify({
  uniqueTestIds: dump.uniqueTestIds,
  textHits: dump.textHits,
  toolbar: dump.nearProducts?.toolbarCandidates,
  buttonsSample: dump.allButtons.filter((b) =>
    /sort|order|relev|price|view|grid|list|page|filter/i.test(
      `${b.text} ${b.ariaLabel || ''} ${b.testId || ''}`,
    ),
  ),
  withFilter,
  a11yHead: String(a11y).slice(0, 2500),
}, null, 2));

await browser.close();
