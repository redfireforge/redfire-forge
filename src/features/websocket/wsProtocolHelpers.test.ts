import { describe, it, expect } from 'vitest';
import { createFrame, type WsFrame } from '@shared/websocket/types';
import {
  buildSioMeta,
  buildStompMeta,
  buildGqlWsMeta,
  checkAutoRespond,
  annotateSentFrame,
  buildGqlWsInitAction,
  applyFilters,
} from './wsProtocolHelpers';

// ── buildSioMeta ──────────────────────────────────────────────────────────────

describe('buildSioMeta', () => {
  it('decodes a socket.io EVENT packet', () => {
    const meta = buildSioMeta('42["chat","hello"]');
    expect(meta.protocol).toBe('socket-io');
    expect(meta.eventName).toBe('chat');
    expect(meta.isSystemPacket).toBe(false);
  });

  it('marks PING as system packet', () => {
    const meta = buildSioMeta('2');
    expect(meta.protocol).toBe('socket-io');
    expect(meta.isSystemPacket).toBe(true);
  });

  it('marks OPEN as system packet', () => {
    const meta = buildSioMeta('0{"sid":"abc"}');
    expect(meta.protocol).toBe('socket-io');
    expect(meta.isSystemPacket).toBe(true);
  });
});

// ── buildStompMeta ────────────────────────────────────────────────────────────

describe('buildStompMeta', () => {
  it('builds meta for CONNECTED frame', () => {
    const meta = buildStompMeta('CONNECTED\nversion:1.2\n\n\0');
    expect(meta.protocol).toBe('stomp');
    expect(meta.packetType).toBe('CONNECTED');
    expect(meta.isSystemPacket).toBe(true);
  });

  it('builds meta for heartbeat', () => {
    const meta = buildStompMeta('\n');
    expect(meta.protocol).toBe('stomp');
    expect(meta.packetType).toBe('HEARTBEAT');
    expect(meta.summary).toBe('♥');
    expect(meta.isSystemPacket).toBe(true);
  });

  it('builds meta for MESSAGE frame with destination', () => {
    const meta = buildStompMeta('MESSAGE\ndestination:/topic/foo\n\nhello\0');
    expect(meta.protocol).toBe('stomp');
    expect(meta.packetType).toBe('MESSAGE');
    expect(meta.namespace).toBe('/topic/foo');
    expect(meta.isSystemPacket).toBe(false);
  });
});

// ── buildGqlWsMeta ────────────────────────────────────────────────────────────

describe('buildGqlWsMeta', () => {
  it('builds meta for connection_ack', () => {
    const meta = buildGqlWsMeta(JSON.stringify({ type: 'connection_ack' }));
    expect(meta.protocol).toBe('graphql-ws');
    expect(meta.packetType).toBe('connection_ack');
    expect(meta.isSystemPacket).toBe(true);
  });

  it('marks data messages as non-system', () => {
    const meta = buildGqlWsMeta(JSON.stringify({ type: 'next', id: '1', payload: {} }));
    expect(meta.protocol).toBe('graphql-ws');
    expect(meta.isSystemPacket).toBe(false);
    expect(meta.eventName).toBe('1');
  });
});

// ── checkAutoRespond ──────────────────────────────────────────────────────────

