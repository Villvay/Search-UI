import {
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';
import { type RuntimeErrorRecord } from '../data/behavior';
import { classifyRuntimeError, sanitizeMessage, sanitizeUrl, unexpected } from './classify';

export type CollectorContext = {
  query?: string;
  viewport?: string;
  browser?: string;
  baseURL: string;
};

export class RuntimeErrorCollector {
  private attached = false;
  private records: RuntimeErrorRecord[] = [];
  private context: CollectorContext;

  constructor(
    private readonly page: Page,
    context: CollectorContext,
  ) {
    this.context = { ...context };
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

  unexpected(): RuntimeErrorRecord[] {
    return unexpected(this.snapshot());
  }

  private push(
    type: RuntimeErrorRecord['type'],
    message: string,
    extra: Partial<RuntimeErrorRecord> = {},
  ): void {
    const classified = classifyRuntimeError({
      type,
      message,
      url: extra.url,
      status: extra.status,
    });
    this.records.push({
      type,
      message: sanitizeMessage(message),
      url: sanitizeUrl(extra.url),
      status: extra.status,
      timestamp: new Date().toISOString(),
      query: this.context.query,
      viewport: this.context.viewport,
      browser: this.context.browser,
      classification: classified.classification,
      reason: classified.reason,
    });
  }

  private onConsole = (msg: ConsoleMessage): void => {
    if (msg.type() !== 'error') return;
    this.push('console-error', msg.text());
  };

  private onPageError = (error: Error): void => {
    this.push('page-error', error.message);
  };

  private onRequestFailed = (request: Request): void => {
    const failure = request.failure()?.errorText ?? 'request failed';
    this.push('request-failure', failure, { url: request.url() });
  };

  private onResponse = (response: Response): void => {
    if (response.status() >= 400) {
      this.push('http-error', `HTTP ${response.status()}`, {
        url: response.url(),
        status: response.status(),
      });
    }
  };
}
