import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dispatchWsOperation,
  WsClientError,
  throwIfWsEnvelopeNotOk,
  setWsClientTransport,
  defaultWsTransport,
  type WsClientTransport,
  type WsDispatchRequest,
  type WsEnvelope,
} from './websocketClient';

vi.mock('../utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { httpFetch } from '../utils/httpClient';
const mockHttpFetch = vi.mocked(httpFetch);

beforeEach(() => {
  vi.clearAllMocks();
  setWsClientTransport(null);
});

afterEach(() => {
  setWsClientTransport(null);
});

function okResponse(op: string, data: unknown) {
  return {
    status: 200,
    body: JSON.stringify({ ok: true, op, data, meta: { timestamp: new Date().toISOString() } }),
    headers: {},
  };
}

function errorResponse(op: string, code: string, message: string) {
  return {
    status: 400,
    body: JSON.stringify({ ok: false, op, error: { code, message }, meta: { timestamp: new Date().toISOString() } }),
    headers: {},
  };
}

describe('dispatchWsOperation', () => {
  describe('connect', () => {
    it('sends POST to /api/ws/connect', async () => {
      mockHttpFetch.mockResolvedValue(okResponse('connect', { connectionId: 'abc' }));
      const env = await dispatchWsOperation('connect', { url: 'ws://localhost:8765' });
      expect(env.ok).toBe(true);
      expect(env.data).toEqual({ connectionId: 'abc' });
      expect(mockHttpFetch).toHaveBeenCalledWith(
        '/api/ws/connect',
        'POST',
        expect.objectContaining({ 'Content-Type': 'application/json' }),
        expect.stringContaining('"url":"ws://localhost:8765"'),
      );
    });
  });

  describe('send', () => {
    it('sends POST to /api/ws/send', async () => {
      mockHttpFetch.mockResolvedValue(okResponse('send', { connectionId: 'abc', sentAt: 'x' }));
      const env = await dispatchWsOperation('send', { connectionId: 'abc', data: 'hello' });
      expect(env.ok).toBe(true);
      expect(mockHttpFetch).toHaveBeenCalledWith(
        '/api/ws/send',
        'POST',
        expect.any(Object),
        expect.stringContaining('"data":"hello"'),
      );
    });
  });

  describe('messages', () => {
    it('sends GET to /api/ws/messages with query params', async () => {
      mockHttpFetch.mockResolvedValue(okResponse('messages', { messages: [], cursor: 0 }));
      await dispatchWsOperation('messages', { connectionId: 'abc', sinceCursor: 5 });
      expect(mockHttpFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/ws\/messages\?.*connectionId=abc/),
        'GET',
        expect.any(Object),
        undefined,
      );
    });
  });

  describe('status', () => {
    it('sends GET to /api/ws/status with query params', async () => {
      mockHttpFetch.mockResolvedValue(okResponse('status', { state: 'connected' }));
      await dispatchWsOperation('status', { connectionId: 'abc' });
      expect(mockHttpFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/ws\/status\?connectionId=abc/),
        'GET',
        expect.any(Object),
        undefined,
      );
    });
  });

  describe('disconnect', () => {
    it('sends POST to /api/ws/disconnect', async () => {
      mockHttpFetch.mockResolvedValue(okResponse('disconnect', { disconnected: true }));
      const env = await dispatchWsOperation('disconnect', { connectionId: 'abc' });
      expect(env.ok).toBe(true);
    });
  });

  describe('error handling', () => {
    it('throws WsClientError on network error', async () => {
      mockHttpFetch.mockResolvedValue({ status: 0, body: '', headers: {}, error: 'Network error' });
      await expect(dispatchWsOperation('connect', { url: 'ws://x' }))
        .rejects.toThrow(WsClientError);
    });

    it('throws WsClientError on non-JSON response', async () => {
      mockHttpFetch.mockResolvedValue({ status: 200, body: 'not json', headers: {} });
      await expect(dispatchWsOperation('connect', { url: 'ws://x' }))
        .rejects.toThrow(WsClientError);
    });

    it('throws WsClientError on error envelope', async () => {
      mockHttpFetch.mockResolvedValue(errorResponse('connect', 'WS_INVALID_URL', 'Bad URL'));
      await expect(dispatchWsOperation('connect', { url: 'bad' }))
        .rejects.toThrow(WsClientError);
    });

    it('includes error code in thrown WsClientError', async () => {
      mockHttpFetch.mockResolvedValue(errorResponse('connect', 'WS_INVALID_URL', 'Bad URL'));
      try {
        await dispatchWsOperation('connect', { url: 'bad' });
      } catch (e) {
        expect(e).toBeInstanceOf(WsClientError);
        if (e instanceof WsClientError) {
          expect(e.code).toBe('WS_INVALID_URL');
          expect(e.message).toBe('Bad URL');
          expect(e.operation).toBe('connect');
        }
      }
    });

    it('throws on invalid envelope shape', async () => {
      mockHttpFetch.mockResolvedValue({ status: 200, body: '{"foo": "bar"}', headers: {} });
      await expect(dispatchWsOperation('connect', { url: 'ws://x' }))
        .rejects.toThrow(WsClientError);
    });
  });
});

