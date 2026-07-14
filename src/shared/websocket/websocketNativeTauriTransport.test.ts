import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WsDispatchRequest, WsEnvelope } from './websocketClient';

const mockInvoke = vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<WsEnvelope>>();
const mockListen = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...(args as [string, Record<string, unknown>?])),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

import {
  wsNativeTauriTransport,
  listenWsMessage,
  listenWsConnectionClosed,
  _resetMessageBuffersForTesting,
} from './websocketNativeTauriTransport';
import { WsClientError } from './websocketClient';

beforeEach(() => {
  resetAllMocks();
  _resetMessageBuffersForTesting();
});

function okEnvelope(op: string, data: unknown): WsEnvelope {
  return {
    ok: true,
    op,
    data,
    meta: { timestamp: new Date().toISOString() },
  };
}

function errorEnvelope(op: string, code: string, message: string): WsEnvelope {
  return {
    ok: false,
    op,
    error: { code, message, retryable: false },
    meta: { timestamp: new Date().toISOString() },
  };
}

function makeRequest(overrides: Partial<WsDispatchRequest>): WsDispatchRequest {
  return {
    op: 'connect',
    method: 'POST',
    path: '/api/ws/connect',
    query: {},
    ...overrides,
  };
}

describe('wsNativeTauriTransport', () => {
  describe('connect', () => {
    it('invokes ws_connect with request param wrapping', async () => {
      const body = { url: 'ws://localhost:8765' };
      mockInvoke.mockResolvedValue(okEnvelope('connect', { connectionId: 'c1' }));

      const result = await wsNativeTauriTransport(
        makeRequest({ op: 'connect', method: 'POST', body }),
      );

      expect(mockInvoke).toHaveBeenCalledWith('ws_connect', { request: body });
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ connectionId: 'c1' });
    });
  });

  describe('disconnect', () => {
    it('invokes ws_disconnect with request param wrapping', async () => {
      const body = { connectionId: 'c1', code: 1000, reason: 'bye' };
      mockInvoke.mockResolvedValue(okEnvelope('disconnect', { connectionId: 'c1', disconnected: true }));

      await wsNativeTauriTransport(
        makeRequest({ op: 'disconnect', method: 'POST', body }),
      );

      expect(mockInvoke).toHaveBeenCalledWith('ws_disconnect', { request: body });
    });
  });

  describe('send', () => {
    it('invokes ws_send with request param wrapping', async () => {
      const body = { connectionId: 'c1', data: 'hello', type: 'text' };
      mockInvoke.mockResolvedValue(okEnvelope('send', { connectionId: 'c1', sentAt: 'x' }));

      await wsNativeTauriTransport(
        makeRequest({ op: 'send', method: 'POST', body }),
      );

      expect(mockInvoke).toHaveBeenCalledWith('ws_send', { request: body });
    });
  });

  describe('ping', () => {
    it('invokes ws_ping with request param wrapping', async () => {
      const body = { connectionId: 'c1' };
      mockInvoke.mockResolvedValue(okEnvelope('ping', { connectionId: 'c1', sentAt: 'x' }));

      await wsNativeTauriTransport(
        makeRequest({ op: 'ping', method: 'POST', body }),
      );

      expect(mockInvoke).toHaveBeenCalledWith('ws_ping', { request: body });
    });
  });

  describe('status (GET)', () => {
    it('invokes ws_status with request-wrapped query types', async () => {
      mockInvoke.mockResolvedValue(okEnvelope('status', { state: 'connected' }));

      await wsNativeTauriTransport(
        makeRequest({
          op: 'status',
          method: 'GET',
          query: { connectionId: 'c1' },
        }),
      );

      expect(mockInvoke).toHaveBeenCalledWith('ws_status', {
        request: { connectionId: 'c1' },
      });
    });
  });

  describe('messages (client-side buffer)', () => {
    it('returns empty buffer when connectionId query param is missing', async () => {
      const result = await wsNativeTauriTransport(
        makeRequest({
          op: 'messages',
          method: 'GET',
          query: {},
        }),
      );

      expect(result.data).toEqual(
        expect.objectContaining({ connectionId: '', messages: [], cursor: 0 }),
      );
    });

    it('returns empty buffer for unknown connection', async () => {
      const result = await wsNativeTauriTransport(
        makeRequest({
          op: 'messages',
          method: 'GET',
          query: { connectionId: 'c1' },
        }),
      );

      expect(mockInvoke).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
      expect(result.op).toBe('messages');
      expect(result.data).toEqual(
        expect.objectContaining({ messages: [], cursor: 0, bufferSize: 0 }),
      );
    });

    it('returns buffered messages after ws-message events fire', async () => {
      // Capture the event callback registered by ensureMessageListener
      let eventCallback: ((event: { payload: unknown }) => void) | undefined;
      mockListen.mockImplementation((_eventName: string, cb: (event: { payload: unknown }) => void) => {
        eventCallback = cb;
        return Promise.resolve(() => { /* unlisten */ });
      });

      // Trigger the listener setup by calling messages once
      await wsNativeTauriTransport(
        makeRequest({ op: 'messages', method: 'GET', query: { connectionId: 'conn-1' } }),
      );

      // Simulate a ws-message event from Rust
      expect(eventCallback).toBeDefined();
      eventCallback!({
        payload: {
          connectionId: 'conn-1',
          data: 'hello echo',
          messageType: 'text',
          timestamp: Date.now(),
        },
      });

      // Now poll messages — should return the buffered message
      const result = await wsNativeTauriTransport(
        makeRequest({ op: 'messages', method: 'GET', query: { connectionId: 'conn-1' } }),
      );

      const data = result.data as { messages: unknown[]; cursor: number; bufferSize: number };
      expect(data.messages).toHaveLength(1);
      expect(data.cursor).toBe(1);
      expect(data.bufferSize).toBe(1);
      expect((data.messages[0] as { data: string }).data).toBe('hello echo');
    });

    it('respects sinceCursor to skip already-seen messages', async () => {
      let eventCallback: ((event: { payload: unknown }) => void) | undefined;
      mockListen.mockImplementation((_eventName: string, cb: (event: { payload: unknown }) => void) => {
        eventCallback = cb;
        return Promise.resolve(() => { /* unlisten */ });
      });

      // Init listener
      await wsNativeTauriTransport(
        makeRequest({ op: 'messages', method: 'GET', query: { connectionId: 'conn-2' } }),
      );

      // Send two messages
      eventCallback!({ payload: { connectionId: 'conn-2', data: 'msg1', messageType: 'text', timestamp: Date.now() } });
      eventCallback!({ payload: { connectionId: 'conn-2', data: 'msg2', messageType: 'text', timestamp: Date.now() } });

      // Poll with sinceCursor=1 — should skip msg1
      const result = await wsNativeTauriTransport(
        makeRequest({ op: 'messages', method: 'GET', query: { connectionId: 'conn-2', sinceCursor: '1' } }),
      );

      const data = result.data as { messages: { data: string }[]; cursor: number };
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].data).toBe('msg2');
      expect(data.cursor).toBe(2);
    });
  });

  describe('error handling', () => {
    it('throws WsClientError with WS_INVOKE_ERROR on IPC failure', async () => {
      mockInvoke.mockRejectedValue(new Error('IPC channel closed'));

      await expect(
        wsNativeTauriTransport(
          makeRequest({ op: 'connect', body: { url: 'ws://x' } }),
        ),
      ).rejects.toThrow(WsClientError);

      try {
        await wsNativeTauriTransport(
          makeRequest({ op: 'connect', body: { url: 'ws://x' } }),
        );
      } catch (e) {
        expect(e).toBeInstanceOf(WsClientError);
        const err = e as WsClientError;
        expect(err.code).toBe('WS_INVOKE_ERROR');
        expect(err.operation).toBe('connect');
        expect(err.message).toBe('IPC channel closed');
      }
    });

    it('throws WsClientError on not-ok envelope from Rust', async () => {
      mockInvoke.mockResolvedValue(
        errorEnvelope('send', 'WS_NOT_CONNECTED', 'Connection is closed'),
      );

      await expect(
        wsNativeTauriTransport(
          makeRequest({ op: 'send', body: { connectionId: 'c1', data: 'x' } }),
        ),
      ).rejects.toThrow(WsClientError);

      try {
        await wsNativeTauriTransport(
          makeRequest({ op: 'send', body: { connectionId: 'c1', data: 'x' } }),
        );
      } catch (e) {
        const err = e as WsClientError;
        expect(err.code).toBe('WS_NOT_CONNECTED');
        expect(err.message).toBe('Connection is closed');
        expect(err.retryable).toBe(false);
      }
    });

    it('handles non-Error throw from invoke', async () => {
      mockInvoke.mockRejectedValue('raw string error');

      try {
        await wsNativeTauriTransport(
          makeRequest({ op: 'connect', body: { url: 'ws://x' } }),
        );
      } catch (e) {
        const err = e as WsClientError;
        expect(err.code).toBe('WS_INVOKE_ERROR');
        expect(err.message).toBe('raw string error');
      }
    });
  });

  describe('restoreQueryTypes', () => {
    it('converts numeric strings to numbers for GET operations', async () => {
      mockInvoke.mockResolvedValue(okEnvelope('status', { state: 'connected' }));

      await wsNativeTauriTransport(
        makeRequest({
          op: 'status',
          method: 'GET',
          query: { connectionId: 'c1', sinceCursor: '42' },
        }),
      );

      expect(mockInvoke).toHaveBeenCalledWith('ws_status', {
        request: { connectionId: 'c1', sinceCursor: 42 },
      });
    });

    it('converts boolean strings to booleans', async () => {
      mockInvoke.mockResolvedValue(okEnvelope('status', { state: 'connected' }));

      await wsNativeTauriTransport(
        makeRequest({
          op: 'status',
          method: 'GET',
          query: { connectionId: 'c1', verbose: 'true', compact: 'false' },
        }),
      );

      expect(mockInvoke).toHaveBeenCalledWith('ws_status', {
        request: { connectionId: 'c1', verbose: true, compact: false },
      });
    });

    it('keeps non-numeric strings as strings', async () => {
      mockInvoke.mockResolvedValue(okEnvelope('status', { state: 'connected' }));

      await wsNativeTauriTransport(
        makeRequest({
          op: 'status',
          method: 'GET',
          query: { connectionId: 'abc', label: 'dev' },
        }),
      );

      expect(mockInvoke).toHaveBeenCalledWith('ws_status', {
        request: { connectionId: 'abc', label: 'dev' },
      });
    });
  });

  describe('disconnect buffer cleanup', () => {
    it('clears the message buffer after disconnect', async () => {
      let eventCallback: ((event: { payload: unknown }) => void) | undefined;
      mockListen.mockImplementation((_eventName: string, cb: (event: { payload: unknown }) => void) => {
        eventCallback = cb;
        return Promise.resolve(() => { /* unlisten */ });
      });
      mockInvoke.mockResolvedValue(okEnvelope('disconnect', { connectionId: 'conn-1', disconnected: true }));

      await wsNativeTauriTransport(
        makeRequest({ op: 'messages', method: 'GET', query: { connectionId: 'conn-1' } }),
      );
      eventCallback!({
        payload: { connectionId: 'conn-1', data: 'hello', messageType: 'text', timestamp: Date.now() },
      });

      await wsNativeTauriTransport(
        makeRequest({ op: 'disconnect', method: 'POST', body: { connectionId: 'conn-1' } }),
      );

      const result = await wsNativeTauriTransport(
        makeRequest({ op: 'messages', method: 'GET', query: { connectionId: 'conn-1' } }),
      );
      expect((result.data as { messages: unknown[] }).messages).toHaveLength(0);
    });
  });

  describe('message buffer trimming', () => {
    it('trims oldest messages when buffer exceeds MAX_BUFFER_SIZE', async () => {
      let eventCallback: ((event: { payload: unknown }) => void) | undefined;
      mockListen.mockImplementation((_eventName: string, cb: (event: { payload: unknown }) => void) => {
        eventCallback = cb;
        return Promise.resolve(() => { /* unlisten */ });
      });

      await wsNativeTauriTransport(
        makeRequest({ op: 'messages', method: 'GET', query: { connectionId: 'big-buf' } }),
      );

      for (let i = 0; i < 505; i++) {
        eventCallback!({
          payload: {
            connectionId: 'big-buf',
            data: `msg-${i}`,
            messageType: 'text',
            timestamp: Date.now() + i,
          },
        });
      }

      const result = await wsNativeTauriTransport(
        makeRequest({ op: 'messages', method: 'GET', query: { connectionId: 'big-buf' } }),
      );
      const data = result.data as { messages: { data: string }[]; bufferSize: number };
      expect(data.bufferSize).toBe(500);
      expect(data.messages[0].data).toBe('msg-5');
    });

    it('defaults messageType to text when payload omits it', async () => {
      let eventCallback: ((event: { payload: unknown }) => void) | undefined;
      mockListen.mockImplementation((_eventName: string, cb: (event: { payload: unknown }) => void) => {
        eventCallback = cb;
        return Promise.resolve(() => { /* unlisten */ });
      });

      await wsNativeTauriTransport(
        makeRequest({ op: 'messages', method: 'GET', query: { connectionId: 'conn-3' } }),
      );
      eventCallback!({
        payload: { connectionId: 'conn-3', data: 'plain', timestamp: Date.now() },
      });

      const result = await wsNativeTauriTransport(
        makeRequest({ op: 'messages', method: 'GET', query: { connectionId: 'conn-3' } }),
      );
      const msg = (result.data as { messages: { type: string }[] }).messages[0];
      expect(msg.type).toBe('text');
    });
  });
});

