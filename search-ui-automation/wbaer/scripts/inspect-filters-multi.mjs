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
  ? { 'x-vercel-protection-bypass': secret, 'x-vercel-set-bypass-cookie': 'samesitenone' }
  : {};
const withBypass = (url) => {
  if (!secret) return url;
  const u = new URL(url);
  u.searchParams.set('x-vercel-protection-bypass', secret);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
  return u.toString();
};

async function settle(page) {
  await page.waitForTimeout(2000);
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
}

const browser = await chromium.launch({ headless: true });
const out = {};

{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: headers })).newPage();
  await page.goto(withBypass(`${BASE}/search?q=hinges`), { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.getByTestId('trigger-Brand').click();
  await page.getByTestId('checkbox-Brand-Blum, Inc.').click();
  await settle(page);
  const afterOne = page.url();
  await page.getByTestId('checkbox-Brand-Salice America').click().catch(async () => {
    await page.getByText(/Salice America/i).first().click();
  });
  await settle(page);
  const afterTwo = page.url();
  await page.getByTestId('trigger-Category').click().catch(() => undefined);
  await settle(page);
  const catOption = page.locator('[data-testid^="checkbox-Category-"]').first();
  const catId = await catOption.getAttribute('data-testid').catch(() => null);
  if (await catOption.count()) {
    await catOption.click();
    await settle(page);
  }
  const afterCross = page.url();
  const clearAll = page.getByRole('button', { name: /^Clear all$/i }).first();
  await clearAll.click();
  await settle(page);
  out.desktopMulti = {
    afterOne,
    afterTwo,
    catId,
    afterCross,
    afterClear: page.url(),
    productsAfterClear: await page.locator('a.product-title').count(),
  };
  await page.close();
}

{
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: headers })).newPage();
  await page.goto(withBypass(`${BASE}/search?q=hinges`), { waitUntil: 'domcontentloaded' });
  await settle(page);
  await page.getByRole('button', { name: /Filters\s*&\s*sort/i }).click();
  await settle(page);
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  const mobileUi = await dialog.evaluate((root) => ({
    headings: [...root.querySelectorAll('h1,h2,h3,h4')].map((h) => (h.textContent || '').trim()).slice(0, 15),
    buttons: [...root.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 40),
    hasAccordion: !!root.querySelector('[data-testid="accordion-filter"]'),
    triggers: [...root.querySelectorAll('[data-testid^="trigger-"]')].map((el) => el.getAttribute('data-testid')),
  }));
  await dialog.getByTestId('trigger-Brand').click();
  await settle(page);
  await dialog.getByTestId('checkbox-Brand-Blum, Inc.').click();
  await settle(page);
  const afterSelectUrl = page.url();
  const footerButtons = await dialog.getByRole('button').allTextContents();
  // close drawer?
  const done = dialog.getByRole('button', { name: /done|apply|show|view|close/i });
  out.mobile = {
    mobileUi,
    afterSelectUrl,
    footerButtons: footerButtons.slice(0, 30),
    doneCount: await done.count(),
    dialogStillOpen: await dialog.isVisible().catch(() => false),
  };
  if ((await done.count()) > 0) {
    await done.first().click();
    await settle(page);
    out.mobile.afterDoneUrl = page.url();
  }
  await page.close();
}

fs.writeFileSync(path.join(root, 'reports', 'filters-facets-multi.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
