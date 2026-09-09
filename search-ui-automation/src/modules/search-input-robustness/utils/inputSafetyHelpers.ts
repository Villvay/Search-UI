import { type Dialog, type Page } from '@playwright/test';
import type { InputCategory, RobustnessQuery } from '../data/queries';

export type DialogCapture = {
  type: string;
  message: string;
  url: string;
  inputUsed: string;
  viewport: string;
};

export type DomSafetySnapshot = {
  unexpectedImgSrcX: boolean;
  unexpectedScriptTags: number;
  boldFromQuery: boolean;
  headingText: string | null;
};

/** Report-safe value: never echo full JS/HTML payloads or megabyte strings. */
export function sanitizeReportValue(
  query: RobustnessQuery | { category: InputCategory; value: string; reportLabel?: string },
): string {
  if (query.reportLabel) return query.reportLabel;
  if (query.category === 'long') return `length=${query.value.length}`;
  if (
    query.category === 'javascript-like' ||
    query.category === 'html-like'
  ) {
    return `${query.category};chars=${query.value.length}`;
  }
  const raw = query.value;
  if (raw.length > 48) {
    return `${query.category};chars=${raw.length};prefix=${escapeForReport(raw.slice(0, 24))}`;
  }
  return escapeForReport(raw);
}

function escapeForReport(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '\\n');
}

export function getUrlQueryParam(url: string, param = 'q'): string | null {
  try {
    return new URL(url).searchParams.get(param);
  } catch {
    return null;
  }
}

export function headingMatchesQuery(
  heading: string | null,
  query: string,
): boolean {
  if (!heading) return false;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `Search Results for\\s+"${escaped}"|No Results`,
    'i',
  ).test(heading);
}

export async function captureDomSafety(page: Page): Promise<DomSafetySnapshot> {
  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')].filter((img) => {
      const src = (img.getAttribute('src') || '').trim().toLowerCase();
      return src === 'x' || src.endsWith('/x');
    });
    const scripts = document.querySelectorAll('script');
    const heading =
      [...document.querySelectorAll('h1,h2,h3')]
        .map((e) => (e.textContent || '').trim())
        .find((t) => /Search Results for|No Results/i.test(t)) || null;
    // Query-injected <b> would create a bold element inside heading; text-only keeps tags literal.
    const boldFromQuery = Boolean(
      heading &&
        [...document.querySelectorAll('h1 b, h2 b, h3 b')].some((b) =>
          /hinge/i.test(b.textContent || ''),
        ),
    );
    return {
      unexpectedImgSrcX: imgs.length > 0,
      unexpectedScriptTags: scripts.length,
      boldFromQuery,
      headingText: heading,
    };
  });
}

/**
 * Dialog listener for robustness tests. Dismisses only so the runner can finish;
 * any capture must fail the test.
 */
export class DialogGuard {
  readonly dialogs: DialogCapture[] = [];
  private readonly handler: (dialog: Dialog) => void;

  constructor(
    private readonly page: Page,
    private readonly meta: { inputUsed: string; viewport: string },
  ) {
    this.handler = (dialog: Dialog) => {
      this.dialogs.push({
        type: dialog.type(),
        message: dialog.message(),
        url: this.page.url(),
        inputUsed: this.meta.inputUsed,
        viewport: this.meta.viewport,
      });
      void dialog.dismiss().catch(() => undefined);
    };
  }

  attach(): void {
    this.page.on('dialog', this.handler);
  }

  detach(): void {
    this.page.off('dialog', this.handler);
  }

  setInputUsed(value: string): void {
    this.meta.inputUsed = value;
  }
}

export type SerpSnapshot = {
  url: string;
  q: string | null;
  inputValue: string;
  heading: string | null;
  pathname: string;
};

export async function captureSerpSnapshot(page: Page): Promise<SerpSnapshot> {
  return page.evaluate(() => {
    const url = location.href;
    let q: string | null = null;
    let pathname = '/';
    try {
      const u = new URL(url);
      q = u.searchParams.get('q');
      pathname = u.pathname;
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
    return {
      url,
      q,
      inputValue: visible?.value ?? '',
      heading,
      pathname,
    };
  });
}