describe('checkAutoRespond', () => {
  it('responds to socket.io PING with PONG', () => {
    const frame = createFrame('received', 'text', '2');
    const action = checkAutoRespond(frame, '2', 'socket-io', null);
    expect(action).toBeDefined();
    expect(action!.replyData).toBe('3');
    expect(action!.replyFrame.direction).toBe('sent');
    expect(frame.protocolMeta?.protocol).toBe('socket-io');
  });

  it('responds to socket.io OPEN with CONNECT', () => {
    const frame = createFrame('received', 'text', '0{"sid":"x"}');
    const action = checkAutoRespond(frame, '0{"sid":"x"}', 'socket-io', null);
    expect(action).toBeDefined();
    expect(action!.replyData).toBe('40');
    expect(action!.replyFrame.protocolMeta?.protocol).toBe('socket-io');
  });

  it('returns undefined for non-ping socket.io messages', () => {
    const frame = createFrame('received', 'text', '42["chat","hi"]');
    const action = checkAutoRespond(frame, '42["chat","hi"]', 'socket-io', null);
    expect(action).toBeUndefined();
    expect(frame.protocolMeta?.protocol).toBe('socket-io');
  });

  it('responds to STOMP heartbeat', () => {
    const frame = createFrame('received', 'text', '\n');
    const action = checkAutoRespond(frame, '\n', 'stomp', null);
    expect(action).toBeDefined();
    expect(action!.replyFrame.protocolMeta?.protocol).toBe('stomp');
  });

  it('returns undefined for non-heartbeat STOMP messages', () => {
    const frame = createFrame('received', 'text', 'MESSAGE\n\nhello\0');
    const action = checkAutoRespond(frame, 'MESSAGE\n\nhello\0', 'stomp', null);
    expect(action).toBeUndefined();
  });

  it('responds to graphql-ws ping', () => {
    const pingStr = JSON.stringify({ type: 'ping' });
    const frame = createFrame('received', 'text', pingStr);
    const action = checkAutoRespond(frame, pingStr, 'graphql-ws', null);
    expect(action).toBeDefined();
    expect(JSON.parse(action!.replyData).type).toBe('pong');
  });

  it('returns undefined for non-ping graphql-ws messages', () => {
    const dataStr = JSON.stringify({ type: 'next', id: '1', payload: {} });
    const frame = createFrame('received', 'text', dataStr);
    const action = checkAutoRespond(frame, dataStr, 'graphql-ws', null);
    expect(action).toBeUndefined();
  });

  it('returns undefined for raw protocol', () => {
    const frame = createFrame('received', 'text', 'hello');
    const action = checkAutoRespond(frame, 'hello', 'raw', null);
    expect(action).toBeUndefined();
  });

  it('uses auto-detected protocol from detectedProtocol', () => {
    const frame = createFrame('received', 'text', '2');
    const action = checkAutoRespond(frame, '2', 'auto', { protocol: 'socket-io', confidence: 'high', reason: 'URL path contains /socket.io/' });
    expect(action).toBeDefined();
    expect(action!.replyData).toBe('3');
  });
});

// ── annotateSentFrame ─────────────────────────────────────────────────────────

describe('annotateSentFrame', () => {
  it('annotates socket.io sent frame', () => {
    const frame = createFrame('sent', 'text', '42["msg","hi"]');
    annotateSentFrame(frame, '42["msg","hi"]', false, 'socket-io', null);
    expect(frame.protocolMeta?.protocol).toBe('socket-io');
  });

  it('annotates stomp sent frame', () => {
    const frame = createFrame('sent', 'text', 'SEND\ndestination:/queue/a\n\nhello\0');
    annotateSentFrame(frame, 'SEND\ndestination:/queue/a\n\nhello\0', false, 'stomp', null);
    expect(frame.protocolMeta?.protocol).toBe('stomp');
  });

  it('annotates graphql-ws sent frame', () => {
    const data = JSON.stringify({ type: 'subscribe', id: '1', payload: { query: '{ foo }' } });
    const frame = createFrame('sent', 'text', data);
    annotateSentFrame(frame, data, false, 'graphql-ws', null);
    expect(frame.protocolMeta?.protocol).toBe('graphql-ws');
  });

  it('skips annotation for binary frames', () => {
    const frame = createFrame('sent', 'binary', 'binary-data');
    annotateSentFrame(frame, 'binary-data', true, 'socket-io', null);
    expect(frame.protocolMeta).toBeUndefined();
  });

  it('does nothing for raw protocol', () => {
    const frame = createFrame('sent', 'text', 'hello');
    annotateSentFrame(frame, 'hello', false, 'raw', null);
    expect(frame.protocolMeta).toBeUndefined();
  });
});

