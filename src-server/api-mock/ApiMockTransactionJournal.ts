/**
 * API Mock Studio — bounded transaction journal (Phase 5A).
 * Per-server ring buffer with cursor-based retrieval, body truncation, and redaction.
 */
import type { ApiMockTransactionV1, ApiMockServerSettingsV1, ApiMockResponseCookieV1 } from '../../src/shared/api-mock/contracts.js';
import { HARD_CEILINGS } from '../../src/shared/api-mock/defaults.js';
import { getByPath, setByPath } from '../../src/shared/utils/jsonPath.js';
import { loadJournalSnapshot, saveJournalSnapshot } from './apiMockJournalPersist.js';

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
  private persistToDisk: boolean;
  private journalEnabled: boolean;
  private readonly persistFile: string | undefined;
  private drops = 0;
  private truncations = 0;

  constructor(settings: ApiMockServerSettingsV1, options?: { persistFile?: string }) {
    this.maxEntries = Math.max(0, Math.min(settings.journal.maxEntries, HARD_CEILINGS.maxJournalEntries));
    this.maxBodyBytes = Math.min(settings.journal.maxCapturedBodyBytes, HARD_CEILINGS.maxCapturedBodyBytes);
    this.redactionHeaders = settings.redaction.headerNames.map(h => h.toLowerCase());
    this.redactionJsonPaths = settings.redaction.jsonPaths;
    this.preserveScheme = settings.redaction.preserveScheme;
    this.persistFile = options?.persistFile;
    this.journalEnabled = settings.journal.enabled !== false;
    this.persistToDisk = Boolean(settings.journal.persistToDisk && this.persistFile);
    if (this.persistToDisk && this.journalEnabled) this.restoreFromDisk();
  }

  append(tx: ApiMockTransactionV1): number {
    const cursor = ++this.cursorCounter;
    if (!this.journalEnabled || this.maxEntries === 0 || !tx?.request) return cursor;
    const redacted = this.redactTransaction(tx);
    const truncated = this.truncateBodies(redacted);

    if (this.count < this.maxEntries) {
      this.buffer[(this.head + this.count) % this.maxEntries] = truncated;
      this.count++;
    } else {
      this.drops++;
      this.buffer[this.head] = truncated;
      this.head = (this.head + 1) % this.maxEntries;
    }
    this.flushToDisk();
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

    const maxPage = HARD_CEILINGS.maxJournalEntries;
    const requested = typeof q.limit === 'number' && Number.isFinite(q.limit) && q.limit >= 0
      ? q.limit
      : maxPage;
    const limit = Math.min(requested, maxPage);
    let startIdx = 0;
    if (q.afterCursor) {
      const found = filtered.findIndex((_, i) => i >= q.afterCursor!);
      startIdx = found < 0 ? filtered.length : found;
    }
    const page = filtered.slice(startIdx, startIdx + limit);

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
    this.drops = 0;
    this.truncations = 0;
    // Wipe the snapshot even when persist is currently off so turning it back
    // on cannot resurrect entries the user just cleared.
    if (this.persistToDisk) this.flushToDisk();
    else if (this.persistFile) {
      saveJournalSnapshot(this.persistFile, {
        cursor: this.cursorCounter,
        transactions: [],
        drops: 0,
        truncations: 0,
      });
    }
  }

  getAll(): ApiMockTransactionV1[] {
    return this.toOrdered();
  }

  size(): number {
    return this.count;
  }

  getStats(): { drops: number; truncations: number; size: number; maxEntries: number } {
    return {
      drops: this.drops,
      truncations: this.truncations,
      size: this.count,
      maxEntries: this.maxEntries,
    };
  }

  updateSettings(settings: ApiMockServerSettingsV1): void {
    this.redactionHeaders = settings.redaction.headerNames.map(h => h.toLowerCase());
    this.redactionJsonPaths = settings.redaction.jsonPaths;
    this.preserveScheme = settings.redaction.preserveScheme;
    const journalEnabling = settings.journal.enabled !== false && !this.journalEnabled;
    this.journalEnabled = settings.journal.enabled !== false;
    const next = Boolean(settings.journal.persistToDisk && this.persistFile);
    const persistEnabling = next && !this.persistToDisk;
    this.persistToDisk = next;
    if (this.journalEnabled && this.persistToDisk && this.count === 0 && (persistEnabling || journalEnabling)) {
      this.restoreFromDisk();
      return;
    }
    this.reapplyRedaction();
    if (this.persistToDisk) this.flushToDisk();
  }

  private restoreFromDisk(): void {
    if (!this.persistFile || this.maxEntries === 0) return;
    const snap = loadJournalSnapshot(this.persistFile);
    if (!snap) return;
    const txs = snap.transactions.slice(-this.maxEntries).map(tx => this.truncateBodies(this.redactTransaction(tx), false));
    this.buffer = txs;
    this.head = 0;
    this.count = txs.length;
    this.cursorCounter = Math.max(snap.cursor, txs.length);
    this.drops = snap.drops ?? 0;
    this.truncations = snap.truncations ?? 0;
    this.flushToDisk();
  }

  private flushToDisk(): void {
    if (!this.persistToDisk || !this.persistFile) return;
    saveJournalSnapshot(this.persistFile, {
      cursor: this.cursorCounter,
      transactions: this.toOrdered(),
      drops: this.drops,
      truncations: this.truncations,
    });
  }

  private reapplyRedaction(): void {
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % this.maxEntries;
      const tx = this.buffer[idx];
      if (tx) this.buffer[idx] = this.truncateBodies(this.redactTransaction(tx), false);
    }
  }

  private redactHeaderMap(headers: Record<string, string[] | string | undefined> | undefined): Record<string, string[]> {
    const redacted: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(headers ?? {})) {
      const list = Array.isArray(values) ? values : values == null ? [] : [String(values)];
      if (this.redactionHeaders.includes(key.toLowerCase())) {
        redacted[key] = list.map(v => this.redactHeaderValue(key, v));
      } else {
        redacted[key] = list;
      }
    }
    return redacted;
  }

  private redactCookieMap(cookies: Record<string, string> | undefined): Record<string, string> {
    if (!cookies) return {};
    if (!this.redactionHeaders.includes('cookie')) return cookies;
    return Object.fromEntries(Object.entries(cookies).map(([k]) => [k, '[REDACTED]']));
  }

  private redactResponseCookies(cookies: ApiMockResponseCookieV1[] | undefined): ApiMockResponseCookieV1[] {
    if (!cookies?.length) return cookies ?? [];
    if (!this.redactionHeaders.includes('set-cookie')) return cookies;
    return cookies.map(c => ({ ...c, value: '[REDACTED]' }));
  }

  private redactTransaction(tx: ApiMockTransactionV1): ApiMockTransactionV1 {
    return {
      ...tx,
      request: {
        ...tx.request,
        headers: this.redactHeaderMap(tx.request.headers),
        cookies: this.redactCookieMap(tx.request.cookies),
        body: this.redactJsonBody(tx.request.body),
      },
      response: tx.response ? {
        ...tx.response,
        headers: this.redactHeaderMap(tx.response.headers),
        cookies: this.redactResponseCookies(tx.response.cookies),
        body: this.redactJsonBody(tx.response.body),
      } : undefined,
    };
  }

  /** Replace configured JSONPath locations in JSON bodies. Non-JSON bodies are unchanged. */
  private redactJsonBody(body: string | null): string | null {
    if (body == null || this.redactionJsonPaths.length === 0) return body;
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { return body; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return body;
    let changed = false;
    for (const raw of this.redactionJsonPaths) {
      const path = raw.trim();
      if (!path || path.includes('[')) continue;
      if (getByPath(parsed, path) === undefined) continue;
      setByPath(parsed as Record<string, unknown>, path, '[REDACTED]');
      changed = true;
    }
    return changed ? JSON.stringify(parsed) : body;
  }

  private redactHeaderValue(key: string, value: string): string {
    const header = key.toLowerCase();
    if (this.preserveScheme && (header === 'authorization' || header === 'proxy-authorization')) {
      const spaceIdx = value.indexOf(' ');
      if (spaceIdx > 0) return `${value.slice(0, spaceIdx)} [REDACTED]`;
    }
    return '[REDACTED]';
  }

  private truncateBodies(tx: ApiMockTransactionV1, count = true): ApiMockTransactionV1 {
    const reqBody = tx.request.body;
    const resBody = tx.response?.body;
    const reqTrunc = reqBody != null && reqBody.length > this.maxBodyBytes;
    const resTrunc = resBody != null && resBody.length > this.maxBodyBytes;
    if (count && (reqTrunc || resTrunc)) this.truncations++;
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
