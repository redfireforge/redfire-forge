import { describe, it, expect } from 'vitest';
import {
  detectFromUrl,
  detectFromSubprotocols,
  detectFromMessage,
  detectProtocol,
  resolveEffectiveProtocol,
} from './protocolDetector';

describe('detectFromUrl', () => {
  it('detects socket.io from /socket.io/ path', () => {
    const r = detectFromUrl('wss://example.com/socket.io/?EIO=4&transport=websocket');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('socket-io');
    expect(r!.confidence).toBe('high');
  });

  it('detects socket.io from EIO query param alone', () => {
    const r = detectFromUrl('ws://localhost:3000?EIO=4&transport=websocket');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('socket-io');
  });

  it('detects graphql-ws from /graphql path', () => {
    const r = detectFromUrl('wss://api.example.com/graphql');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('graphql-ws');
    expect(r!.confidence).toBe('medium');
  });

  it('detects graphql-ws from /graphql/ path with trailing content', () => {
    const r = detectFromUrl('wss://api.example.com/graphql/subscriptions');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('graphql-ws');
  });

  it('detects stomp from /stomp path', () => {
    const r = detectFromUrl('ws://broker.example.com/stomp');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('stomp');
    expect(r!.confidence).toBe('medium');
  });

  it('returns null for generic WebSocket URL', () => {
    expect(detectFromUrl('ws://localhost:8765')).toBeNull();
    expect(detectFromUrl('wss://echo.websocket.org')).toBeNull();
  });

  it('is case-insensitive', () => {
    const r = detectFromUrl('wss://example.com/Socket.IO/?eio=4');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('socket-io');
  });
});

describe('detectFromSubprotocols', () => {
  it('detects graphql-ws subprotocol', () => {
    const r = detectFromSubprotocols(['graphql-ws']);
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('graphql-ws');
    expect(r!.confidence).toBe('high');
  });

  it('detects graphql-transport-ws subprotocol', () => {
    const r = detectFromSubprotocols(['graphql-transport-ws']);
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('graphql-ws');
  });

  it('detects stomp subprotocol', () => {
    const r = detectFromSubprotocols(['stomp']);
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('stomp');
    expect(r!.confidence).toBe('high');
  });

  it('detects v12.stomp subprotocol', () => {
    const r = detectFromSubprotocols(['v12.stomp']);
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('stomp');
  });

  it('detects v11.stomp subprotocol', () => {
    const r = detectFromSubprotocols(['v11.stomp']);
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('stomp');
  });

  it('returns null for unknown subprotocols', () => {
    expect(detectFromSubprotocols(['json', 'custom-proto'])).toBeNull();
    expect(detectFromSubprotocols([])).toBeNull();
  });

  it('is case-insensitive', () => {
    const r = detectFromSubprotocols(['GraphQL-WS']);
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('graphql-ws');
  });

  it('handles whitespace in subprotocol names', () => {
    const r = detectFromSubprotocols([' graphql-ws ']);
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('graphql-ws');
  });
});

describe('detectFromMessage', () => {
  it('detects socket.io open packet', () => {
    const r = detectFromMessage('0{"sid":"abc123","upgrades":[],"pingInterval":25000}');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('socket-io');
    expect(r!.confidence).toBe('high');
  });

  it('detects socket.io with bare 0{ prefix', () => {
    const r = detectFromMessage('0{foo}');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('socket-io');
  });

  it('detects STOMP CONNECTED frame', () => {
    const r = detectFromMessage('CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('stomp');
    expect(r!.confidence).toBe('high');
  });

  it('detects STOMP CONNECTED with CRLF', () => {
    const r = detectFromMessage('CONNECTED\r\nversion:1.2\r\n\r\n\0');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('stomp');
  });

  it('detects graphql-ws connection_ack', () => {
    const r = detectFromMessage('{"type":"connection_ack"}');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('graphql-ws');
    expect(r!.confidence).toBe('high');
  });

  it('detects graphql-ws connection_ack with payload', () => {
    const r = detectFromMessage('{"type":"connection_ack","payload":{}}');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('graphql-ws');
  });

  it('detects socket.io event packet (digit + array)', () => {
    const r = detectFromMessage('2["chat message","hello"]');
    expect(r).not.toBeNull();
    expect(r!.protocol).toBe('socket-io');
    expect(r!.confidence).toBe('medium');
  });

  it('returns null for plain text message', () => {
    expect(detectFromMessage('hello world')).toBeNull();
  });

  it('returns null for generic JSON', () => {
    expect(detectFromMessage('{"foo":"bar"}')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectFromMessage('')).toBeNull();
  });
});

describe('detectProtocol', () => {
  it('prioritizes subprotocol over URL', () => {
    const r = detectProtocol('wss://example.com/graphql', ['stomp']);
    expect(r.protocol).toBe('stomp');
    expect(r.confidence).toBe('high');
  });

  it('uses URL when no subprotocol match', () => {
    const r = detectProtocol('wss://example.com/socket.io/?EIO=4', []);
    expect(r.protocol).toBe('socket-io');
  });

  it('uses message when no URL or subprotocol match', () => {
    const r = detectProtocol('ws://localhost:8080', [], '0{"sid":"abc"}');
    expect(r.protocol).toBe('socket-io');
  });

  it('falls back to raw when nothing matches', () => {
    const r = detectProtocol('ws://localhost:8765', [], 'hello');
    expect(r.protocol).toBe('raw');
    expect(r.confidence).toBe('high');
  });

  it('falls back to raw with no message', () => {
    const r = detectProtocol('ws://localhost:8765', []);
    expect(r.protocol).toBe('raw');
  });
});

describe('resolveEffectiveProtocol', () => {
  it('returns detected protocol when mode is auto', () => {
    const result = resolveEffectiveProtocol('auto', {
      protocol: 'stomp',
      confidence: 'high',
      reason: 'test',
    });
    expect(result).toBe('stomp');
  });

  it('returns raw when mode is auto and no detection', () => {
    expect(resolveEffectiveProtocol('auto', null)).toBe('raw');
  });

  it('returns selected mode when not auto', () => {
    expect(resolveEffectiveProtocol('raw', null)).toBe('raw');
    expect(resolveEffectiveProtocol('stomp', null)).toBe('stomp');
    expect(resolveEffectiveProtocol('graphql-ws', { protocol: 'raw', confidence: 'high', reason: '' })).toBe('graphql-ws');
  });
});
