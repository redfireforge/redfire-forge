import { describe, it, expect } from 'vitest';
import { createFrame } from '../../shared/websocket/types';
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
    const action = checkAutoRespond(frame, '2', 'auto', { protocol: 'socket-io', confidence: 'high', source: 'url' });
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
  const messages = [
    { ...createFrame('sent', 'text', 'hello world'), protocolMeta: undefined },
    { ...createFrame('received', 'text', 'goodbye'), protocolMeta: undefined },
    { ...createFrame('sent', 'text', 'test'), protocolMeta: { protocol: 'raw' as const, packetType: '', summary: 'Test Summary' } },
  ];

  it('returns all when no filters active', () => {
    expect(applyFilters(messages, '', 'all')).toHaveLength(3);
  });

  it('filters by direction — sent', () => {
    expect(applyFilters(messages, '', 'sent')).toHaveLength(2);
  });

  it('filters by direction — received', () => {
    expect(applyFilters(messages, '', 'received')).toHaveLength(1);
  });

  it('filters by search text in data', () => {
    expect(applyFilters(messages, 'hello', 'all')).toHaveLength(1);
  });

  it('filters by search text in protocolMeta.summary', () => {
    expect(applyFilters(messages, 'summary', 'all')).toHaveLength(1);
  });

  it('combines direction and search filters', () => {
    expect(applyFilters(messages, 'hello', 'sent')).toHaveLength(1);
    expect(applyFilters(messages, 'hello', 'received')).toHaveLength(0);
  });

  it('search is case-insensitive', () => {
    expect(applyFilters(messages, 'HELLO', 'all')).toHaveLength(1);
  });

  it('ignores whitespace-only search text', () => {
    expect(applyFilters(messages, '   ', 'all')).toHaveLength(3);
  });
});
