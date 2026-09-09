import { type Page, type Response } from '@playwright/test';
import { CACHE_STATE_BEHAVIOR } from '../data/behavior';

export type SerpIdentity = {
  url: string;
  q: string | null;
  filters: string | null;
  inputValue: string;
  heading: string | null;
  productCount: number;
  productTitlesSample: string[];
  productsTab: string | null;
};

export type SearchRequestMeta = {
  url: string;
  method: string;
  status: number;
  resourceType: string;
  cacheControl: string | null;
};

/** Lightweight SERP identity snapshot (no response bodies). */
export async function captureSerpIdentity(page: Page): Promise<SerpIdentity> {
  return page.evaluate(() => {
    const url = location.href;
    let q: string | null = null;
    let filters: string | null = null;
    try {
      const u = new URL(url);
      q = u.searchParams.get('q');
      filters = u.searchParams.get('filters');
    } catch {
      /* ignore */
    }

    const heading =
      [...document.querySelectorAll('h1,h2,h3')]
        .map((e) => (e.textContent || '').trim())
        .find((t) => /Search Results for|No Results/i.test(t)) || null;

    const inputs = [
      ...document.querySelectorAll(
        'input[name="query"], input[placeholder*="looking" i]',
      ),
    ] as HTMLInputElement[];
    const visible = inputs.find(
      (i) => !!(i.offsetParent || i.getClientRects().length),
    );
    const inputValue = visible?.value ?? '';

    const titles = [...document.querySelectorAll('a.product-title')]
      .filter((a) => !!(a as HTMLElement).offsetParent || a.getClientRects().length)
      .slice(0, 8)
      .map((a) => (a.textContent || '').trim().replace(/\s+/g, ' '));

    const productsTab =
      [...document.querySelectorAll('[role=tab]')]
        .map((t) => (t.textContent || '').trim())
        .find((t) => /^Products/i.test(t)) || null;

    return {
      url,
      q,
      filters,
      inputValue,
      heading,
      productCount: document.querySelectorAll('a.product-title').length,
      productTitlesSample: titles,
      productsTab,
    };
  });
}

export function headingMatchesQuery(heading: string | null, query: string): boolean {
  if (!heading) return false;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `Search Results for\\s+"${escaped}"|No Results`,
    'i',
  ).test(heading);
}

/** Attach a short-lived response sampler for Search API /search docs. */
export function attachSearchRequestSampler(page: Page): {
  records: SearchRequestMeta[];
  detach: () => void;
} {
  const records: SearchRequestMeta[] = [];
  const onResponse = (response: Response) => {
    const url = response.url();
    if (
      !url.includes(CACHE_STATE_BEHAVIOR.searchApiHostFragment) &&
      !/\/search\?/i.test(url)
    ) {
      return;
    }
    if (/\.(js|css|png|jpg|svg|woff)/i.test(url)) return;
    const req = response.request();
    records.push({
      url: url.slice(0, 300),
      method: req.method(),
      status: response.status(),
      resourceType: req.resourceType(),
      cacheControl: response.headers()['cache-control'] || null,
    });
  };
  page.on('response', onResponse);
  return {
    records,
    detach: () => page.off('response', onResponse),
  };
}

export async function hasServiceWorkerOrCacheApi(page: Page): Promise<{
  hasSW: boolean;
  registrations: string[];
  cacheNames: string[];
}> {
  return page.evaluate(async () => {
    const hasSW = 'serviceWorker' in navigator;
    let registrations: string[] = [];
    let cacheNames: string[] = [];
    try {
      if (hasSW) {
        registrations = (await navigator.serviceWorker.getRegistrations()).map(
          (r) => r.scope,
        );
      }
      if ('caches' in window) {
        cacheNames = await caches.keys();
      }
    } catch {
      /* ignore */
    }
    return { hasSW, registrations, cacheNames };
  });
}
