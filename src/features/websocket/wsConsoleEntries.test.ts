import { describe, it, expect } from 'vitest';
import {
  appendCapped,
  buildClosedEntry,
  buildCommandEchoEntry,
  buildCommandErrorEntry,
  buildCommandResultEntry,
  buildConnectingEntry,
  buildControlEntry,
  buildErrorEntry,
  buildEstablishedEntry,
  buildHandshakeEntry,
  buildHelpEntry,
  buildProtocolEntry,
  buildReconnectEntry,
  buildSseClosedEntry,
  buildSseConnectingEntry,
  buildSseErrorEntry,
  buildSseHandshakeEntry,
  buildSseReconnectEntry,
  consoleEntriesToText,
  filterConsoleEntries,
  formatConsoleTime,
  makeConsoleEntryId,
  parseRawConsoleLines,
  splitUrlForRequestLine,
} from './wsConsoleEntries';
import type { WsConsoleEntry } from './wsConsoleTypes';

describe('makeConsoleEntryId', () => {
  it('produces unique ids', () => {
    const a = makeConsoleEntryId();
    const b = makeConsoleEntryId();
    expect(a).not.toBe(b);
    expect(a.startsWith('con-')).toBe(true);
  });
});

describe('command-line entry builders (Phase 10)', () => {
  it('echoes a typed command with the command direction + category', () => {
    const e = buildCommandEchoEntry('/ping');
    expect(e).toMatchObject({
      level: 'info',
      direction: 'command',
      category: 'command',
      message: '/ping',
    });
  });

  it('builds a result entry with optional detail', () => {
    const e = buildCommandResultEntry('Ping sent.', 'rtt 12ms');
    expect(e).toMatchObject({ level: 'info', category: 'command', message: 'Ping sent.', detail: 'rtt 12ms' });
  });

  it('builds an error entry at error level', () => {
    const e = buildCommandErrorEntry('Not connected.');
    expect(e).toMatchObject({ level: 'error', category: 'command', message: 'Not connected.' });
  });

  it('builds a help entry listing each command with aligned usage', () => {
    const e = buildHelpEntry([
      { usage: '/help', description: 'List commands.' },
      { usage: '/connect [url]', description: 'Connect.' },
    ]);
    expect(e.message).toBe('Available commands (2)');
    expect(e.detail).toContain('/help');
    expect(e.detail).toContain('List commands.');
    expect(e.detail).toContain('/connect [url]');
    // shorter usage is padded so descriptions align
    expect(e.detail).toMatch(/^\/help\s+List commands\.$/m);
  });
});

describe('splitUrlForRequestLine', () => {
  it('splits a ws URL into host + path', () => {
    expect(splitUrlForRequestLine('ws://localhost:8765/chat?x=1')).toEqual({
      host: 'localhost:8765',
      path: '/chat?x=1',
    });
  });

  it('defaults path to / when absent', () => {
    expect(splitUrlForRequestLine('wss://example.com')).toEqual({
      host: 'example.com',
      path: '/',
    });
  });

  it('defaults path to / when pathname is empty', () => {
    expect(splitUrlForRequestLine('ws://localhost:8765#')).toEqual({
      host: 'localhost:8765',
      path: '/',
    });
  });

  it('falls back gracefully for an unparseable URL', () => {
    expect(splitUrlForRequestLine('not a url')).toEqual({ host: 'not a url', path: '/' });
  });
});

