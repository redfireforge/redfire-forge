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
} from './websocketNativeTauriTransport';
import { WsClientError } from './websocketClient';

beforeEach(() => {
  vi.clearAllMocks();
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

  describe('messages (synthetic)', () => {
    it('returns synthetic success envelope without invoking Rust', async () => {
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
