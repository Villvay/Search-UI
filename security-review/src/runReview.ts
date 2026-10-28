import type { APIRequestContext, Browser, Page, Request, Response } from '@playwright/test';
import {
  getAutomationUserAgent,
  getVercelBypassHeaders,
} from './env';
import {
  absoluteUrl,
  type SecurityReviewConfig,
  sensitiveProbePaths,
} from './config';
import { scanDebugArtifacts, scanSourceMaps, scanTextForSecrets } from './scan';
import { inspectTls } from './tls';
import type {
  ConsoleRecord,
  CookieRecord,
  Finding,
  FormRecord,
  NetworkRecord,
  ProbeResult,
  SecurityReviewReport,
  Severity,
} from './types';

const SECURITY_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
];

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function runSecurityReview(params: {
  browser: Browser;
  config: SecurityReviewConfig;
}): Promise<SecurityReviewReport> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const findings: Finding[] = [];
  const probes: ProbeResult[] = [];
  const consoleRecords: ConsoleRecord[] = [];
  const networkRecords: NetworkRecord[] = [];
  const forms: FormRecord[] = [];
  let cookies: CookieRecord[] = [];
  let pagesVisited = 0;

  const tls = await inspectTls(params.config.baseURL);
  addTlsFindings(findings, tls, params.config.baseURL);

  const extraHeaders = {
    ...getVercelBypassHeaders(),
  };
  const userAgent = getAutomationUserAgent() || CHROME_UA;

  const context = await params.browser.newContext({
    baseURL: params.config.baseURL,
    viewport: { width: 1440, height: 900 },
    userAgent,
    extraHTTPHeaders: extraHeaders,
    ignoreHTTPSErrors: false,
  });

  try {
    const httpProbe = await probe(
      context.request,
      httpUrl(params.config.baseURL),
      'HEAD',
    );
    probes.push(httpProbe);
    addHttpsRedirectFinding(findings, httpProbe, params.config.baseURL);

    for (const filePath of sensitiveProbePaths()) {
      probes.push(
        await probe(context.request, absoluteUrl(params.config.baseURL, filePath), 'GET'),
      );
    }
    addSensitiveFileFindings(findings, probes);
    addRobotsFindings(findings, probes);

    const page = await context.newPage();
    page.on('console', (msg) => {
      consoleRecords.push({
        type: msg.type(),
        text: msg.text().slice(0, 400),
        location: msg.location().url || '',
      });
    });
    page.on('response', (response) => {
      networkRecords.push(toNetworkRecord(response));
    });

    const visitQueue = [...params.config.extraPaths].slice(0, params.config.maxPages);
    const visited = new Set<string>();

    for (const pathOrUrl of visitQueue) {
      const url = absoluteUrl(params.config.baseURL, pathOrUrl);
      if (visited.has(url)) continue;
      visited.add(url);
      pagesVisited += 1;
      await visitPage(page, url, params.config.navigationTimeoutMs, findings, forms);
    }

    cookies = (await context.cookies()).map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: String(cookie.sameSite ?? ''),
      expires: cookie.expires,
    }));
    addCookieFindings(findings, cookies);
    addConsoleFindings(findings, consoleRecords);
    addNetworkFindings(findings, networkRecords, params.config.baseURL);
    addFormFindings(findings, forms);

    await scanClientAssets(
      context.request,
      params.config,
      findings,
      networkRecords,
    );

    await addCorsFindings(findings, context.request, networkRecords, params.config.baseURL);
  } finally {
    await context.close();
  }

    const deduped = dedupeFindings(findings);
    const counts = countBySeverity(deduped);
    return {
      summary: {
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedMs,
        baseURL: params.config.baseURL,
        pagesVisited,
        requestsObserved: networkRecords.length,
        ...counts,
        total: deduped.length,
      },
      tls,
      findings: deduped,
    probes,
    cookies,
    console: consoleRecords.slice(0, 80),
    forms,
    networkHosts: uniqueHosts(networkRecords),
  };
}

