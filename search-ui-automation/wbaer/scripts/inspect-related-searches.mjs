/**
 * Live QA inspection for Related Searches on SERP.
 * Writes reports/related-searches-inspect.json
 */
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'https://qa-baersupply.vercel.app';
const out = {};
const save = () =>
  fs.writeFileSync(
    'reports/related-searches-inspect.json',
    JSON.stringify(out, null, 2),
  );

async function openHome(page) {
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(1500);
    const blocked = await page
      .getByText('Failed to verify your browser')
      .isVisible()
      .catch(() => false);
    if (!blocked) return;
  }
  throw new Error('Vercel Security Checkpoint blocked inspection');
}

async function gotoSearch(page, q) {
  await page.goto(`${BASE}/search?q=${encodeURIComponent(q)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);
}

async function inspectRelated(page, label) {
  const data = await page.evaluate(() => {
    const vis = (el) =>
      !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

    const allText = document.body.innerText || '';
    const relatedMention = /related\s*search/i.test(allText);

    // Find headings that mention Related
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,p,span,div')]
      .filter(vis)
      .filter((el) => /related\s*search/i.test((el.textContent || '').trim()))
      .map((el) => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 120),
        className: (el.className || '').toString().slice(0, 120),
        id: el.id || null,
        attrs: [...el.attributes]
          .filter((a) => a.name.startsWith('data-') || a.name === 'role')
          .map((a) => `${a.name}=${a.value}`)
          .slice(0, 10),
      }))
      .slice(0, 15);

    // Walk from a "Related Searches" heading to nearby interactive items
    let section = null;
    const headingEl = [...document.querySelectorAll('h1,h2,h3,h4,h5,p,span,div')]
      .filter(vis)
      .find((el) => {
        const t = (el.textContent || '').trim();
        return /^Related Searches?$/i.test(t) || /^Related Searches?/i.test(t);
      });

    if (headingEl) {
      // climb for a section container
      let node = headingEl;
      for (let i = 0; i < 6 && node; i++) {
        const parent = node.parentElement;
        if (!parent) break;
        const buttons = [...parent.querySelectorAll('a,button,[role="link"],[role="button"]')].filter(
          vis,
        );
        if (buttons.length >= 1) {
          section = parent;
          break;
        }
        node = parent;
      }
      if (!section) section = headingEl.parentElement;
    }

    // Also try data-* attributes
    const dataRelated = [...document.querySelectorAll('[data-related], [data-related-search], [data-search-related], [class*="related"]')]
      .filter(vis)
      .map((el) => ({
        tag: el.tagName,
        className: (el.className || '').toString().slice(0, 160),
        text: (el.textContent || '').trim().slice(0, 80),
        attrs: [...el.attributes]
          .filter((a) => a.name.startsWith('data-') || ['href', 'role', 'aria-label'].includes(a.name))
          .map((a) => `${a.name}=${String(a.value).slice(0, 80)}`),
      }))
      .slice(0, 20);

    let items = [];
    if (section) {
      items = [...section.querySelectorAll('a,button,[role="link"],[role="button"]')]
        .filter(vis)
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            text: (el.textContent || '').trim().slice(0, 80),
            href: el.getAttribute('href'),
            role: el.getAttribute('role'),
            className: (el.className || '').toString().slice(0, 120),
            attrs: [...el.attributes]
              .filter((a) => a.name.startsWith('data-'))
              .map((a) => `${a.name}=${a.value}`),
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            },
          };
        })
        .filter((it) => it.text && !/^Related Searches?$/i.test(it.text));
    }

    // Position relative to results heading / bottom
    const resultsHeading = [...document.querySelectorAll('h1,h2,h3')]
      .filter(vis)
      .find((h) => /Search Results for/i.test(h.textContent || ''));
    const noResults = [...document.querySelectorAll('h1,h2,h3')]
      .filter(vis)
      .some((h) => /^No Results$/i.test((h.textContent || '').trim()));

    const headingRect = headingEl?.getBoundingClientRect();
    const resultsRect = resultsHeading?.getBoundingClientRect();

    // Layout: wrap vs scroll
    let layout = null;
    if (section && items.length > 1) {
      const ys = items.map((i) => i.rect.y);
      const uniqueYs = [...new Set(ys.map((y) => Math.round(y / 8) * 8))];
      const overflowX =
        section.scrollWidth > section.clientWidth + 4 ||
        getComputedStyle(section).overflowX.includes('auto') ||
        getComputedStyle(section).overflowX.includes('scroll');
      layout = {
        multiRow: uniqueYs.length > 1,
        overflowX,
        sectionScrollWidth: section.scrollWidth,
        sectionClientWidth: section.clientWidth,
        sectionClass: (section.className || '').toString().slice(0, 160),
        sectionTag: section.tagName,
      };
    }

    // Sample all visible button texts that look like chips near related
    return {
      url: location.href,
      q: new URL(location.href).searchParams.get('q'),
      route: new URL(location.href).searchParams.get('route'),
      relatedMention,
      noResults,
      hasSearchResultsHeading: !!resultsHeading,
      headings,
      dataRelated,
      headingText: headingEl ? (headingEl.textContent || '').trim() : null,
      headingTag: headingEl?.tagName || null,
      headingY: headingRect ? Math.round(headingRect.y) : null,
      resultsHeadingY: resultsRect ? Math.round(resultsRect.y) : null,
      relatedAboveResults:
        headingRect && resultsRect
          ? headingRect.y < resultsRect.y
          : null,
      relatedNearBottom:
        headingRect
          ? headingRect.y > window.innerHeight * 0.6
          : null,
      itemCount: items.length,
      items,
      layout,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      inputValue:
        document.querySelector('input[name="query"]')?.value ??
        document.querySelector('input[placeholder*="looking"]')?.value ??
        null,
    };
  });

  out[label] = data;
  save();
  return data;
}

const browser = await chromium.launch({ headless: true });

async function withViewport(name, size, fn) {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  try {
    await fn(page, name);
  } finally {
    await context.close();
  }
}

await withViewport('desktop', { width: 1440, height: 900 }, async (page) => {
  await openHome(page);

  for (const q of [
    'hinge',
    'screw',
    'drawer',
    'blum',
    'makita',
    'zzzznonexistentproduct12345',
    'abc123',
  ]) {
    await gotoSearch(page, q);
    const snap = await inspectRelated(page, `desktop:${q}`);
    console.log(
      `desktop q=${q} related=${snap.headingText} count=${snap.itemCount} aboveResults=${snap.relatedAboveResults}`,
    );
    if (snap.items?.[0]) {
      console.log('  first item:', snap.items[0].text, snap.items[0].href, snap.items[0].tag);
    }
  }

  // Click first related for hinge if present
  await gotoSearch(page, 'hinge');
  const before = await inspectRelated(page, 'desktop:hinge:before-click');
  if (before.itemCount > 0) {
    const firstText = before.items[0].text;
    const loc = page.getByRole('button', { name: firstText, exact: true }).first();
    const link = page.getByRole('link', { name: firstText, exact: true }).first();
    if (await loc.isVisible().catch(() => false)) {
      await loc.click();
    } else if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else {
      await page.getByText(firstText, { exact: true }).first().click();
    }
    await page.waitForTimeout(2500);
    const after = await inspectRelated(page, 'desktop:hinge:after-click');
    out['desktop:click'] = {
      clicked: firstText,
      beforeUrl: before.url,
      afterUrl: after.url,
      afterQ: after.q,
      afterRoute: after.route,
      afterInput: after.inputValue,
      afterHeading: after.headingText,
      afterItemCount: after.itemCount,
    };
    save();
    console.log('click result', out['desktop:click']);
  }
});

await withViewport('mobile', { width: 390, height: 844 }, async (page) => {
  await openHome(page);
  await gotoSearch(page, 'hinge');
  const snap = await inspectRelated(page, 'mobile:hinge');
  console.log(
    `mobile q=hinge related=${snap.headingText} count=${snap.itemCount} layout=`,
    snap.layout,
  );
});

await browser.close();
console.log('Wrote reports/related-searches-inspect.json');
