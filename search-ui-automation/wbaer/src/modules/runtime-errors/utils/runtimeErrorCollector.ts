import {
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';
import {
  RUNTIME_ERRORS_BEHAVIOR,
  type RuntimeErrorRecord,
  type RuntimeErrorType,
} from '../data/behavior';
import {
  classifyRuntimeError,
  sanitizeMessage,
  sanitizeUrl,
  summarizeRecords,
} from './classify';

export type CollectorContext = {
  query?: string;
  viewport?: string;
  browser?: string;
  baseURL: string;
};

/**
 * Per-page runtime error collector. Attach once; reset between logical phases;
 * detach in finally. No shared worker globals.
 */
export class RuntimeErrorCollector {
  private attached = false;
  private records: RuntimeErrorRecord[] = [];
  private context: CollectorContext;

  private readonly onConsole: (msg: ConsoleMessage) => void;
  private readonly onPageError: (error: Error) => void;
  private readonly onRequestFailed: (request: Request) => void;
  private readonly onResponse: (response: Response) => void;

  constructor(
    private readonly page: Page,
    context: CollectorContext,
  ) {
    this.context = { ...context };
    this.onConsole = (msg) => this.handleConsole(msg);
    this.onPageError = (error) => this.handlePageError(error);
    this.onRequestFailed = (request) => this.handleRequestFailed(request);
    this.onResponse = (response) => this.handleResponse(response);
  }

  setContext(partial: Partial<CollectorContext>): void {
    this.context = { ...this.context, ...partial };
  }

  attach(): void {
    if (this.attached) return;
    this.page.on('console', this.onConsole);
    this.page.on('pageerror', this.onPageError);
    this.page.on('requestfailed', this.onRequestFailed);
    this.page.on('response', this.onResponse);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    this.page.off('console', this.onConsole);
    this.page.off('pageerror', this.onPageError);
    this.page.off('requestfailed', this.onRequestFailed);
    this.page.off('response', this.onResponse);
    this.attached = false;
  }

  reset(): void {
    this.records = [];
  }

  snapshot(): RuntimeErrorRecord[] {
    return [...this.records];
  }

  summary() {
    return summarizeRecords(this.records);
  }

  unexpected(options?: { includeExpectedInStrict?: boolean }): RuntimeErrorRecord[] {
    const includeExpected =
      options?.includeExpectedInStrict !== false && RUNTIME_ERRORS_BEHAVIOR.strict;
    return this.records.filter((r) => {
      if (r.classification === 'unexpected') return true;
      if (includeExpected && r.classification === 'expected') return true;
      return false;
    });
  }

  /** Safe probe: triggers requestfailed without mutating application routes. */
  async probeRequestFailure(): Promise<void> {
    await this.page.evaluate(async () => {
      try {
        await fetch('https://runtime-errors-probe.invalid/collector-check');
      } catch {
        // expected — DNS / network failure
      }
    });
  }

  /** Safe probe: first-party-like ignored third-party 404 already seen on QA. */
  async probeIgnoredHttp404(): Promise<void> {
    await this.page.evaluate(async () => {
      try {
        await fetch(
          'https://cdn.acsbapp.com/config/qa-baersupply.vercel.app/config.json',
        );
      } catch {
        // ignore
      }
    });
  }

  private push(
    type: RuntimeErrorType,
    message: string,
    extra: Partial<RuntimeErrorRecord> = {},
  ): void {
    const classified = classifyRuntimeError({
      type,
      message,
      url: extra.url,
      status: extra.status,
      baseURL: this.context.baseURL,
    });
    this.records.push({
      type,
      classification: classified.classification,
      reason: classified.reason,
      message: sanitizeMessage(message),
      url: sanitizeUrl(extra.url),
      method: extra.method,
      status: extra.status,
      resourceType: extra.resourceType,
      timestamp: new Date().toISOString(),
      query: this.context.query,
      viewport: this.context.viewport,
      browser: this.context.browser,
      stack: extra.stack ? sanitizeMessage(extra.stack) : undefined,
    });
  }

  private handleConsole(msg: ConsoleMessage): void {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const location = msg.location();
    this.push(type === 'error' ? 'console-error' : 'console-warn', msg.text(), {
      url: location?.url,
    });
  }

  private handlePageError(error: Error): void {
    this.push('page-error', error.message || String(error), {
      url: this.page.url(),
      stack: error.stack,
    });
  }

  private handleRequestFailed(request: Request): void {
    const failure = request.failure();
    this.push(
      'request-failure',
      failure?.errorText || 'request failed',
      {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      },
    );
  }

  private handleResponse(response: Response): void {
    const status = response.status();
    if (status < 400) return;
    const request = response.request();
    // Skip bulky static assets noise unless Search API
    const resourceType = request.resourceType();
    if (
      ['image', 'stylesheet', 'font', 'media'].includes(resourceType) &&
      !request.url().includes(RUNTIME_ERRORS_BEHAVIOR.searchApiHostFragment)
    ) {
      return;
    }
    this.push('http-error', `HTTP ${status}`, {
      url: response.url(),
      method: request.method(),
      status,
      resourceType,
    });
  }
}