async function visitPage(
  page: Page,
  url: string,
  timeout: number,
  findings: Finding[],
  forms: FormRecord[],
): Promise<void> {
  let response: Response | null = null;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  } catch (error) {
    findings.push(
      finding({
        id: `nav-fail-${hash(url)}`,
        severity: 'Medium',
        category: 'Broken Links',
        title: 'Page navigation failed',
        description: `Could not load ${url} during passive browsing.`,
        evidence: error instanceof Error ? error.message : String(error),
        affectedUrls: [url],
        whyItMatters: 'Broken entry pages block users and hide whether content is protected.',
        recommendedFix: 'Fix routing or origin errors for this URL.',
      }),
    );
    return;
  }

  const title = await page.title();
  const bodyText = ((await page.locator('body').innerText().catch(() => '')) || '').slice(0, 4000);
  if (/vercel security checkpoint|failed to verify your browser/i.test(`${title}\n${bodyText}`)) {
    findings.push(
      finding({
        id: `checkpoint-${hash(url)}`,
        severity: 'Informational',
        category: 'Best Practices',
        title: 'Vercel Security Checkpoint served',
        description: 'The page returned a bot-mitigation challenge instead of application HTML.',
        evidence: `Title: ${title}`,
        affectedUrls: [url],
        whyItMatters: 'Automated and some real clients cannot reach the app without a bypass.',
        recommendedFix: 'Keep checkpoint for bots; allow QA automation via bypass secret or UA allowlist.',
        confirmed: true,
      }),
    );
  }

  if (response) {
    addHeaderFindings(findings, response, url);
    const status = response.status();
    if (status >= 500) {
      findings.push(
        finding({
          id: `status-${status}-${hash(url)}`,
          severity: 'High',
          category: 'Broken Links',
          title: `HTTP ${status} on browsed page`,
          description: 'A user-facing page returned a server error.',
          evidence: `status=${status} final=${response.url()}`,
          affectedUrls: [url],
          whyItMatters: 'Server errors expose instability and can leak stack traces.',
          recommendedFix: 'Investigate the origin error and return a branded 5xx without internals.',
        }),
      );
    }
  }

  const html = await page.content();
  for (const hit of scanDebugArtifacts(html, url)) {
    findings.push(
      finding({
        id: `debug-${hash(hit.excerpt + url)}`,
        severity: 'Medium',
        category: 'Best Practices',
        title: hit.title,
        description: 'Debug or placeholder text is visible in page source or rendered HTML.',
        evidence: hit.excerpt,
        affectedUrls: [url],
        whyItMatters: 'Leftover debug copy signals incomplete QA hygiene and can leak internal names.',
        recommendedFix: 'Remove debug components and placeholder copy before sharing the environment.',
      }),
    );
  }
  for (const hit of scanTextForSecrets(html, url)) {
    findings.push(
      finding({
        id: `secret-html-${hash(hit.excerpt + url)}`,
        severity: 'High',
        category: 'Client-Side Security',
        title: hit.title,
        description: 'Secret-like value observed in HTML.',
        evidence: hit.excerpt,
        affectedUrls: [url],
        whyItMatters: 'Client-visible secrets can be copied from page source.',
        recommendedFix: 'Move secrets to server-side env vars; rotate any exposed credentials.',
      }),
    );
  }

  const pageForms = await page
    .evaluate(() =>
      Array.from(document.forms).map((form) => ({
        action: form.getAttribute('action') || form.action || '',
        method: (form.getAttribute('method') || '').toLowerCase(),
        autocomplete: form.getAttribute('autocomplete'),
        fields: Array.from(form.elements)
          .slice(0, 20)
          .map((el) => {
            const input = el as HTMLInputElement;
            return {
              name: input.name || input.id || '',
              type: (input.type || el.tagName).toLowerCase(),
              autocomplete: input.getAttribute('autocomplete'),
            };
          }),
      })),
    )
    .catch(() => []);
  for (const form of pageForms) {
    forms.push({ pageUrl: url, ...form });
  }
}