// ── buildGqlWsInitAction ──────────────────────────────────────────────────────

describe('buildGqlWsInitAction', () => {
  it('creates a connection_init frame', () => {
    const action = buildGqlWsInitAction();
    const parsed = JSON.parse(action.replyData);
    expect(parsed.type).toBe('connection_init');
    expect(action.replyFrame.direction).toBe('sent');
    expect(action.replyFrame.protocolMeta?.protocol).toBe('graphql-ws');
  });
});

// ── applyFilters ──────────────────────────────────────────────────────────────

describe('applyFilters', () => {
  const defaultOpts = {
    searchText: '',
    searchMode: 'text' as const,
    directionFilter: 'all' as const,
    sizeFilter: 'all' as const,
    timeFilter: 'all' as const,
    contentTypeFilter: 'all' as const,
    nowMs: Date.now(),
  };
  const filter = (msgs: WsFrame[], overrides: Partial<typeof defaultOpts> & { bookmarkedMessages?: WsFrame[] } = {}) =>
    applyFilters(msgs, { ...defaultOpts, ...overrides });

  const messages = [
    { ...createFrame('sent', 'text', 'hello world'), protocolMeta: undefined },
    { ...createFrame('received', 'text', 'goodbye'), protocolMeta: undefined },
    { ...createFrame('sent', 'text', 'test'), protocolMeta: { protocol: 'raw' as const, packetType: '', summary: 'Test Summary' } },
  ];

  it('returns all when no filters active', () => {
    expect(filter(messages)).toHaveLength(3);
  });

  it('filters by direction — sent', () => {
    expect(filter(messages, { directionFilter: 'sent' })).toHaveLength(2);
  });

  it('filters by direction — received', () => {
    expect(filter(messages, { directionFilter: 'received' })).toHaveLength(1);
  });

  it('filters by search text in data', () => {
    expect(filter(messages, { searchText: 'hello' })).toHaveLength(1);
  });

  it('filters by search text in protocolMeta.summary', () => {
    expect(filter(messages, { searchText: 'summary' })).toHaveLength(1);
  });

  it('combines direction and search filters', () => {
    expect(filter(messages, { searchText: 'hello', directionFilter: 'sent' })).toHaveLength(1);
    expect(filter(messages, { searchText: 'hello', directionFilter: 'received' })).toHaveLength(0);
  });

  it('search is case-insensitive', () => {
    expect(filter(messages, { searchText: 'HELLO' })).toHaveLength(1);
  });

  it('ignores whitespace-only search text', () => {
    expect(filter(messages, { searchText: '   ' })).toHaveLength(3);
  });

  it('returns bookmarkedMessages when direction is bookmarked', () => {
    const bookmarks = [messages[1]];
    const result = filter(messages, { directionFilter: 'bookmarked', bookmarkedMessages: bookmarks });
    expect(result).toHaveLength(1);
    expect(result[0].data).toBe('goodbye');
  });

  it('returns empty array when direction is bookmarked and no bookmarks provided', () => {
    expect(filter(messages, { directionFilter: 'bookmarked' })).toHaveLength(0);
  });

  it('applies search to bookmarked messages', () => {
    const bookmarks = [messages[0], messages[1]];
    expect(filter(messages, { searchText: 'hello', directionFilter: 'bookmarked', bookmarkedMessages: bookmarks })).toHaveLength(1);
  });

  // ── Phase 14: Regex search ──────────────────────────────────────────────────

  it('regex search matches pattern', () => {
    expect(filter(messages, { searchText: 'hel+o', searchMode: 'regex' })).toHaveLength(1);
  });

  it('regex search is case-insensitive', () => {
    expect(filter(messages, { searchText: 'HELLO', searchMode: 'regex' })).toHaveLength(1);
  });

  it('invalid regex returns unfiltered by search', () => {
    expect(filter(messages, { searchText: '[invalid', searchMode: 'regex' })).toHaveLength(3);
  });

  it('regex matches protocolMeta.summary', () => {
    expect(filter(messages, { searchText: 'test.*sum', searchMode: 'regex' })).toHaveLength(1);
  });

  // ── Phase 14: JSONPath search ───────────────────────────────────────────────

  it('jsonpath existence check — matches messages with path', () => {
    const jsonMsgs = [
      { ...createFrame('sent', 'text', '{"type":"error","code":500}'), protocolMeta: undefined },
      { ...createFrame('received', 'text', '{"type":"ok"}'), protocolMeta: undefined },
      { ...createFrame('sent', 'text', 'not json'), protocolMeta: undefined },
    ];
    expect(filter(jsonMsgs, { searchText: '$.type', searchMode: 'jsonpath' })).toHaveLength(2);
  });

  it('jsonpath value match — $.type=error', () => {
    const jsonMsgs = [
      { ...createFrame('sent', 'text', '{"type":"error","code":500}'), protocolMeta: undefined },
      { ...createFrame('received', 'text', '{"type":"ok"}'), protocolMeta: undefined },
    ];
    expect(filter(jsonMsgs, { searchText: '$.type=error', searchMode: 'jsonpath' })).toHaveLength(1);
    expect(filter(jsonMsgs, { searchText: '$.type=Error', searchMode: 'jsonpath' })).toHaveLength(1);
  });

  it('jsonpath excludes non-JSON messages', () => {
    const mixedMsgs = [
      { ...createFrame('sent', 'text', '{"name":"test"}'), protocolMeta: undefined },
      { ...createFrame('sent', 'text', 'plain text'), protocolMeta: undefined },
      { ...createFrame('sent', 'binary', 'AAAA'), protocolMeta: undefined },
    ];
    expect(filter(mixedMsgs, { searchText: '$.name', searchMode: 'jsonpath' })).toHaveLength(1);
  });

  it('jsonpath handles missing path gracefully', () => {
    const jsonMsgs = [
      { ...createFrame('sent', 'text', '{"type":"ok"}'), protocolMeta: undefined },
    ];
    expect(filter(jsonMsgs, { searchText: '$.nonexistent', searchMode: 'jsonpath' })).toHaveLength(0);
  });

  // ── Phase 14: Size filter ───────────────────────────────────────────────────

  it('size filter — lt1k', () => {
    const small = { ...createFrame('sent', 'text', 'hi'), protocolMeta: undefined };
    const big = { ...createFrame('sent', 'text', 'x'.repeat(2000)), protocolMeta: undefined };
    expect(filter([small, big], { sizeFilter: 'lt1k' })).toHaveLength(1);
  });

  it('size filter — 1k-10k', () => {
    const small = { ...createFrame('sent', 'text', 'hi'), protocolMeta: undefined };
    const mid = { ...createFrame('sent', 'text', 'x'.repeat(5000)), protocolMeta: undefined };
    const huge = { ...createFrame('sent', 'text', 'x'.repeat(11000)), protocolMeta: undefined };
    expect(filter([small, mid, huge], { sizeFilter: '1k-10k' })).toHaveLength(1);
    expect(filter([small, mid, huge], { sizeFilter: '1k-10k' })[0]).toBe(mid);
  });

  it('size filter — gt10k', () => {
    const small = { ...createFrame('sent', 'text', 'hi'), protocolMeta: undefined };
    const huge = { ...createFrame('sent', 'text', 'x'.repeat(11000)), protocolMeta: undefined };
    expect(filter([small, huge], { sizeFilter: 'gt10k' })).toHaveLength(1);
    expect(filter([small, huge], { sizeFilter: 'gt10k' })[0].data.length).toBeGreaterThan(10000);
  });

  // ── Phase 14: Time filter ───────────────────────────────────────────────────

  it('time filter — last30s', () => {
    const now = Date.now();
    const recent = { ...createFrame('sent', 'text', 'recent'), protocolMeta: undefined };
    recent.timestamp = new Date(now - 10_000).toISOString();
    const old = { ...createFrame('sent', 'text', 'old'), protocolMeta: undefined };
    old.timestamp = new Date(now - 60_000).toISOString();
    expect(filter([recent, old], { timeFilter: 'last30s', nowMs: now })).toHaveLength(1);
    expect(filter([recent, old], { timeFilter: 'last30s', nowMs: now })[0].data).toBe('recent');
  });

  it('time filter — last5m', () => {
    const now = Date.now();
    const recent = { ...createFrame('sent', 'text', 'recent'), protocolMeta: undefined };
    recent.timestamp = new Date(now - 60_000).toISOString();
    const old = { ...createFrame('sent', 'text', 'old'), protocolMeta: undefined };
    old.timestamp = new Date(now - 600_000).toISOString();
    expect(filter([recent, old], { timeFilter: 'last5m', nowMs: now })).toHaveLength(1);
    expect(filter([recent, old], { timeFilter: 'last5m', nowMs: now })[0].data).toBe('recent');
  });

  it('time filter — last30m', () => {
    const now = Date.now();
    const recent = { ...createFrame('sent', 'text', 'recent'), protocolMeta: undefined };
    recent.timestamp = new Date(now - 600_000).toISOString();
    const old = { ...createFrame('sent', 'text', 'old'), protocolMeta: undefined };
    old.timestamp = new Date(now - 3_600_000).toISOString();
    expect(filter([recent, old], { timeFilter: 'last30m', nowMs: now })).toHaveLength(1);
    expect(filter([recent, old], { timeFilter: 'last30m', nowMs: now })[0].data).toBe('recent');
  });

  // ── Phase 14: Content type filter ───────────────────────────────────────────

  it('content type filter — json', () => {
    const jsonMsg = { ...createFrame('sent', 'text', '{"key":"val"}'), protocolMeta: undefined };
    const textMsg = { ...createFrame('sent', 'text', 'hello'), protocolMeta: undefined };
    expect(filter([jsonMsg, textMsg], { contentTypeFilter: 'json' })).toHaveLength(1);
  });

  it('content type filter — text (non-JSON only)', () => {
    const jsonMsg = { ...createFrame('sent', 'text', '{"key":"val"}'), protocolMeta: undefined };
    const textMsg = { ...createFrame('sent', 'text', 'hello'), protocolMeta: undefined };
    const binMsg = { ...createFrame('sent', 'binary', 'AAAA'), protocolMeta: undefined };
    expect(filter([jsonMsg, textMsg, binMsg], { contentTypeFilter: 'text' })).toHaveLength(1);
    expect(filter([jsonMsg, textMsg, binMsg], { contentTypeFilter: 'text' })[0].data).toBe('hello');
  });

  it('content type filter — control', () => {
    const textMsg = { ...createFrame('sent', 'text', 'hello'), protocolMeta: undefined };
    const pingMsg = { ...createFrame('sent', 'ping', ''), protocolMeta: undefined };
    expect(filter([textMsg, pingMsg], { contentTypeFilter: 'control' })).toHaveLength(1);
  });

  it('content type filter — binary', () => {
    const textMsg = { ...createFrame('sent', 'text', 'hello'), protocolMeta: undefined };
    const binMsg = { ...createFrame('sent', 'binary', 'AAAA'), protocolMeta: undefined };
    expect(filter([textMsg, binMsg], { contentTypeFilter: 'binary' })).toHaveLength(1);
  });

  it('content type filter — text excludes system packets', () => {
    const textMsg = { ...createFrame('sent', 'text', 'hello'), protocolMeta: undefined };
    const sioPing: WsFrame = {
      ...createFrame('sent', 'text', '2'),
      protocolMeta: { protocol: 'socket-io', packetType: 'PING', summary: 'PING', isSystemPacket: true },
    };
    expect(filter([textMsg, sioPing], { contentTypeFilter: 'text' })).toHaveLength(1);
    expect(filter([textMsg, sioPing], { contentTypeFilter: 'control' })).toHaveLength(1);
    expect(filter([textMsg, sioPing], { contentTypeFilter: 'control' })[0].data).toBe('2');
  });

  it('content type filter — control detects legacy isSystem frames', () => {
    const sysFrame = { ...createFrame('received', 'text', 'Connected to ws://localhost'), protocolMeta: undefined } as WsFrame & { isSystem?: boolean };
    sysFrame.isSystem = true;
    const textMsg = { ...createFrame('sent', 'text', 'hello'), protocolMeta: undefined };
    expect(filter([sysFrame as WsFrame, textMsg], { contentTypeFilter: 'text' })).toHaveLength(1);
    expect(filter([sysFrame as WsFrame, textMsg], { contentTypeFilter: 'text' })[0].data).toBe('hello');
    expect(filter([sysFrame as WsFrame, textMsg], { contentTypeFilter: 'control' })).toHaveLength(1);
    expect(filter([sysFrame as WsFrame, textMsg], { contentTypeFilter: 'control' })[0].data).toContain('Connected');
  });

  it('regex search also matches namespace', () => {
    const msg: WsFrame = {
      ...createFrame('sent', 'text', 'data'),
      protocolMeta: { protocol: 'socket-io', packetType: 'EVENT', summary: 'EVENT: test', namespace: '/admin' },
    };
    expect(filter([msg], { searchText: 'admin', searchMode: 'regex' })).toHaveLength(1);
    expect(filter([msg], { searchText: 'xyz', searchMode: 'regex' })).toHaveLength(0);
  });

  // ── Phase 14: Performance ────────────────────────────────────────────────────

  it('filters 10,000 messages in under 100ms (text search)', () => {
    const largeMsgs: WsFrame[] = Array.from({ length: 10_000 }, (_, i) => ({
      ...createFrame(i % 2 === 0 ? 'sent' : 'received', 'text', `message-${i}-data-${i % 100 === 0 ? 'special' : 'normal'}`),
      protocolMeta: undefined,
    }));
    const start = performance.now();
    const result = filter(largeMsgs, { searchText: 'special' });
    const elapsed = performance.now() - start;
    expect(result.length).toBe(100);
    expect(elapsed).toBeLessThan(100);
  });

  it('filters 10,000 messages in under 100ms (jsonpath)', () => {
    const largeMsgs: WsFrame[] = Array.from({ length: 10_000 }, (_, i) => ({
      ...createFrame('sent', 'text', JSON.stringify({ idx: i, type: i % 50 === 0 ? 'error' : 'ok' })),
      protocolMeta: undefined,
    }));
    const start = performance.now();
    const result = filter(largeMsgs, { searchText: '$.type=error', searchMode: 'jsonpath' });
    const elapsed = performance.now() - start;
    expect(result.length).toBe(200);
    expect(elapsed).toBeLessThan(100);
  });

  // ── Phase 14: Composed filters ──────────────────────────────────────────────

  it('composes direction + content type + search', () => {
    const msgs = [
      { ...createFrame('sent', 'text', '{"type":"error"}'), protocolMeta: undefined },
      { ...createFrame('received', 'text', '{"type":"error"}'), protocolMeta: undefined },
      { ...createFrame('sent', 'text', 'plain'), protocolMeta: undefined },
    ];
    const result = filter(msgs, { directionFilter: 'sent', contentTypeFilter: 'json', searchText: 'error' });
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('sent');
  });
});
