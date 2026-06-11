/**
 * Phase 9 — Console pure helpers: entry builders, filtering, ring-buffer
 * append, and Raw-timeline line parsing. No React, no side effects beyond a
 * monotonic id counter (mirrors `createSseEvent`).
 *
 * Honesty note: the browser/proxy WebSocket API does not expose the real
 * upgrade wire headers (`Sec-WebSocket-Key`/`Accept`). The handshake entry is
 * RECONSTRUCTED from data we actually have (URL, requested subprotocols, masked
 * resolved auth, negotiated protocol/extensions, 101 status). We never fabricate
 * the Key/Accept lines. SSE handshakes use the real request headers we set.
 */

import type {
  WsConsoleCategory,
  WsConsoleDirection,
  WsConsoleEntry,
  WsConsoleLevel,
  WsConsoleSettings,
} from './wsConsoleTypes';
import { WS_CONSOLE_DIRECTION_GLYPHS } from './wsConsoleTypes';

let consoleIdCounter = 0;

/** Generate a process-unique console entry id. */
export function makeConsoleEntryId(): string {
  consoleIdCounter += 1;
  return `con-${consoleIdCounter}-${Date.now()}`;
}

interface EntryInit {
  level: WsConsoleLevel;
  direction: WsConsoleDirection;
  category: WsConsoleCategory;
  message: string;
  detail?: string;
}

function makeEntry(init: EntryInit): WsConsoleEntry {
  return {
    id: makeConsoleEntryId(),
    level: init.level,
    direction: init.direction,
    category: init.category,
    message: init.message,
    detail: init.detail,
    timestamp: new Date().toISOString(),
  };
}

/** Split a `ws://`/`wss://`/`http(s)://` URL into host + path for the request line. */
export function splitUrlForRequestLine(url: string): { host: string; path: string } {
  try {
    const u = new URL(url);
    const path = `${u.pathname || '/'}${u.search}`;
    return { host: u.host, path: path || '/' };
  } catch {
    return { host: url, path: '/' };
  }
}

// ── WebSocket entry builders ─────────────────────────────────────────

export function buildConnectingEntry(url: string): WsConsoleEntry {
  return makeEntry({
    level: 'info',
    direction: 'info',
    category: 'lifecycle',
    message: `Connecting to ${url}`,
  });
}

export interface WsHandshakeParams {
  url: string;
  /** Comma/space separated requested subprotocols (from the draft). */
  subprotocols?: string;
  /** Masked auth summary from `describeResolvedAuth`, or null/undefined. */
  authSummary?: string | null;
  /** Negotiated subprotocol from the connection snapshot. */
  protocol?: string;
  /** Negotiated extensions from the connection snapshot. */
  extensions?: string;
  latencyMs?: number;
}

export function buildHandshakeEntry(params: WsHandshakeParams): WsConsoleEntry {
  const { host, path } = splitUrlForRequestLine(params.url);
  const lines: string[] = [
    `* Preparing WebSocket upgrade to ${params.url}`,
    `> GET ${path} HTTP/1.1`,
    `> Host: ${host}`,
    '> Connection: Upgrade',
    '> Upgrade: websocket',
    '> Sec-WebSocket-Version: 13',
  ];
  const requested = (params.subprotocols ?? '').trim();
  if (requested) {
    const normalized = requested
      .split(/[\s,]+/)
      .filter(Boolean)
      .join(', ');
    if (normalized) lines.push(`> Sec-WebSocket-Protocol: ${normalized}`);
  }
  if (params.authSummary) {
    lines.push(`* Auth: ${params.authSummary}`);
  }
  lines.push('< HTTP/1.1 101 Switching Protocols');
  lines.push('< Connection: Upgrade');
  lines.push('< Upgrade: websocket');
  if (params.protocol) lines.push(`< Sec-WebSocket-Protocol: ${params.protocol}`);
  if (params.extensions) lines.push(`< Sec-WebSocket-Extensions: ${params.extensions}`);
  const latency = typeof params.latencyMs === 'number' ? ` (handshake ${params.latencyMs}ms)` : '';
  lines.push(`* WebSocket connection established${latency}`);

  return makeEntry({
    level: 'info',
    direction: 'info',
    category: 'handshake',
    message: '101 Switching Protocols',
    detail: lines.join('\n'),
  });
}

export function buildEstablishedEntry(params: {
  protocol?: string;
  latencyMs?: number;
}): WsConsoleEntry {
  const parts: string[] = [];
  if (params.protocol) parts.push(params.protocol);
  if (typeof params.latencyMs === 'number') parts.push(`${params.latencyMs}ms`);
  const suffix = parts.length ? ` (${parts.join(', ')})` : '';
  return makeEntry({
    level: 'info',
    direction: 'in',
    category: 'lifecycle',
    message: `Connected${suffix}`,
  });
}