async function scanClientAssets(
  request: APIRequestContext,
  config: SecurityReviewConfig,
  findings: Finding[],
  networkRecords: NetworkRecord[],
): Promise<void> {
  const scriptUrls = networkRecords
    .filter((item) => item.resourceType === 'script' || /\.js(\?|$)/i.test(item.url))
    .map((item) => item.url)
    .filter((url) => url.startsWith('http'))
    .slice(0, config.maxScripts);

  for (const url of scriptUrls) {
    const result = await probe(request, url, 'GET');
    if (!result.bodyPreview) continue;
    for (const hit of scanTextForSecrets(result.bodyPreview, url)) {
      findings.push(
        finding({
          id: `secret-js-${hash(hit.excerpt + url)}`,
          severity: 'High',
          category: 'Client-Side Security',
          title: hit.title,
          description: 'Secret-like value observed in a downloaded JavaScript file.',
          evidence: `${hit.excerpt} in ${url}`,
          affectedUrls: [url],
          whyItMatters: 'Anything shipped to the browser is public.',
          recommendedFix: 'Remove hardcoded keys; use backend proxies and rotate exposed credentials.',
        }),
      );
    }
    for (const hit of scanSourceMaps(result.bodyPreview, url)) {
      findings.push(
        finding({
          id: `map-${hash(url)}`,
          severity: 'Low',
          category: 'Client-Side Security',
          title: 'JavaScript source map referenced',
          description: 'A sourceMappingURL comment was found in a JS bundle.',
          evidence: hit.excerpt,
          affectedUrls: [url],
          whyItMatters: 'Public source maps make original source easier to review.',
          recommendedFix: 'Disable public source maps on QA/production builds.',
        }),
      );
    }
  }

  const largeScripts = networkRecords.filter(
    (item) => item.resourceType === 'script' && /\.js(\?|$)/i.test(item.url),
  );
  if (largeScripts.length > 40) {
    findings.push(
      finding({
        id: 'many-scripts',
        severity: 'Low',
        category: 'Performance',
        title: 'Large number of script requests',
        description: `${largeScripts.length} JavaScript requests were observed during a short browse.`,
        evidence: largeScripts.slice(0, 8).map((item) => item.url).join('\n'),
        affectedUrls: [config.baseURL],
        whyItMatters: 'Excessive scripts increase attack surface and load time.',
        recommendedFix: 'Bundle, defer third-party tags, and remove unused libraries.',
      }),
    );
  }
}

async function addCorsFindings(
  findings: Finding[],
  request: APIRequestContext,
  networkRecords: NetworkRecord[],
  baseURL: string,
): Promise<void> {
  const originHost = hostOf(baseURL);
  const apiCandidates = unique(
    networkRecords
      .filter((item) => {
        const host = hostOf(item.url);
        return (
          host !== originHost &&
          (item.resourceType === 'fetch' ||
            item.resourceType === 'xhr' ||
            /\/(api|rest|search|multisearch|suggestions|trending)\b/i.test(item.url))
        );
      })
      .map((item) => item.url.split('?')[0]),
  ).slice(0, 6);

  for (const url of apiCandidates) {
    const result = await probe(request, url, 'GET', {
      Origin: 'https://example.invalid',
    });
    const acao = header(result.headers, 'access-control-allow-origin');
    const status = result.status ?? 0;
    if (acao === '*' && status >= 200 && status < 400) {
      findings.push(
        finding({
          id: `cors-${hash(url)}`,
          severity: 'High',
          category: 'Network',
          title: 'API allows any browser origin (CORS *)',
          description:
            'An API called by the site answered a GET from this review with Access-Control-Allow-Origin: *.',
          evidence: `${url} status=${status} ACAO=${acao} preview=${result.bodyPreview.slice(0, 180)}`,
          affectedUrls: [url],
          whyItMatters:
            'Any website can call this API from a visitor’s browser. Combined with unauthenticated JSON this enables scraping and data leakage.',
          recommendedFix:
            'Require authentication or signed tokens; restrict CORS to the storefront origin; do not expose QA APIs to the public internet.',
        }),
      );
    } else if (status >= 200 && status < 400 && looksLikeJson(result.contentType, result.bodyPreview)) {
      findings.push(
        finding({
          id: `api-public-${hash(url)}`,
          severity: 'Medium',
          category: 'Client-Side Security',
          title: 'Unauthenticated API response observed',
          description: 'A backend/search URL returned JSON without requiring a session in this passive GET.',
          evidence: `${url} status=${status} type=${result.contentType}`,
          affectedUrls: [url],
          whyItMatters: 'Public APIs can be enumerated and scraped.',
          recommendedFix: 'Authenticate API access on QA and production, or restrict by network.',
          confirmed: true,
        }),
      );
    }
  }
}

