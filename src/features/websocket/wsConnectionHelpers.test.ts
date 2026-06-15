import { describe, it, expect, vi } from 'vitest';
import {
  parseSubprotocolList,
  encodeWsMessageData,
  createSystemConnectFrame,
  runEarlyProtocolDetection,
  buildConnectHeadersMap,
} from './wsConnectionHelpers';

describe('wsConnectionHelpers', () => {
  // ── parseSubprotocolList ──────────────────────────────────────────
  describe('parseSubprotocolList', () => {
    it('parses comma-separated values', () => {
      expect(parseSubprotocolList('graphql-ws, graphql-transport-ws')).toEqual([
        'graphql-ws',
        'graphql-transport-ws',
      ]);
    });

    it('trims whitespace', () => {
      expect(parseSubprotocolList('  foo , bar  ')).toEqual(['foo', 'bar']);
    });

    it('filters out empty strings', () => {
      expect(parseSubprotocolList(',foo,,bar,')).toEqual(['foo', 'bar']);
    });

    it('returns empty array for empty string', () => {
      expect(parseSubprotocolList('')).toEqual([]);
    });

    it('returns empty array for whitespace-only string', () => {
      expect(parseSubprotocolList('  ,  ,  ')).toEqual([]);
    });

    it('handles single protocol', () => {
      expect(parseSubprotocolList('mqtt')).toEqual(['mqtt']);
    });
  });

  // ── encodeWsMessageData ───────────────────────────────────────────
  describe('encodeWsMessageData', () => {
    it('passes strings through', () => {
      const result = encodeWsMessageData('hello world');
      expect(result).toEqual({ data: 'hello world', isBinary: false });
    });

    it('encodes ArrayBuffer to base64', () => {
      const buf = new ArrayBuffer(3);
      const view = new Uint8Array(buf);
      view[0] = 72; // H
      view[1] = 105; // i
      view[2] = 33; // !
      const result = encodeWsMessageData(buf);
      expect(result.isBinary).toBe(true);
      expect(result.data).toBe(btoa('Hi!'));
    });

    it('encodes empty ArrayBuffer', () => {
      const buf = new ArrayBuffer(0);
      const result = encodeWsMessageData(buf);
      expect(result.isBinary).toBe(true);
      expect(result.data).toBe('');
    });

    it('stringifies non-string non-ArrayBuffer data', () => {
      const result = encodeWsMessageData(42);
      expect(result).toEqual({ data: '42', isBinary: false });
    });

    it('stringifies null', () => {
      const result = encodeWsMessageData(null);
      expect(result).toEqual({ data: 'null', isBinary: false });
    });

    it('stringifies undefined', () => {
      const result = encodeWsMessageData(undefined);
      expect(result).toEqual({ data: 'undefined', isBinary: false });
    });
  });

  // ── createSystemConnectFrame ──────────────────────────────────────
  describe('createSystemConnectFrame', () => {
    it('creates frame with protocol', () => {
      const frame = createSystemConnectFrame('wss://example.com', 'graphql-ws');
      expect(frame.data).toBe('Connected to wss://example.com (protocol: graphql-ws)');
      expect(frame.direction).toBe('received');
      expect(frame.type).toBe('text');
      expect((frame as Record<string, unknown>).isSystem).toBe(true);
    });

    it('shows "none" when protocol is undefined', () => {
      const frame = createSystemConnectFrame('ws://localhost', undefined);
      expect(frame.data).toContain('protocol: none');
    });

    it('shows "none" when protocol is empty string', () => {
      const frame = createSystemConnectFrame('ws://localhost', '');
      expect(frame.data).toContain('protocol: none');
    });

    it('has a timestamp', () => {
      const frame = createSystemConnectFrame('ws://test', 'mqtt');
      expect(frame.timestamp).toBeDefined();
    });
  });

  // ── runEarlyProtocolDetection ─────────────────────────────────────
  describe('runEarlyProtocolDetection', () => {
    it('returns null when mode is not auto', () => {
      expect(runEarlyProtocolDetection('graphql-ws', 'wss://example.com', [])).toBeNull();
      expect(runEarlyProtocolDetection('stomp', 'wss://example.com', [])).toBeNull();
    });

    it('returns null for plain websocket URL with no subprotocols', () => {
      const result = runEarlyProtocolDetection('auto', 'ws://localhost:8080', []);
      expect(result).toBeNull();
    });

    it('detects graphql-ws from subprotocol', () => {
      const result = runEarlyProtocolDetection('auto', 'ws://localhost/graphql', ['graphql-ws']);
      expect(result).not.toBeNull();
      expect(result!.protocol).toBe('graphql-ws');
    });

    it('detects stomp from subprotocol', () => {
      const result = runEarlyProtocolDetection('auto', 'ws://localhost/ws', ['stomp']);
      expect(result).not.toBeNull();
      expect(result!.protocol).toBe('stomp');
    });
  });

  // ── buildConnectHeadersMap ────────────────────────────────────────
  describe('buildConnectHeadersMap', () => {
    const identity = (val: string) => val;

    it('builds map from enabled headers', () => {
      const headers = [
        { enabled: true, key: 'Authorization', value: 'Bearer token' },
        { enabled: false, key: 'X-Disabled', value: 'skip' },
        { enabled: true, key: 'X-Custom', value: 'value' },
      ];
      const result = buildConnectHeadersMap(headers, {}, [], identity);
      expect(result).toEqual({
        'Authorization': 'Bearer token',
        'X-Custom': 'value',
      });
    });

    it('skips headers with empty keys', () => {
      const headers = [
        { enabled: true, key: '  ', value: 'no-key' },
        { enabled: true, key: 'Valid', value: 'ok' },
      ];
      const result = buildConnectHeadersMap(headers, {}, [], identity);
      expect(result).toEqual({ 'Valid': 'ok' });
    });

    it('auth headers override manual headers', () => {
      const headers = [
        { enabled: true, key: 'Authorization', value: 'manual-token' },
      ];
      const auth = [{ key: 'Authorization', value: 'auth-token' }];
      const result = buildConnectHeadersMap(headers, {}, auth, identity);
      expect(result['Authorization']).toBe('auth-token');
    });

    it('applies env var resolution', () => {
      const mockResolve = vi.fn((val: string, _map: Record<string, string>) =>
        val.replace('{{HOST}}', 'example.com'),
      );
      const headers = [
        { enabled: true, key: 'Host', value: '{{HOST}}' },
      ];
      const result = buildConnectHeadersMap(headers, { HOST: 'example.com' }, [], mockResolve);
      expect(result['Host']).toBe('example.com');
      expect(mockResolve).toHaveBeenCalled();
    });

    it('returns empty map for empty inputs', () => {
      const result = buildConnectHeadersMap([], {}, [], identity);
      expect(result).toEqual({});
    });

    it('trims header keys', () => {
      const headers = [
        { enabled: true, key: '  Content-Type  ', value: 'application/json' },
      ];
      const result = buildConnectHeadersMap(headers, {}, [], identity);
      expect(result['Content-Type']).toBe('application/json');
    });
  });
});
