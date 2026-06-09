import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchWsOperation, WsClientError } from './websocketClient';

vi.mock('../utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { httpFetch } from '../utils/httpClient';
const mockHttpFetch = vi.mocked(httpFetch);

beforeEach(() => {
  vi.clearAllMocks();
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