function addHeaderFindings(findings: Finding[], response: Response, url: string): void {
  const headers = lowercaseHeaders(response.headers());
  for (const name of SECURITY_HEADERS) {
    if (!headers[name]) {
      findings.push(
        finding({
          id: `header-missing-${name}-${hash(url)}`,
          severity: name === 'strict-transport-security' || name === 'content-security-policy' ? 'Medium' : 'Low',
          category: 'HTTP Headers',
          title: `Missing ${name}`,
          description: `The document response did not include ${name}.`,
          evidence: `URL ${response.url()} status=${response.status()}`,
          affectedUrls: [url],
          whyItMatters: 'Security headers reduce clickjacking, MIME sniffing, XSS, and HTTPS downgrade risk.',
          recommendedFix: `Set ${name} in Vercel/Next.js headers or middleware.`,
        }),
      );
    }
  }
}

function addCookieFindings(findings: Finding[], cookies: CookieRecord[]): void {
  for (const cookie of cookies) {
    const issues: string[] = [];
    if (!cookie.secure) issues.push('Secure');
    if (!cookie.httpOnly && looksSessionName(cookie.name)) issues.push('HttpOnly');
    if (!cookie.sameSite || cookie.sameSite.toLowerCase() === 'none') issues.push('SameSite');
    if (!issues.length) continue;
    findings.push(
      finding({
        id: `cookie-${cookie.name}`,
        severity: looksSessionName(cookie.name) ? 'Medium' : 'Low',
        category: 'Cookies',
        title: `Cookie ${cookie.name} missing flags: ${issues.join(', ')}`,
        description: 'A cookie observed during browsing is missing recommended security attributes.',
        evidence: `${cookie.name} domain=${cookie.domain} secure=${cookie.secure} httpOnly=${cookie.httpOnly} sameSite=${cookie.sameSite}`,
        affectedUrls: [cookie.domain],
        whyItMatters: 'Missing flags increase theft and CSRF risk.',
        recommendedFix: 'Set Secure, HttpOnly (for session cookies), and SameSite=Lax or Strict.',
      }),
    );
  }
}

function addConsoleFindings(findings: Finding[], records: ConsoleRecord[]): void {
  const errors = records.filter((item) => item.type === 'error');
  if (!errors.length) return;
  findings.push(
    finding({
      id: 'console-errors',
      severity: 'Low',
      category: 'Console',
      title: `${errors.length} browser console error(s)`,
      description: 'JavaScript or resource errors were logged during passive browsing.',
      evidence: errors
        .slice(0, 8)
        .map((item) => `[${item.type}] ${item.text}`)
        .join('\n'),
      affectedUrls: unique(errors.map((item) => item.location).filter(Boolean)).slice(0, 8),
      whyItMatters: 'Console errors often map to failed resources or unhandled exceptions.',
      recommendedFix: 'Fix failed assets and uncaught exceptions; avoid logging secrets.',
    }),
  );
}

function addNetworkFindings(
  findings: Finding[],
  records: NetworkRecord[],
  baseURL: string,
): void {
  const mixed = records.filter(
    (item) => item.url.startsWith('http://') && baseURL.startsWith('https://'),
  );
  if (mixed.length) {
    findings.push(
      finding({
        id: 'mixed-content',
        severity: 'High',
        category: 'SSL/TLS',
        title: 'Mixed content (HTTP resources on HTTPS page)',
        description: 'Insecure HTTP requests were observed while browsing an HTTPS origin.',
        evidence: mixed.slice(0, 8).map((item) => item.url).join('\n'),
        affectedUrls: mixed.slice(0, 8).map((item) => item.url),
        whyItMatters: 'Mixed content can be intercepted and is blocked by modern browsers.',
        recommendedFix: 'Load all assets over HTTPS.',
      }),
    );
  }

  const failed = records.filter((item) => (item.status ?? 0) >= 400);
  const brokenAssets = failed.filter((item) =>
    ['script', 'stylesheet', 'image', 'font'].includes(item.resourceType),
  );
  if (brokenAssets.length) {
    findings.push(
      finding({
        id: 'failed-assets',
        severity: 'Medium',
        category: 'Broken Links',
        title: `${brokenAssets.length} failed static asset(s)`,
        description: 'CSS, JS, image, or font requests returned 4xx/5xx during browsing.',
        evidence: brokenAssets
          .slice(0, 10)
          .map((item) => `${item.status} ${item.url}`)
          .join('\n'),
        affectedUrls: brokenAssets.slice(0, 10).map((item) => item.url),
        whyItMatters: 'Broken assets degrade UX and can hide missing security controls.',
        recommendedFix: 'Fix or remove the failing URLs.',
      }),
    );
  }

  const querySensitive = records.filter((item) =>
    /[?&](password|token|secret|key|email|userid|user_id)=/i.test(item.url),
  );
  if (querySensitive.length) {
    findings.push(
      finding({
        id: 'sensitive-query',
        severity: 'High',
        category: 'Network',
        title: 'Sensitive data in query string',
        description: 'A request URL included password, token, or similar parameters.',
        evidence: querySensitive.slice(0, 5).map((item) => redactQuery(item.url)).join('\n'),
        affectedUrls: querySensitive.slice(0, 5).map((item) => new URL(item.url).origin),
        whyItMatters: 'Query strings are logged by CDNs, analytics, and Referer headers.',
        recommendedFix: 'Send secrets in headers or POST bodies over HTTPS, never in URLs.',
      }),
    );
  }
}

