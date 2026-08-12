/**
 * API Mock Studio — bounded transaction journal (Phase 5A).
 * Per-server ring buffer with cursor-based retrieval, body truncation, and redaction.
 */
import type { ApiMockTransactionV1, ApiMockServerSettingsV1 } from '../../src/shared/api-mock/contracts.js';
import { HARD_CEILINGS } from '../../src/shared/api-mock/defaults.js';

export interface JournalQuery {
  afterCursor?: number;
  limit?: number;
  methodFilter?: string;
  pathFilter?: string;
  outcomeFilter?: string;
}

export interface JournalPage {
  transactions: ApiMockTransactionV1[];
  cursor: number;
  total: number;
  capped: boolean;
}

export class ApiMockTransactionJournal {
  // Circular ring buffer: O(1) append with no per-append full-array copy.
  private buffer: ApiMockTransactionV1[] = [];
  private head = 0;
  private count = 0;
  private cursorCounter = 0;
  private readonly maxEntries: number;
  private readonly maxBodyBytes: number;
  private redactionHeaders: string[];
  private redactionJsonPaths: string[];
  private preserveScheme: boolean;

  constructor(settings: ApiMockServerSettingsV1) {
    this.maxEntries = Math.max(0, Math.min(settings.journal.maxEntries, HARD_CEILINGS.maxJournalEntries));
    this.maxBodyBytes = Math.min(settings.journal.maxCapturedBodyBytes, HARD_CEILINGS.maxCapturedBodyBytes);
    this.redactionHeaders = settings.redaction.headerNames.map(h => h.toLowerCase());
    this.redactionJsonPaths = settings.redaction.jsonPaths;
    this.preserveScheme = settings.redaction.preserveScheme;
  }

  append(tx: ApiMockTransactionV1): number {
    const cursor = ++this.cursorCounter;
    if (this.maxEntries === 0) return cursor;
    const redacted = this.redactTransaction(tx);
    const truncated = this.truncateBodies(redacted);

    if (this.count < this.maxEntries) {
      this.buffer[(this.head + this.count) % this.maxEntries] = truncated;
      this.count++;
    } else {
      this.buffer[this.head] = truncated;
      this.head = (this.head + 1) % this.maxEntries;
    }
    return cursor;
  }

  private toOrdered(): ApiMockTransactionV1[] {
    const out: ApiMockTransactionV1[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      out[i] = this.buffer[(this.head + i) % this.maxEntries];
    }
    return out;
  }

  query(q: JournalQuery = {}): JournalPage {
    let filtered = this.toOrdered();

    if (q.methodFilter) {
      const m = q.methodFilter.toUpperCase();
      filtered = filtered.filter(t => t.request.method === m);
    }
    if (q.pathFilter) {
      const p = q.pathFilter.toLowerCase();
      filtered = filtered.filter(t => t.request.path.toLowerCase().includes(p));
    }
    if (q.outcomeFilter) {
      filtered = filtered.filter(t => t.outcome === q.outcomeFilter);
    }

    const startIdx = q.afterCursor ? filtered.findIndex((_, i) => i >= (q.afterCursor ?? 0)) : 0;
    const limit = Math.min(q.limit ?? 50, 100);
    const page = filtered.slice(Math.max(0, startIdx), startIdx + limit);

    return {
      transactions: page,
      cursor: this.cursorCounter,
      total: this.count,
      capped: this.count >= this.maxEntries && this.maxEntries > 0,
    };
  }

  clear(): void {
    this.buffer = [];
    this.head = 0;
    this.count = 0;
  }

  getAll(): ApiMockTransactionV1[] {
    return this.toOrdered();
  }

  size(): number {
    return this.count;
  }

  updateSettings(settings: ApiMockServerSettingsV1): void {
    this.redactionHeaders = settings.redaction.headerNames.map(h => h.toLowerCase());
    this.redactionJsonPaths = settings.redaction.jsonPaths;
    this.preserveScheme = settings.redaction.preserveScheme;
  }

  private redactTransaction(tx: ApiMockTransactionV1): ApiMockTransactionV1 {
    const redactedHeaders: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(tx.request.headers)) {
      if (this.redactionHeaders.includes(key.toLowerCase())) {
        redactedHeaders[key] = values.map(v => this.redactHeaderValue(key, v));
      } else {
        redactedHeaders[key] = values;
      }
    }

    return {
      ...tx,
      request: { ...tx.request, headers: redactedHeaders },
    };
  }

  private redactHeaderValue(key: string, value: string): string {
    if (this.preserveScheme && key.toLowerCase() === 'authorization') {
      const spaceIdx = value.indexOf(' ');
      if (spaceIdx > 0) return `${value.slice(0, spaceIdx)} [REDACTED]`;
    }
    return '[REDACTED]';
  }

  private truncateBodies(tx: ApiMockTransactionV1): ApiMockTransactionV1 {
    const reqBody = tx.request.body;
    const resBody = tx.response?.body;
    return {
      ...tx,
      request: {
        ...tx.request,
        body: reqBody && reqBody.length > this.maxBodyBytes ? reqBody.slice(0, this.maxBodyBytes) : reqBody,
        bodyTruncated: tx.request.bodyTruncated || (reqBody != null && reqBody.length > this.maxBodyBytes),
      },
      response: tx.response ? {
        ...tx.response,
        body: resBody && resBody.length > this.maxBodyBytes ? resBody.slice(0, this.maxBodyBytes) : resBody,
        bodyTruncated: tx.response.bodyTruncated || (resBody != null && resBody.length > this.maxBodyBytes),
      } : undefined,
    };
  }
}