describe('WS entry builders', () => {
  it('builds a connecting entry', () => {
    const e = buildConnectingEntry('ws://localhost:8765');
    expect(e.category).toBe('lifecycle');
    expect(e.level).toBe('info');
    expect(e.message).toContain('ws://localhost:8765');
  });

  it('reconstructs a handshake entry without fabricating Key/Accept', () => {
    const e = buildHandshakeEntry({
      url: 'ws://localhost:8765/chat',
      subprotocols: 'graphql-ws, json',
      authSummary: 'Authorization: Bearer abcd…wxyz',
      protocol: 'json',
      extensions: 'permessage-deflate',
      latencyMs: 18,
    });
    expect(e.category).toBe('handshake');
    expect(e.message).toBe('101 Switching Protocols');
    const detail = e.detail ?? '';
    expect(detail).toContain('> GET /chat HTTP/1.1');
    expect(detail).toContain('> Host: localhost:8765');
    expect(detail).toContain('> Sec-WebSocket-Protocol: graphql-ws, json');
    expect(detail).toContain('* Auth: Authorization: Bearer abcd…wxyz');
    expect(detail).toContain('< HTTP/1.1 101 Switching Protocols');
    expect(detail).toContain('< Sec-WebSocket-Protocol: json');
    expect(detail).toContain('< Sec-WebSocket-Extensions: permessage-deflate');
    expect(detail).toContain('(handshake 18ms)');
    // Honesty: never fabricate the wire key/accept.
    expect(detail).not.toContain('Sec-WebSocket-Key');
    expect(detail).not.toContain('Sec-WebSocket-Accept');
  });

  it('omits optional handshake lines when data is absent', () => {
    const e = buildHandshakeEntry({ url: 'ws://h/' });
    const detail = e.detail ?? '';
    expect(detail).not.toContain('Sec-WebSocket-Protocol');
    expect(detail).not.toContain('* Auth:');
    expect(detail).not.toContain('Sec-WebSocket-Extensions');
    expect(detail).toContain('* WebSocket connection established');
  });

  it('builds an established entry with protocol + latency', () => {
    const e = buildEstablishedEntry({ protocol: 'json', latencyMs: 12 });
    expect(e.message).toBe('Connected (json, 12ms)');
    expect(e.direction).toBe('in');
  });

  it('marks abnormal close codes as warn', () => {
    expect(buildClosedEntry({ closeCode: 1006 }).level).toBe('warn');
    expect(buildClosedEntry({ closeCode: 1000 }).level).toBe('info');
    expect(buildClosedEntry({}).level).toBe('info');
  });

  it('includes close code + reason in the message', () => {
    const e = buildClosedEntry({ closeCode: 1001, closeReason: 'going away' });
    expect(e.message).toBe('Disconnected (code 1001): going away');
  });

  it('builds an error entry', () => {
    expect(buildErrorEntry('boom').level).toBe('error');
    expect(buildErrorEntry('boom').message).toBe('Connection error: boom');
    expect(buildErrorEntry().message).toBe('Connection error');
  });

  it('builds a reconnect entry', () => {
    const e = buildReconnectEntry({ attempt: 2, maxAttempts: 5 });
    expect(e.category).toBe('reconnect');
    expect(e.level).toBe('warn');
    expect(e.message).toBe('Reconnect attempt 2/5');
  });

  it('builds a protocol entry', () => {
    const e = buildProtocolEntry({ protocol: 'stomp', confidence: 'high', reason: 'matched' });
    expect(e.category).toBe('protocol');
    expect(e.message).toContain('stomp');
    expect(e.detail).toBe('* matched');
  });

  it('omits protocol detail when no reason is provided', () => {
    const e = buildProtocolEntry({ protocol: 'json', confidence: 'low', reason: '' });
    expect(e.detail).toBeUndefined();
  });

  it('builds a control entry', () => {
    const e = buildControlEntry(18);
    expect(e.category).toBe('control');
    expect(e.message).toContain('18ms');
  });
});

describe('SSE entry builders', () => {
  it('builds an SSE handshake with real request headers', () => {
    const e = buildSseHandshakeEntry({
      url: 'http://localhost:9000/stream',
      authSummary: 'Authorization: Bearer x…y',
      lastEventId: '42',
      extraHeaders: [{ key: 'X-Custom', value: 'v' }],
    });
    const detail = e.detail ?? '';
    expect(detail).toContain('> Accept: text/event-stream');
    expect(detail).toContain('> Cache-Control: no-cache');
    expect(detail).toContain('> Last-Event-ID: 42');
    expect(detail).toContain('> X-Custom: v');
    expect(detail).toContain('* Auth: Authorization: Bearer x…y');
    expect(detail).toContain('< HTTP/1.1 200 OK');
  });

  it('omits Last-Event-ID when not resuming', () => {
    const e = buildSseHandshakeEntry({ url: 'http://h/s' });
    expect(e.detail).not.toContain('Last-Event-ID');
  });

  it('builds an SSE connecting + reconnect entry', () => {
    expect(buildSseConnectingEntry('http://h/s').message).toContain('http://h/s');
    const r = buildSseReconnectEntry({ attempt: 1, retryMs: 3000 });
    expect(r.message).toBe('Reconnecting in 3000ms (attempt 1)');
  });

  it('builds SSE closed and error lifecycle entries', () => {
    expect(buildSseClosedEntry()).toMatchObject({
      level: 'info',
      category: 'lifecycle',
      message: 'Stream closed',
    });
    expect(buildSseErrorEntry('upstream reset').message).toBe('Stream error: upstream reset');
    expect(buildSseErrorEntry().message).toBe('Stream error');
  });
});