function addFormFindings(findings: Finding[], forms: FormRecord[]): void {
  for (const form of forms) {
    const password = form.fields.find((field) => field.type === 'password');
    if (password && password.autocomplete === 'off') {
      findings.push(
        finding({
          id: `pwd-ac-${hash(form.pageUrl)}`,
          severity: 'Informational',
          category: 'Forms',
          title: 'Password field autocomplete=off',
          description: 'A password input disables browser password managers.',
          evidence: `${form.pageUrl} field=${password.name}`,
          affectedUrls: [form.pageUrl],
          whyItMatters: 'Blocking password managers can push users toward weaker passwords.',
          recommendedFix: 'Use autocomplete="current-password" or "new-password".',
        }),
      );
    }
    if (password && form.method === 'get') {
      findings.push(
        finding({
          id: `pwd-get-${hash(form.pageUrl)}`,
          severity: 'High',
          category: 'Forms',
          title: 'Password form uses GET',
          description: 'A password field was found on a form with method="get".',
          evidence: `method=${form.method} action=${form.action}`,
          affectedUrls: [form.pageUrl],
          whyItMatters: 'GET would put credentials in the URL and logs.',
          recommendedFix: 'Submit credentials with POST over HTTPS.',
        }),
      );
    }
  }
}

function addSensitiveFileFindings(findings: Finding[], probes: ProbeResult[]): void {
  for (const probe of probes) {
    const pathName = safePath(probe.url);
    const status = probe.status ?? 0;
    const looksExposed =
      status >= 200 &&
      status < 300 &&
      !/text\/html/i.test(probe.contentType || '') &&
      probe.bodyPreview.trim().length > 0;

    if (pathName === '/.env' && looksExposed) {
      findings.push(
        finding({
          id: 'dotenv-exposed',
          severity: 'Critical',
          category: 'Sensitive Files',
          title: '.env is publicly accessible',
          description: 'GET /.env returned a non-HTML body.',
          evidence: `status=${status} type=${probe.contentType} preview=${probe.bodyPreview.slice(0, 80)}`,
          affectedUrls: [probe.url],
          whyItMatters: 'Environment files often contain production secrets.',
          recommendedFix: 'Block /.env at the edge; rotate all exposed secrets immediately.',
        }),
      );
    }

    if (pathName === '/.git/config' && looksExposed) {
      findings.push(
        finding({
          id: 'git-exposed',
          severity: 'High',
          category: 'Sensitive Files',
          title: '.git/config is publicly accessible',
          description: 'Git metadata is reachable over HTTP.',
          evidence: `status=${status}`,
          affectedUrls: [probe.url],
          whyItMatters: 'Exposed git dirs can leak source and history.',
          recommendedFix: 'Deny /.git at the CDN/origin.',
        }),
      );
    }

    if (pathName === '/favicon.ico' && (status === 403 || status >= 500)) {
      findings.push(
        finding({
          id: 'favicon',
          severity: 'Low',
          category: 'Broken Links',
          title: `Favicon returned HTTP ${status}`,
          description: 'The site favicon is missing or forbidden.',
          evidence: `status=${status}`,
          affectedUrls: [probe.url],
          whyItMatters: 'Broken favicon is a QA defect and 403s add noise in crawlers.',
          recommendedFix: 'Serve a valid favicon.ico with 200.',
        }),
      );
    }

    if (pathName === '/admin' && status >= 200 && status < 400 && /admin/i.test(probe.bodyPreview)) {
      findings.push(
        finding({
          id: 'admin-route',
          severity: 'High',
          category: 'Authentication',
          title: 'Admin-looking route is reachable without login challenge',
          description: '/admin returned a 2xx/3xx page that still mentions admin in the body.',
          evidence: `status=${status} preview=${probe.bodyPreview.slice(0, 120)}`,
          affectedUrls: [probe.url],
          whyItMatters: 'Admin UIs should not be anonymously reachable.',
          recommendedFix: 'Require authentication and hide admin routes from public DNS if possible.',
          confirmed: false,
        }),
      );
    }
  }
}

