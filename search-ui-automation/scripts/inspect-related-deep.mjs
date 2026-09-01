/**
 * Deeper SERP scan for anything resembling related searches.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://qa-baersupply.vercel.app';

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();

const apiHits = [];
page.on('response', async (res) => {
  const u = res.url();
  if (
    /related|suggest|search|query|autocomplete|recommendation/i.test(u) &&
    !/\.(js|css|png|jpg|svg|woff|ico)/i.test(u)
  ) {
    let bodySnippet = null;
    try {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('json') || ct.includes('text')) {
        const t = await res.text();
        bodySnippet = t.slice(0, 500);
      }
    } catch {}
    apiHits.push({ status: res.status(), url: u.slice(0, 250), bodySnippet });
  }
});

async function openOk() {
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(1500);
    if (
      !(await page
        .getByText('Failed to verify your browser')
        .isVisible()
        .catch(() => false))
    )
      return;
  }
  throw new Error('blocked');
}

await openOk();
apiHits.length = 0;
await page.goto(`${BASE}/search?q=hinge`, {
  waitUntil: 'networkidle',
  timeout: 60_000,
});
await page.waitForTimeout(3000);

// Scroll through page to trigger lazy content
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 400) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 200));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1500);

const scan = await page.evaluate(() => {
  const vis = (el) =>
    !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  const bodyText = document.body.innerText || '';
  const relatedIdx = bodyText.toLowerCase().indexOf('related');
  const snippets = [];
  for (const word of [
    'related',
    'also search',
    'popular',
    'similar',
    'you may',
    'recommended',
    'trending',
  ]) {
    const i = bodyText.toLowerCase().indexOf(word);
    if (i >= 0) {
      snippets.push({
        word,
        around: bodyText.slice(Math.max(0, i - 40), i + 120).replace(/\s+/g, ' '),
      });
    }
  }

  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5')]
    .filter(vis)
    .map((h) => (h.textContent || '').trim())
    .filter(Boolean);

  // tabs / sections
  const tabs = [...document.querySelectorAll('[role="tab"],button,a')]
    .filter(vis)
    .map((el) => (el.textContent || '').trim())
    .filter((t) => t && t.length < 40)
    .slice(0, 80);

  // data attributes containing search
  const dataEls = [...document.querySelectorAll('*')]
    .filter((el) =>
      [...el.attributes].some((a) => /search|related|suggest/i.test(a.name)),
    )
    .slice(0, 40)
    .map((el) => ({
      tag: el.tagName,
      text: (el.textContent || '').trim().slice(0, 60),
      attrs: [...el.attributes]
        .filter((a) => /search|related|suggest|data-/i.test(a.name))
        .map((a) => `${a.name}=${String(a.value).slice(0, 60)}`),
    }));

  // Look for chip-like button rows below/near results
  const chipRows = [...document.querySelectorAll('div,section,ul')]
    .filter(vis)
    .map((el) => {
      const kids = [...el.children].filter(vis);
      const buttons = kids.filter(
        (k) =>
          k.tagName === 'BUTTON' ||
          k.tagName === 'A' ||
          k.getAttribute('role') === 'button',
      );
      if (buttons.length < 3) return null;
      const texts = buttons.map((b) => (b.textContent || '').trim()).filter(Boolean);
      if (texts.length < 3) return null;
      // skip nav-like
      if (texts.some((t) => /sign in|cart|account/i.test(t))) return null;
      const rect = el.getBoundingClientRect();
      return {
        count: texts.length,
        texts: texts.slice(0, 12),
        className: (el.className || '').toString().slice(0, 140),
        y: Math.round(rect.y),
        parentText: (el.parentElement?.textContent || '').trim().slice(0, 100),
      };
    })
    .filter(Boolean)
    .slice(0, 15);

  return {
    url: location.href,
    relatedIdx,
    snippets,
    headings,
    tabs,
    dataEls,
    chipRows,
    bodyLen: bodyText.length,
    bodyPreview: bodyText.slice(0, 1500),
  };
});

fs.writeFileSync(
  'reports/related-searches-deep.json',
  JSON.stringify({ scan, apiHits: apiHits.slice(0, 40) }, null, 2),
);
console.log('snippets', scan.snippets);
console.log('headings', scan.headings);
console.log('chipRows', scan.chipRows);
console.log('apiHits', apiHits.length, apiHits.slice(0, 10).map((h) => h.url));
console.log('dataEls sample', scan.dataEls.slice(0, 10));

await browser.close();
