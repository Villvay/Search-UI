import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();
const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const headers = secret
  ? {
      'x-vercel-protection-bypass': secret,
      'x-vercel-set-bypass-cookie': 'samesitenone',
    }
  : {};
const withBypass = (url) => {
  const u = new URL(url);
  if (secret) {
    u.searchParams.set('x-vercel-protection-bypass', secret);
    u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
  }
  return u.toString();
};
const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: headers,
  })
).newPage();
await page.goto(withBypass('https://qa-baersupply.vercel.app/search?q=hinges'), {
  waitUntil: 'domcontentloaded',
});
await page.waitForTimeout(2000);
const len1 = await page.evaluate(() => history.length);
await page.getByTestId('trigger-Brand').click();
await page.getByTestId('checkbox-Brand-Blum, Inc.').click();
await page.waitForURL(/filters=/, { timeout: 15000 });
await page.waitForTimeout(3000);
const len2 = await page.evaluate(() => history.length);
const titles = await page.locator('a.product-title').allTextContents();
console.log({
  len1,
  len2,
  url: page.url(),
  titles: titles.slice(0, 6).map((t) => t.trim().slice(0, 70)),
});
await page.goBack();
await page.waitForTimeout(2500);
console.log('afterBack', page.url());
await browser.close();