export function buildProtocolEntry(detection: {
  protocol: string;
  confidence: string;
  reason: string;
}): WsConsoleEntry {
  return makeEntry({
    level: 'info',
    direction: 'info',
    category: 'protocol',
    message: `Protocol detected: ${detection.protocol} (${detection.confidence})`,
    detail: detection.reason ? `* ${detection.reason}` : undefined,
  });
}

const NORMAL_CLOSE_CODES = new Set([1000, 1001, 1005]);

export function buildClosingEntry(): WsConsoleEntry {
  return makeEntry({
    level: 'info',
    direction: 'info',
    category: 'lifecycle',
    message: 'Closing connection',
  });
}

export function buildClosedEntry(params: {
  closeCode?: number;
  closeReason?: string;
}): WsConsoleEntry {
  const codePart = typeof params.closeCode === 'number' ? ` (code ${params.closeCode})` : '';
  const reasonPart = params.closeReason ? `: ${params.closeReason}` : '';
  const abnormal =
    typeof params.closeCode === 'number' && !NORMAL_CLOSE_CODES.has(params.closeCode);
  return makeEntry({
    level: abnormal ? 'warn' : 'info',
    direction: 'info',
    category: 'lifecycle',
    message: `Disconnected${codePart}${reasonPart}`,
  });
}

export function buildErrorEntry(message?: string): WsConsoleEntry {
  return makeEntry({
    level: 'error',
    direction: 'info',
    category: 'lifecycle',
    message: message ? `Connection error: ${message}` : 'Connection error',
  });
}

export function buildReconnectEntry(params: {
  attempt: number;
  maxAttempts: number;
}): WsConsoleEntry {
  return makeEntry({
    level: 'warn',
    direction: 'info',
    category: 'reconnect',
    message: `Reconnect attempt ${params.attempt}/${params.maxAttempts}`,
  });
}

export function buildControlEntry(latencyMs: number): WsConsoleEntry {
  return makeEntry({
    level: 'info',
    direction: 'info',
    category: 'control',
    message: `Ping/pong — latency ${latencyMs}ms`,
  });
}

// ── Command-line entry builders (Phase 10) ───────────────────────────

/** Echo a command the user typed, shown with the `$` glyph in the Raw view. */
export function buildCommandEchoEntry(input: string): WsConsoleEntry {
  return makeEntry({
    level: 'info',
    direction: 'command',
    category: 'command',
    message: input,
  });
}

/** A successful command result line. */
export function buildCommandResultEntry(message: string, detail?: string): WsConsoleEntry {
  return makeEntry({
    level: 'info',
    direction: 'info',
    category: 'command',
    message,
    detail,
  });
}

/** A command error (bad usage, unknown command, not connected, …). */
export function buildCommandErrorEntry(message: string): WsConsoleEntry {
  return makeEntry({
    level: 'error',
    direction: 'info',
    category: 'command',
    message,
  });
}

/** Render the `/help` listing as a single entry with a multi-line detail body. */
export function buildHelpEntry(
  specs: { usage: string; description: string }[],
): WsConsoleEntry {
  const width = specs.reduce((m, s) => Math.max(m, s.usage.length), 0);
  const lines = specs.map((s) => `${s.usage.padEnd(width)}  ${s.description}`);
  return makeEntry({
    level: 'info',
    direction: 'info',
    category: 'command',
    message: `Available commands (${specs.length})`,
    detail: lines.join('\n'),
  });
}


// ── SSE entry builders ───────────────────────────────────────────────

export function buildSseConnectingEntry(url: string): WsConsoleEntry {
  return makeEntry({
    level: 'info',
    direction: 'info',
    category: 'lifecycle',
    message: `Connecting to ${url}`,
  });
}

export interface SseHandshakeParams {
  url: string;
  /** Masked auth summary from `describeResolvedAuth`, or null/undefined. */
  authSummary?: string | null;
  /** Present (non-empty) on a resume → `Last-Event-ID` request header. */
  lastEventId?: string;
  /** Extra request headers the user configured (already key/value). */
  extraHeaders?: { key: string; value: string }[];
}