function addRobotsFindings(findings: Finding[], probes: ProbeResult[]): void {
  const robots = probes.find((item) => safePath(item.url) === '/robots.txt');
  if (!robots || (robots.status ?? 0) !== 200) return;
  const body = robots.bodyPreview;
  const disallows = body
    .split('\n')
    .filter((line) => /^disallow:/i.test(line))
    .map((line) => line.replace(/^disallow:\s*/i, '').trim())
    .filter(Boolean);
  if (disallows.length) {
    findings.push(
      finding({
        id: 'robots-enum',
        severity: 'Informational',
        category: 'Sensitive Files',
        title: 'robots.txt lists application paths',
        description: 'Public robots.txt discloses routes that crawlers should skip.',
        evidence: disallows.slice(0, 20).join('\n'),
        affectedUrls: [robots.url],
        whyItMatters: 'Useful for mapping the app; not a vulnerability if those routes enforce auth.',
        recommendedFix: 'Keep robots.txt; ensure listed paths are authorized server-side.',
      }),
    );
  }
  const sitemap = body.match(/sitemap:\s*(\S+)/i)?.[1];
  if (sitemap) {
    const robotsHost = hostOf(robots.url);
    if (!sitemap.includes(robotsHost)) {
      findings.push(
        finding({
          id: 'robots-sitemap-host',
          severity: 'Low',
          category: 'Sensitive Files',
          title: 'robots.txt sitemap points at a different host',
          description: 'The sitemap URL is not on the reviewed origin.',
          evidence: sitemap,
          affectedUrls: [robots.url, sitemap],
          whyItMatters: 'QA environments should not advertise production sitemaps (or vice versa).',
          recommendedFix: 'Point Sitemap/Host at the current environment or omit them on QA.',
        }),
      );
    }
  }
}

function addHttpsRedirectFinding(
  findings: Finding[],
  probe: ProbeResult,
  httpsBase: string,
): void {
  const status = probe.status ?? 0;
  const location = probe.finalUrl || '';
  if (location.startsWith('https://')) return;
  if (status >= 300 && status < 400 && location.startsWith('https://')) return;
  if (probe.error) {
    findings.push(
      finding({
        id: 'http-probe-error',
        severity: 'Informational',
        category: 'SSL/TLS',
        title: 'HTTP probe did not complete',
        description: 'Could not confirm HTTP→HTTPS redirect with a HEAD request.',
        evidence: probe.error,
        affectedUrls: [probe.url],
        whyItMatters: 'HTTPS enforcement should be verified before launch.',
        recommendedFix: 'Force HTTPS at the edge (301/308 to the https origin).',
        confirmed: false,
      }),
    );
    return;
  }
  if (!(status >= 300 && status < 400 && location.startsWith('https://'))) {
    findings.push(
      finding({
        id: 'no-https-redirect',
        severity: 'High',
        category: 'SSL/TLS',
        title: 'HTTP is not clearly redirected to HTTPS',
        description: `HEAD ${probe.url} returned ${status} final=${location || 'n/a'}.`,
        evidence: `status=${status} final=${location}`,
        affectedUrls: [probe.url, httpsBase],
        whyItMatters: 'Users (or tools) hitting http:// may stay on an insecure channel.',
        recommendedFix: 'Issue a permanent redirect from HTTP to HTTPS.',
      }),
    );
  }
}