describe('throwIfWsEnvelopeNotOk', () => {
  it('does not throw for ok envelope', () => {
    const envelope: WsEnvelope = { ok: true, op: 'connect', data: {} };
    expect(() => throwIfWsEnvelopeNotOk('connect', envelope)).not.toThrow();
  });

  it('throws WsClientError with envelope code on not-ok', () => {
    const envelope: WsEnvelope = {
      ok: false,
      op: 'send',
      error: { code: 'WS_NOT_CONNECTED', message: 'Connection closed' },
    };

    try {
      throwIfWsEnvelopeNotOk('send', envelope);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(WsClientError);
      const err = e as WsClientError;
      expect(err.code).toBe('WS_NOT_CONNECTED');
      expect(err.message).toBe('Connection closed');
      expect(err.operation).toBe('send');
    }
  });

  it('uses fallback message when envelope error message is empty', () => {
    const envelope: WsEnvelope = {
      ok: false,
      op: 'connect',
      error: { code: 'WS_CONNECT_FAILED', message: '' },
    };

    try {
      throwIfWsEnvelopeNotOk('connect', envelope);
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as WsClientError;
      expect(err.message).toBe('WebSocket connect failed (WS_CONNECT_FAILED)');
    }
  });

  it('uses WS_OPERATION_FAILED when error code is missing', () => {
    const envelope: WsEnvelope = {
      ok: false,
      op: 'status',
      error: { code: '', message: 'Something went wrong' },
    };

    try {
      throwIfWsEnvelopeNotOk('status', envelope);
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as WsClientError;
      expect(err.code).toBe('WS_OPERATION_FAILED');
    }
  });

  it('preserves retryable flag from envelope', () => {
    const envelope: WsEnvelope = {
      ok: false,
      op: 'send',
      error: { code: 'WS_SEND_FAILED', message: 'Buffer full', retryable: true },
    };

    try {
      throwIfWsEnvelopeNotOk('send', envelope);
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as WsClientError;
      expect(err.retryable).toBe(true);
    }
  });
});

describe('transport override', () => {
  it('uses transportOverride when set', async () => {
    const mockTransport: WsClientTransport = vi.fn().mockResolvedValue({
      ok: true,
      op: 'connect',
      data: { connectionId: 'native-1' },
    });

    setWsClientTransport(mockTransport);
    const result = await dispatchWsOperation('connect', { url: 'ws://localhost:8765' });

    expect(result.data).toEqual({ connectionId: 'native-1' });
    expect(mockHttpFetch).not.toHaveBeenCalled();
    expect(mockTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'connect',
        method: 'POST',
        path: '/api/ws/connect',
        body: { url: 'ws://localhost:8765' },
      }),
    );
  });

  it('falls back to HTTP when transportOverride is null', async () => {
    setWsClientTransport(null);
    mockHttpFetch.mockResolvedValue(okResponse('connect', { connectionId: 'http-1' }));

    const result = await dispatchWsOperation('connect', { url: 'ws://localhost:8765' });
    expect(result.data).toEqual({ connectionId: 'http-1' });
    expect(mockHttpFetch).toHaveBeenCalled();
  });

  it('passes GET ops without body in dispatch request', async () => {
    const mockTransport: WsClientTransport = vi.fn().mockResolvedValue({
      ok: true,
      op: 'status',
      data: { state: 'connected' },
    });

    setWsClientTransport(mockTransport);
    await dispatchWsOperation('status', { connectionId: 'c1' });

    const call = (mockTransport as ReturnType<typeof vi.fn>).mock.calls[0][0] as WsDispatchRequest;
    expect(call.method).toBe('GET');
    expect(call.body).toBeUndefined();
    expect(call.query).toEqual({ connectionId: 'c1' });
  });

  it('clears transportOverride when set to null', async () => {
    const mockTransport: WsClientTransport = vi.fn().mockResolvedValue({
      ok: true,
      op: 'connect',
      data: {},
    });

    setWsClientTransport(mockTransport);
    setWsClientTransport(null);

    mockHttpFetch.mockResolvedValue(okResponse('connect', {}));
    await dispatchWsOperation('connect', { url: 'ws://x' });

    expect(mockTransport).not.toHaveBeenCalled();
    expect(mockHttpFetch).toHaveBeenCalled();
  });
});

describe('defaultWsTransport', () => {
  it('is exported and callable directly', async () => {
    mockHttpFetch.mockResolvedValue(okResponse('ping', { connectionId: 'c1', sentAt: 'x' }));

    const result = await defaultWsTransport({
      op: 'ping',
      method: 'POST',
      path: '/api/ws/ping',
      query: {},
      body: { connectionId: 'c1' },
    });

    expect(result.ok).toBe(true);
    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/ws/ping',
      'POST',
      expect.objectContaining({ 'Content-Type': 'application/json' }),
      expect.stringContaining('"connectionId":"c1"'),
    );
  });
});
