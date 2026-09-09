/**
 * Inspect Filters & Facets on QA SERP (desktop + mobile).
 * Writes reports/filters-facets-inspect.json
 */
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

const outPath = path.join(root, 'reports', 'filters-facets-inspect.json');
const out = { base: BASE, capturedAt: new Date().toISOString(), runs: {} };
const save = () => fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

function withBypass(url) {
  if (!secret) return url;
  const u = new URL(url);
  u.searchParams.set('x-vercel-protection-bypass', secret);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
  return u.toString();
}

async function inspectDom(page) {
  return page.evaluate(() => {
    const vis = (el) =>
      !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

    const candidates = [
      ...document.querySelectorAll(
        [
          '[data-testid*="filter" i]',
          '[data-testid*="facet" i]',
          '[class*="filter" i]',
          '[class*="facet" i]',
          '[id*="filter" i]',
          '[id*="facet" i]',
          'aside',
          '[role="complementary"]',
          'form',
        ].join(','),
      ),
    ]
      .filter(vis)
      .slice(0, 40)
      .map((el) => ({
        tag: el.tagName,
        id: el.id || null,
        role: el.getAttribute('role'),
        className: String(el.className || '').slice(0, 120),
        testId: el.getAttribute('data-testid'),
        ariaLabel: el.getAttribute('aria-label'),
        text: text(el).slice(0, 160),
      }));

    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5')]
      .filter(vis)
      .map((h) => ({ tag: h.tagName, text: text(h) }))
      .filter((h) => /filter|facet|refine|brand|category|finish|color|size/i.test(h.text))
      .slice(0, 30);

    const allHeadings = [...document.querySelectorAll('h1,h2,h3,h4')]
      .filter(vis)
      .map((h) => text(h))
      .filter(Boolean)
      .slice(0, 25);

    const buttons = [...document.querySelectorAll('button,[role="button"]')]
      .filter(vis)
      .map((b) => text(b))
      .filter((t) =>
        /filter|facet|refine|clear|reset|apply|done|show|hide/i.test(t),
      )
      .slice(0, 40);

    const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')]
      .filter(vis)
      .slice(0, 40)
      .map((c) => {
        const label =
          (c.id && document.querySelector(`label[for="${c.id}"]`)) ||
          c.closest('label');
        return {
          name: c.getAttribute('name'),
          value: c.value,
          checked: c.checked,
          id: c.id || null,
          label: text(label).slice(0, 80),
          ariaLabel: c.getAttribute('aria-label'),
        };
      });

    const radios = [...document.querySelectorAll('input[type="radio"]')]
      .filter(vis)
      .slice(0, 20)
      .map((c) => ({
        name: c.getAttribute('name'),
        value: c.value,
        checked: c.checked,
        label: text(
          (c.id && document.querySelector(`label[for="${c.id}"]`)) ||
            c.closest('label'),
        ).slice(0, 80),
      }));

    const links = [...document.querySelectorAll('a')]
      .filter(vis)
      .map((a) => ({
        text: text(a).slice(0, 80),
        href: (a.getAttribute('href') || '').slice(0, 120),
      }))
      .filter((a) => /filter|facet|clear|brand=|category=/i.test(`${a.text} ${a.href}`))
      .slice(0, 30);

    const productCount = document.querySelectorAll('a.product-title').length;
    const url = location.href;
    const params = Object.fromEntries(new URL(url).searchParams.entries());

    return {
      url,
      params,
      productCount,
      allHeadings,
      filterishHeadings: headings,
      filterishButtons: buttons,
      checkboxes,
      radios,
      links,
      candidates,
      bodySnippet: (document.body?.innerText || '')
        .replace(/\s+/g, ' ')
        .slice(0, 500),
    };
  });
}

async function openSerp(page, query) {
  const url = withBypass(`${BASE}/search?q=${encodeURIComponent(query)}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page
    .getByRole('textbox', { name: 'What are you looking for?' })
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(2500);
}

async function runViewport(name, viewport, query) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    extraHTTPHeaders: headers,
  });
  const page = await context.newPage();

  try {
    await openSerp(page, query);
    const before = await inspectDom(page);

    // Try common mobile filter triggers
    const triggerNames = [
      'Filters',
      'Filter',
      'Refine',
      'Show filters',
      'Filter products',
    ];
    let opened = null;
    for (const nameBtn of triggerNames) {
      const btn = page.getByRole('button', { name: new RegExp(`^${nameBtn}$`, 'i') });
      if ((await btn.count()) > 0 && (await btn.first().isVisible().catch(() => false))) {
        await btn.first().click().catch(() => undefined);
        await page.waitForTimeout(1200);
        opened = nameBtn;
        break;
      }
    }

    const afterOpen = opened ? await inspectDom(page) : null;

    // If checkboxes exist, click first unchecked and re-inspect
    let afterSelect = null;
    const boxes = page.locator('input[type="checkbox"]');
    const boxCount = await boxes.count();
    if (boxCount > 0) {
      for (let i = 0; i < Math.min(boxCount, 8); i += 1) {
        const box = boxes.nth(i);
        if (!(await box.isVisible().catch(() => false))) continue;
        if (await box.isChecked().catch(() => false)) continue;
        await box.check({ force: true }).catch(async () => {
          await box.click({ force: true });
        });
        await page.waitForTimeout(2000);
        afterSelect = await inspectDom(page);
        break;
      }
    }

    out.runs[name] = {
      viewport,
      query,
      before,
      filterTriggerClicked: opened,
      afterOpen,
      afterSelect,
    };
    save();
  } finally {
    await browser.close();
  }
}

fs.mkdirSync(path.join(root, 'reports'), { recursive: true });

const query = process.env.FILTER_INSPECT_QUERY || 'hinges';
await runViewport('desktop-1440', { width: 1440, height: 900 }, query);
await runViewport('tablet-768', { width: 768, height: 1024 }, query);
await runViewport('mobile-390', { width: 390, height: 844 }, query);

console.log(`Wrote ${outPath}`);