export function buildSseHandshakeEntry(params: SseHandshakeParams): WsConsoleEntry {
  const { host, path } = splitUrlForRequestLine(params.url);
  const lines: string[] = [
    `* Preparing request to ${params.url}`,
    `> GET ${path} HTTP/1.1`,
    `> Host: ${host}`,
    '> Accept: text/event-stream',
    '> Cache-Control: no-cache',
  ];
  if (params.lastEventId) lines.push(`> Last-Event-ID: ${params.lastEventId}`);
  for (const h of params.extraHeaders ?? []) {
    if (h.key.trim()) lines.push(`> ${h.key}: ${h.value}`);
  }
  if (params.authSummary) lines.push(`* Auth: ${params.authSummary}`);
  lines.push('< HTTP/1.1 200 OK');
  lines.push('< Content-Type: text/event-stream');
  lines.push('* SSE stream open');

  return makeEntry({
    level: 'info',
    direction: 'info',
    category: 'handshake',
    message: '200 OK — stream open',
    detail: lines.join('\n'),
  });
}

export function buildSseClosedEntry(): WsConsoleEntry {
  return makeEntry({
    level: 'info',
    direction: 'info',
    category: 'lifecycle',
    message: 'Stream closed',
  });
}

export function buildSseErrorEntry(message?: string): WsConsoleEntry {
  return makeEntry({
    level: 'error',
    direction: 'info',
    category: 'lifecycle',
    message: message ? `Stream error: ${message}` : 'Stream error',
  });
}

export function buildSseReconnectEntry(params: {
  attempt: number;
  retryMs: number;
}): WsConsoleEntry {
  return makeEntry({
    level: 'warn',
    direction: 'info',
    category: 'reconnect',
    message: `Reconnecting in ${params.retryMs}ms (attempt ${params.attempt})`,
  });
}

// ── Ring buffer + filtering ──────────────────────────────────────────

/** Append `entry` to `entries`, dropping oldest beyond `maxEntries`. Pure. */
export function appendCapped(
  entries: WsConsoleEntry[],
  entry: WsConsoleEntry,
  maxEntries: number,
): WsConsoleEntry[] {
  const next = [...entries, entry];
  if (maxEntries > 0 && next.length > maxEntries) {
    return next.slice(next.length - maxEntries);
  }
  return next;
}

/** Filter entries by level, category, and a free-text search (message + detail). */
export function filterConsoleEntries(
  entries: WsConsoleEntry[],
  settings: Pick<WsConsoleSettings, 'levelFilter' | 'categoryFilter'>,
  search: string,
): WsConsoleEntry[] {
  const needle = search.trim().toLowerCase();
  return entries.filter((e) => {
    if (settings.levelFilter !== 'all' && e.level !== settings.levelFilter) return false;
    if (settings.categoryFilter !== 'all' && e.category !== settings.categoryFilter) return false;
    if (needle) {
      const haystack = `${e.message}\n${e.detail ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

// ── Raw timeline parsing ─────────────────────────────────────────────

export type RawLineKind = 'info' | 'out' | 'in' | 'cmd' | 'plain';

export interface RawConsoleLine {
  glyph: string;
  text: string;
  kind: RawLineKind;
}

function classifyDetailLine(line: string): RawConsoleLine {
  if (line.startsWith('> ')) return { glyph: '>', text: line.slice(2), kind: 'out' };
  if (line.startsWith('< ')) return { glyph: '<', text: line.slice(2), kind: 'in' };
  if (line.startsWith('* ')) return { glyph: '*', text: line.slice(2), kind: 'info' };
  if (line.startsWith('$ ')) return { glyph: '$', text: line.slice(2), kind: 'cmd' };
  return { glyph: '', text: line, kind: 'plain' };
}

const DIRECTION_KIND: Record<WsConsoleDirection, RawLineKind> = {
  out: 'out',
  in: 'in',
  info: 'info',
  command: 'cmd',
};

/** Format an ISO timestamp as `HH:MM:SS.mmm` (local time) for the time column. */
export function formatConsoleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** Plain-text rendering of entries for Copy / Export (Raw-timeline style). */
export function consoleEntriesToText(entries: WsConsoleEntry[]): string {
  return entries
    .map((e) => {
      const head = `${formatConsoleTime(e.timestamp)} [${e.level.toUpperCase()}] ${e.category}: ${e.message}`;
      return e.detail ? `${head}\n${e.detail}` : head;
    })
    .join('\n');
}

/**
 * Expand a single entry into Raw-timeline lines: a primary line (glyph from the
 * entry's direction) followed by each parsed `detail` line.
 */
export function parseRawConsoleLines(entry: WsConsoleEntry): RawConsoleLine[] {
  const lines: RawConsoleLine[] = [
    {
      glyph: WS_CONSOLE_DIRECTION_GLYPHS[entry.direction],
      text: entry.message,
      kind: DIRECTION_KIND[entry.direction],
    },
  ];
  if (entry.detail) {
    for (const raw of entry.detail.split('\n')) {
      lines.push(classifyDetailLine(raw));
    }
  }
  return lines;
}