describe('listenWsMessage', () => {
  it('subscribes to ws-message events', async () => {
    const unlisten = vi.fn();
    mockListen.mockResolvedValue(unlisten);

    const callback = vi.fn();
    const result = await listenWsMessage(callback);

    expect(mockListen).toHaveBeenCalledWith('ws-message', expect.any(Function));
    expect(result).toBe(unlisten);
  });

  it('unwraps Tauri event payload before calling callback', async () => {
    const unlisten = vi.fn();
    mockListen.mockImplementation((_event: string, handler: (e: unknown) => void) => {
      handler({
        payload: {
          connectionId: 'c1',
          data: 'hello',
          messageType: 'text',
          timestamp: 1234567890,
        },
      });
      return Promise.resolve(unlisten);
    });

    const callback = vi.fn();
    await listenWsMessage(callback);

    expect(callback).toHaveBeenCalledWith({
      connectionId: 'c1',
      data: 'hello',
      messageType: 'text',
      timestamp: 1234567890,
    });
  });
});

describe('listenWsConnectionClosed', () => {
  it('subscribes to ws-connection-closed events', async () => {
    const unlisten = vi.fn();
    mockListen.mockResolvedValue(unlisten);

    const callback = vi.fn();
    const result = await listenWsConnectionClosed(callback);

    expect(mockListen).toHaveBeenCalledWith('ws-connection-closed', expect.any(Function));
    expect(result).toBe(unlisten);
  });

  it('unwraps Tauri event payload before calling callback', async () => {
    const unlisten = vi.fn();
    mockListen.mockImplementation((_event: string, handler: (e: unknown) => void) => {
      handler({
        payload: {
          connectionId: 'c1',
          code: 1000,
          reason: 'Normal closure',
        },
      });
      return Promise.resolve(unlisten);
    });

    const callback = vi.fn();
    await listenWsConnectionClosed(callback);

    expect(callback).toHaveBeenCalledWith({
      connectionId: 'c1',
      code: 1000,
      reason: 'Normal closure',
    });
  });
});