describe('appendCapped', () => {
  const e = (id: string): WsConsoleEntry => ({
    id,
    level: 'info',
    direction: 'info',
    category: 'system',
    message: id,
    timestamp: new Date().toISOString(),
  });

  it('appends within the cap', () => {
    const r = appendCapped([e('a')], e('b'), 10);
    expect(r.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('drops oldest beyond the cap', () => {
    const r = appendCapped([e('a'), e('b')], e('c'), 2);
    expect(r.map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('does not cap when maxEntries <= 0', () => {
    const r = appendCapped([e('a'), e('b')], e('c'), 0);
    expect(r).toHaveLength(3);
  });
});

describe('filterConsoleEntries', () => {
  const entries: WsConsoleEntry[] = [
    { id: '1', level: 'info', direction: 'info', category: 'lifecycle', message: 'Connecting', timestamp: '' },
    { id: '2', level: 'warn', direction: 'info', category: 'reconnect', message: 'Reconnect attempt 1/5', timestamp: '' },
    { id: '3', level: 'error', direction: 'info', category: 'lifecycle', message: 'boom', detail: 'ECONNREFUSED', timestamp: '' },
  ];

  it('filters by level', () => {
    const r = filterConsoleEntries(entries, { levelFilter: 'error', categoryFilter: 'all' }, '');
    expect(r.map((x) => x.id)).toEqual(['3']);
  });

  it('filters by category', () => {
    const r = filterConsoleEntries(entries, { levelFilter: 'all', categoryFilter: 'reconnect' }, '');
    expect(r.map((x) => x.id)).toEqual(['2']);
  });

  it('searches message and detail (case-insensitive)', () => {
    expect(
      filterConsoleEntries(entries, { levelFilter: 'all', categoryFilter: 'all' }, 'econnrefused').map((x) => x.id),
    ).toEqual(['3']);
    expect(
      filterConsoleEntries(entries, { levelFilter: 'all', categoryFilter: 'all' }, 'connect').map((x) => x.id),
    ).toEqual(['1', '2']);
  });

  it('returns all when no filters set', () => {
    expect(filterConsoleEntries(entries, { levelFilter: 'all', categoryFilter: 'all' }, '')).toHaveLength(3);
  });
});

describe('parseRawConsoleLines', () => {
  it('expands a primary line + parsed detail lines with glyphs', () => {
    const entry: WsConsoleEntry = {
      id: '1',
      level: 'info',
      direction: 'info',
      category: 'handshake',
      message: '101 Switching Protocols',
      detail: '> GET / HTTP/1.1\n< HTTP/1.1 101\n* established',
      timestamp: '',
    };
    const lines = parseRawConsoleLines(entry);
    expect(lines[0]).toEqual({ glyph: '*', text: '101 Switching Protocols', kind: 'info' });
    expect(lines[1]).toEqual({ glyph: '>', text: 'GET / HTTP/1.1', kind: 'out' });
    expect(lines[2]).toEqual({ glyph: '<', text: 'HTTP/1.1 101', kind: 'in' });
    expect(lines[3]).toEqual({ glyph: '*', text: 'established', kind: 'info' });
  });

  it('uses the direction glyph for the primary line', () => {
    const entry: WsConsoleEntry = {
      id: '1', level: 'info', direction: 'in', category: 'lifecycle', message: 'Connected', timestamp: '',
    };
    expect(parseRawConsoleLines(entry)[0]).toEqual({ glyph: '<', text: 'Connected', kind: 'in' });
  });

  it('classifies unprefixed detail lines as plain', () => {
    const entry: WsConsoleEntry = {
      id: '1', level: 'info', direction: 'info', category: 'system', message: 'm', detail: 'raw text', timestamp: '',
    };
    expect(parseRawConsoleLines(entry)[1]).toEqual({ glyph: '', text: 'raw text', kind: 'plain' });
  });

  it('classifies command-echo detail lines with the $ glyph', () => {
    const entry: WsConsoleEntry = {
      id: '1',
      level: 'info',
      direction: 'command',
      category: 'command',
      message: '/ping',
      detail: '$ /ping',
      timestamp: '',
    };
    expect(parseRawConsoleLines(entry)[1]).toEqual({ glyph: '$', text: '/ping', kind: 'cmd' });
  });
});

describe('formatConsoleTime', () => {
  it('formats as HH:MM:SS.mmm', () => {
    const d = new Date(2024, 0, 1, 9, 8, 7, 6);
    expect(formatConsoleTime(d.toISOString())).toBe('09:08:07.006');
  });

  it('returns empty string for invalid input', () => {
    expect(formatConsoleTime('nope')).toBe('');
  });
});

describe('consoleEntriesToText', () => {
  it('renders entries with detail blocks', () => {
    const entries: WsConsoleEntry[] = [
      { id: '1', level: 'warn', direction: 'info', category: 'reconnect', message: 'retry', timestamp: new Date(2024, 0, 1, 1, 2, 3).toISOString() },
      { id: '2', level: 'info', direction: 'info', category: 'handshake', message: '101', detail: '> GET /', timestamp: new Date(2024, 0, 1, 1, 2, 4).toISOString() },
    ];
    const text = consoleEntriesToText(entries);
    expect(text).toContain('[WARN] reconnect: retry');
    expect(text).toContain('[INFO] handshake: 101');
    expect(text).toContain('> GET /');
  });
});