function addTlsFindings(
  findings: Finding[],
  tls: Awaited<ReturnType<typeof inspectTls>>,
  baseURL: string,
): void {
  if (!tls.authorized) {
    findings.push(
      finding({
        id: 'tls-untrusted',
        severity: 'High',
        category: 'SSL/TLS',
        title: 'TLS certificate is not trusted',
        description: tls.authorizationError || 'Certificate failed Node trust checks.',
        evidence: `host=${tls.hostname} issuer=${tls.issuer}`,
        affectedUrls: [baseURL],
        whyItMatters: 'Untrusted certificates enable interception warnings and MITM risk.',
        recommendedFix: 'Use a publicly trusted certificate covering the hostname.',
      }),
    );
  }
  if (tls.daysRemaining !== null && tls.daysRemaining < 14) {
    findings.push(
      finding({
        id: 'tls-expiring',
        severity: tls.daysRemaining < 0 ? 'High' : 'Medium',
        category: 'SSL/TLS',
        title: tls.daysRemaining < 0 ? 'TLS certificate expired' : 'TLS certificate expires soon',
        description: `Certificate valid_to=${tls.validTo} (${tls.daysRemaining} days).`,
        evidence: `subject=${tls.subject}`,
        affectedUrls: [baseURL],
        whyItMatters: 'Expired certificates break HTTPS for all users.',
        recommendedFix: 'Renew automatically (Vercel/Let’s Encrypt).',
      }),
    );
  }
}

async function probe(
  request: APIRequestContext,
  url: string,
  method: 'GET' | 'HEAD',
  extraHeaders: Record<string, string> = {},
): Promise<ProbeResult> {
  try {
    const response = await request.fetch(url, {
      method,
      headers: extraHeaders,
      maxRedirects: 5,
      timeout: 20_000,
      failOnStatusCode: false,
    });
    const headers = lowercaseHeaders(response.headers());
    let bodyPreview = '';
    if (method === 'GET') {
      const text = await response.text().catch(() => '');
      bodyPreview = text.slice(0, 4000);
    }
    return {
      url,
      method,
      status: response.status(),
      finalUrl: response.url(),
      contentType: headers['content-type'] || null,
      headers,
      redirected: response.url() !== url,
      error: null,
      bodyPreview,
    };
  } catch (error) {
    return {
      url,
      method,
      status: null,
      finalUrl: null,
      contentType: null,
      headers: {},
      redirected: false,
      error: error instanceof Error ? error.message : String(error),
      bodyPreview: '',
    };
  }
}

function finding(
  input: Omit<Finding, 'confirmed'> & { confirmed?: boolean },
): Finding {
  return { confirmed: true, ...input };
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const item of findings) {
    const key = `${item.severity}|${item.title}|${item.category}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item, affectedUrls: [...item.affectedUrls] });
      continue;
    }
    existing.affectedUrls = unique([...existing.affectedUrls, ...item.affectedUrls]);
    if (item.evidence && !existing.evidence.includes(item.evidence.slice(0, 80))) {
      existing.evidence = `${existing.evidence}\n${item.evidence}`.slice(0, 2000);
    }
    existing.confirmed = existing.confirmed && item.confirmed;
  }
  return [...byKey.values()];
}

function toNetworkRecord(response: Response): NetworkRecord {
  const request: Request = response.request();
  return {
    method: request.method(),
    url: response.url(),
    resourceType: request.resourceType(),
    status: response.status(),
    contentType: response.headers()['content-type'] || null,
  };
}

function lowercaseHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

function header(headers: Record<string, string>, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

function countBySeverity(findings: Finding[]): Record<
  'critical' | 'high' | 'medium' | 'low' | 'informational',
  number
> {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  for (const item of findings) {
    if (item.severity === 'Critical') counts.critical += 1;
    else if (item.severity === 'High') counts.high += 1;
    else if (item.severity === 'Medium') counts.medium += 1;
    else if (item.severity === 'Low') counts.low += 1;
    else counts.informational += 1;
  }
  return counts;
}

function uniqueHosts(records: NetworkRecord[]): string[] {
  return unique(records.map((item) => hostOf(item.url)).filter(Boolean)).sort();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function httpUrl(httpsBase: string): string {
  const url = new URL(httpsBase);
  url.protocol = 'http:';
  url.port = url.port === '443' ? '' : url.port;
  return url.toString();
}

function looksSessionName(name: string): boolean {
  return /session|sid|token|auth|jwt/i.test(name);
}

function looksLikeJson(contentType: string | null, body: string): boolean {
  return /json/i.test(contentType || '') || /^\s*[{[]/.test(body);
}

function redactQuery(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of parsed.searchParams.keys()) {
      if (/password|token|secret|key|email|userid|user_id/i.test(key)) {
        parsed.searchParams.set(key, '[redacted]');
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function hash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}
