/**
 * Deep Filters/Facets probe: expand Brand, select value, capture URL/results.
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

function withBypass(url) {
  if (!secret) return url;
  const u = new URL(url);
  u.searchParams.set('x-vercel-protection-bypass', secret);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
  return u.toString();
}

const out = { steps: [] };
const log = (label, data) => {
  out.steps.push({ label, ...data, at: Date.now() });
  fs.writeFileSync(
    path.join(root, 'reports', 'filters-facets-deep.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(label, JSON.stringify(data).slice(0, 300));
};

const browser = await chromium.launch({ headless: true });

async function desktopFlow() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: headers,
  });
  const page = await context.newPage();
  const query = 'hinges';
  await page.goto(withBypass(`${BASE}/search?q=${encodeURIComponent(query)}`), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page
    .getByRole('textbox', { name: 'What are you looking for?' })
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(2000);

  const panel = page.getByTestId('accordion-filter');
  await panel.waitFor({ state: 'visible', timeout: 15_000 });

  const facetButtons = panel.locator('button, [role="button"], h3');
  const facetNames = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="accordion-filter"]');
    if (!root) return [];
    return [...root.querySelectorAll('h3')]
      .map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  });
  log('desktop.facetNames', { facetNames: facetNames.slice(0, 40), count: facetNames.length });

  // Expand Brand
  const brandHeader = panel.getByRole('button', { name: /^Brand$/i }).or(
    panel.getByRole('heading', { name: /^Brand$/i }),
  );
  const brandBtnCount = await panel.locator('button').filter({ hasText: /^Brand$/i }).count();
  log('desktop.brandControls', {
    brandBtnCount,
    headingVisible: await panel.getByRole('heading', { name: /^Brand$/i }).first().isVisible().catch(() => false),
  });

  // Click first accordion trigger that contains Brand
  const brandTrigger = panel.locator('[data-testid="accordion-filter"] >> ..').locator('xpath=.//*[self::button or @role="button"][contains(., "Brand")]').first();
  // Simpler: click h3 Brand's clickable parent
  await page.evaluate(() => {
    const root = document.querySelector('[data-testid="accordion-filter"]');
    const h = [...(root?.querySelectorAll('h3') || [])].find(
      (el) => (el.textContent || '').trim() === 'Brand',
    );
    const clickable =
      h?.closest('button') ||
      h?.parentElement?.querySelector('button') ||
      h?.parentElement;
    clickable?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    (clickable instanceof HTMLElement ? clickable : null)?.click?.();
  });
  await page.waitForTimeout(1000);

  const afterExpand = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="accordion-filter"]');
    const html = root?.innerHTML?.slice(0, 4000) || '';
    const checks = [...document.querySelectorAll('input[type="checkbox"]')].map((c) => {
      const label =
        (c.id && document.querySelector(`label[for="${CSS.escape(c.id)}"]`)) ||
        c.closest('label');
      return {
        checked: c.checked,
        value: c.value,
        name: c.name,
        id: c.id,
        label: (label?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
        visible: !!(c.offsetWidth || c.offsetHeight || c.getClientRects().length),
      };
    });
    const options = [...(root?.querySelectorAll('label, [role="checkbox"], button') || [])]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && t.length < 80)
      .slice(0, 40);
    return { checks: checks.slice(0, 30), options, htmlSnippet: html.slice(0, 1500) };
  });
  log('desktop.afterBrandExpand', afterExpand);

  // Try clicking first visible checkbox or option with Blum
  const blum = page.getByText(/^Blum/i).first();
  if (await blum.isVisible().catch(() => false)) {
    await blum.click();
    await page.waitForTimeout(2500);
  } else if (afterExpand.checks.some((c) => c.visible)) {
    await page.locator('input[type="checkbox"]').first().check({ force: true });
    await page.waitForTimeout(2500);
  }

  log('desktop.afterSelect', {
    url: page.url(),
    params: Object.fromEntries(new URL(page.url()).searchParams.entries()),
    products: await page.locator('a.product-title').count(),
    checked: await page.evaluate(() =>
      [...document.querySelectorAll('input[type="checkbox"]')]
        .filter((c) => c.checked)
        .map((c) => ({
          label: (
            (c.id && document.querySelector(`label[for="${CSS.escape(c.id)}"]`)) ||
            c.closest('label')
          )?.textContent?.replace(/\s+/g, ' ').trim(),
          value: c.value,
          name: c.name,
        })),
    ),
    clearButtons: await page
      .getByRole('button')
      .filter({ hasText: /clear|reset/i })
      .allTextContents(),
    chips: await page.evaluate(() =>
      [...document.querySelectorAll('[class*="chip" i], [class*="badge" i], [data-testid*="selected" i]')]
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  });

  await context.close();
}

async function mobileFlow() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: headers,
  });
  const page = await context.newPage();
  await page.goto(withBypass(`${BASE}/search?q=hinges`), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);

  const trigger = page.getByRole('button', { name: /filters?\s*&\s*sort|filters?|refine/i });
  log('mobile.trigger', {
    count: await trigger.count(),
    text: await trigger.first().innerText().catch(() => null),
  });
  await trigger.first().click();
  await page.waitForTimeout(1500);

  const dialogish = await page.evaluate(() => {
    const vis = (el) =>
      !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    return {
      dialog: [...document.querySelectorAll('[role="dialog"], [data-state="open"]')]
        .filter(vis)
        .map((el) => ({
          role: el.getAttribute('role'),
          testId: el.getAttribute('data-testid'),
          className: String(el.className || '').slice(0, 100),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        }))
        .slice(0, 10),
      headings: [...document.querySelectorAll('h1,h2,h3,h4')]
        .filter(vis)
        .map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim())
        .slice(0, 20),
      buttons: [...document.querySelectorAll('button')]
        .filter(vis)
        .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((t) => /filter|sort|apply|done|clear|brand|close/i.test(t))
        .slice(0, 30),
      accordion: !!document.querySelector('[data-testid="accordion-filter"]'),
    };
  });
  log('mobile.afterOpen', dialogish);

  // Expand Brand if present
  await page.getByRole('button', { name: /^Brand$/i }).first().click().catch(() => undefined);
  await page.waitForTimeout(800);
  const option = page.getByText(/^Blum/i).first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    await page.waitForTimeout(1000);
  }

  const apply = page.getByRole('button', { name: /apply|done|show results|view results/i });
  log('mobile.apply', {
    count: await apply.count(),
    texts: await apply.allTextContents().catch(() => []),
  });
  if ((await apply.count()) > 0) {
    await apply.first().click();
    await page.waitForTimeout(2000);
  }

  log('mobile.afterApply', {
    url: page.url(),
    params: Object.fromEntries(new URL(page.url()).searchParams.entries()),
    products: await page.locator('a.product-title').count(),
  });

  await context.close();
}

await desktopFlow();
await mobileFlow();
await browser.close();
console.log('Wrote reports/filters-facets-deep.json');
