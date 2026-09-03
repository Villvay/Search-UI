/**
 * Inspect Sorting controls on QA SERP (desktop + tablet + mobile).
 * Writes reports/sorting-inspect.json
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
const outPath = path.join(root, 'reports', 'sorting-inspect.json');
const out = { base: BASE, capturedAt: new Date().toISOString(), runs: {} };

function withBypass(url) {
  if (!secret) return url;
  const u = new URL(url);
  u.searchParams.set('x-vercel-protection-bypass', secret);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
  return u.toString();
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForTimeout(2000);
}

async function captureSortSurface(page) {
  return page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    const vis = (el) =>
      !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

    const sortish = [
      ...document.querySelectorAll(
        [
          '[data-testid*="sort" i]',
          '[id*="sort" i]',
          '[class*="sort" i]',
          '[aria-label*="sort" i]',
          'select',
          '[role="listbox"]',
          '[role="combobox"]',
          'button',
          'label',
        ].join(','),
      ),
    ]
      .filter(vis)
      .filter((el) => /sort/i.test(text(el) + (el.getAttribute('aria-label') || '') + (el.getAttribute('data-testid') || '') + (el.id || '') + String(el.className || '')))
      .slice(0, 40)
      .map((el) => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        type: el.getAttribute('type'),
        testId: el.getAttribute('data-testid'),
        id: el.id || null,
        name: el.getAttribute('name'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaExpanded: el.getAttribute('aria-expanded'),
        className: String(el.className || '').slice(0, 140),
        text: text(el).slice(0, 120),
      }));

    const selects = [...document.querySelectorAll('select')]
      .filter(vis)
      .map((sel) => ({
        id: sel.id || null,
        name: sel.getAttribute('name'),
        testId: sel.getAttribute('data-testid'),
        ariaLabel: sel.getAttribute('aria-label'),
        value: sel.value,
        options: [...sel.options].map((o) => ({
          value: o.value,
          text: text(o),
          selected: o.selected,
        })),
      }));

    const buttons = [...document.querySelectorAll('button')]
      .filter(vis)
      .map((b) => text(b))
      .filter((t) => /sort|relevance|price|newest|popular|best/i.test(t))
      .slice(0, 30);

    const url = location.href;
    const params = Object.fromEntries(new URL(url).searchParams.entries());

    return {
      url,
      params,
      sortish,
      selects,
      buttons,
      productTitles: [...document.querySelectorAll('a.product-title')]
        .slice(0, 8)
        .map((a) => text(a)),
      productCount: document.querySelectorAll('a.product-title').length,
    };
  });
}

async function probeDesktop(page) {
  await page.goto(withBypass(`${BASE}/search?q=hinges`), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await settle(page);
  const before = await captureSortSurface(page);

  // Try common open patterns
  const interactions = [];
  const sortButton = page.getByRole('button', { name: /sort/i }).first();
  const sortCombobox = page.getByRole('combobox', { name: /sort/i }).first();
  const sortSelect = page.locator('select').filter({ hasText: /sort|relevance|price/i }).first();
  const sortByLabel = page.getByLabel(/sort/i).first();
  const sortTestId = page.locator('[data-testid*="sort" i]').first();

  const tryClick = async (label, locator) => {
    const count = await locator.count().catch(() => 0);
    if (!count) {
      interactions.push({ label, found: false });
      return false;
    }
    const visible = await locator.isVisible().catch(() => false);
    interactions.push({
      label,
      found: true,
      visible,
      text: visible ? await locator.innerText().catch(() => '') : null,
      testId: visible
        ? await locator.getAttribute('data-testid').catch(() => null)
        : null,
    });
    if (!visible) return false;
    await locator.click().catch(() => undefined);
    await settle(page);
    return true;
  };

  await tryClick('button[name=/sort/i]', sortButton);
  await tryClick('combobox[name=/sort/i]', sortCombobox);
  await tryClick('getByLabel(/sort/i)', sortByLabel);
  await tryClick('[data-testid*=sort]', sortTestId);

  const afterOpen = await captureSortSurface(page);

  // Collect listbox / menu options if any
  const menuOptions = await page
    .locator('[role="option"], [role="menuitem"], [role="menuitemradio"]')
    .evaluateAll((els) =>
      els.map((el) => ({
        role: el.getAttribute('role'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        ariaSelected: el.getAttribute('aria-selected'),
        dataState: el.getAttribute('data-state'),
        testId: el.getAttribute('data-testid'),
      })),
    )
    .catch(() => []);

  // If native select exists, capture and change
  let selectProbe = null;
  if (before.selects.length) {
    const sel = page.locator('select').first();
    const options = before.selects[0].options;
    const nonDefault = options.find((o) => !o.selected) || options[1];
    if (nonDefault) {
      const histBefore = await page.evaluate(() => history.length);
      await sel.selectOption({ label: nonDefault.text }).catch(async () => {
        await sel.selectOption(nonDefault.value);
      });
      await settle(page);
      selectProbe = {
        chose: nonDefault,
        url: page.url(),
        params: Object.fromEntries(new URL(page.url()).searchParams.entries()),
        histDelta: (await page.evaluate(() => history.length)) - histBefore,
        titles: await page.locator('a.product-title').allInnerTexts().then((t) =>
          t.slice(0, 6).map((x) => x.replace(/\s+/g, ' ').trim()),
        ),
      };
    }
  }

  // If menu options exist, pick a non-selected one
  let menuProbe = null;
  if (menuOptions.length) {
    const target =
      menuOptions.find((o) => o.ariaSelected !== 'true' && o.dataState !== 'checked') ||
      menuOptions[1] ||
      menuOptions[0];
    if (target?.text) {
      const histBefore = await page.evaluate(() => history.length);
      await page.getByRole(target.role || 'option', { name: target.text }).first().click();
      await settle(page);
      menuProbe = {
        chose: target,
        url: page.url(),
        params: Object.fromEntries(new URL(page.url()).searchParams.entries()),
        histDelta: (await page.evaluate(() => history.length)) - histBefore,
        titles: await page.locator('a.product-title').allInnerTexts().then((t) =>
          t.slice(0, 6).map((x) => x.replace(/\s+/g, ' ').trim()),
        ),
        selectedAfter: await captureSortSurface(page),
      };
    }
  }

  // Refresh persistence
  let refreshProbe = null;
  if (page.url().includes('sort') || Object.keys(Object.fromEntries(new URL(page.url()).searchParams)).some((k) => /sort/i.test(k))) {
    const urlBefore = page.url();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    refreshProbe = {
      urlBefore,
      urlAfter: page.url(),
      surface: await captureSortSurface(page),
    };
  }

  return { before, interactions, afterOpen, menuOptions, selectProbe, menuProbe, refreshProbe };
}

async function probeMobile(page) {
  await page.goto(withBypass(`${BASE}/search?q=hinges`), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await settle(page);
  const before = await captureSortSurface(page);

  const trigger = page.getByRole('button', { name: /Filters\s*&\s*sort/i });
  const opened = await trigger.isVisible().catch(() => false);
  if (opened) {
    await trigger.click();
    await settle(page);
  }

  const dialog = page.getByRole('dialog');
  const dialogVisible = await dialog.isVisible().catch(() => false);
  let dialogSort = null;
  if (dialogVisible) {
    dialogSort = await dialog.evaluate((root) => {
      const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        headings: [...root.querySelectorAll('h1,h2,h3,h4')]
          .map((h) => text(h))
          .slice(0, 20),
        buttons: [...root.querySelectorAll('button')]
          .map((b) => text(b))
          .filter(Boolean)
          .slice(0, 60),
        selects: [...root.querySelectorAll('select')].map((sel) => ({
          testId: sel.getAttribute('data-testid'),
          value: sel.value,
          options: [...sel.options].map((o) => ({
            value: o.value,
            text: text(o),
            selected: o.selected,
          })),
        })),
        sortTestIds: [...root.querySelectorAll('[data-testid*="sort" i]')].map(
          (el) => el.getAttribute('data-testid'),
        ),
        radios: [...root.querySelectorAll('[role="radio"], input[type="radio"]')]
          .map((el) => ({
            role: el.getAttribute('role'),
            testId: el.getAttribute('data-testid'),
            text: text(el.closest('label') || el),
            checked:
              el.getAttribute('aria-checked') === 'true' ||
              (el instanceof HTMLInputElement && el.checked),
          }))
          .slice(0, 20),
        textSnippet: text(root).slice(0, 500),
      };
    });

    // Try clicking a Sort section if present
    const sortSection = dialog.getByRole('button', { name: /^Sort/i }).or(
      dialog.getByText(/^Sort by/i),
    );
    if (await sortSection.first().isVisible().catch(() => false)) {
      await sortSection.first().click().catch(() => undefined);
      await settle(page);
    }
  }

  const afterOpen = await captureSortSurface(page);
  const menuOptions = await page
    .locator('[role="option"], [role="menuitem"], [role="menuitemradio"], [role="radio"]')
    .evaluateAll((els) =>
      els.map((el) => ({
        role: el.getAttribute('role'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        ariaChecked: el.getAttribute('aria-checked'),
        ariaSelected: el.getAttribute('aria-selected'),
        testId: el.getAttribute('data-testid'),
      })),
    )
    .catch(() => []);

  return { before, opened, dialogVisible, dialogSort, afterOpen, menuOptions, url: page.url() };
}

const browser = await chromium.launch({ headless: true });

{
  const page = await (
    await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: headers,
    })
  ).newPage();
  out.runs.desktop1440 = await probeDesktop(page);
  await page.close();
}

{
  const page = await (
    await browser.newContext({
      viewport: { width: 768, height: 1024 },
      extraHTTPHeaders: headers,
    })
  ).newPage();
  out.runs.tablet768 = await probeDesktop(page);
  await page.close();
}

{
  const page = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      extraHTTPHeaders: headers,
    })
  ).newPage();
  out.runs.mobile390 = await probeMobile(page);
  await page.close();
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote', outPath);
await browser.close();
